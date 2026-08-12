import { spawnSync } from "node:child_process";
import type { Dirent } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { type Change, migratePackageJson, migrateSchema, migrateSourceImports } from "./transforms";

/**
 * The `prismatype migrate` codemod: rewrites a prismabox project to PrismaType.
 *
 * Scope is deliberately limited to the mechanical parts of the migration
 * documented in docs/guide/migrating-from-prismabox.md, namely the schema
 * generator block, `@prismabox.*` annotations, imports of the generated output,
 * and the package.json dependency swap. It does not run a package manager and
 * does not regenerate, both of which are left to the user.
 */

/** Version ranges written into package.json for the packages we add. */
const ADDED_VERSIONS = { prismatype: "^1.1.0", typebox: "^1.3.7" };

/** Directories never worth walking when hunting for source files. */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".vercel",
  ".output",
  ".svelte-kit",
]);

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];

export type FileEdit = {
  /** Absolute path of the edited file. */
  path: string;
  changes: Change[];
};

export type MigrateOptions = {
  /** Project root to migrate. */
  cwd: string;
  /** Skip the clean-working-tree check. */
  force: boolean;
  /** Report intended edits without writing them. */
  dryRun: boolean;
};

/**
 * Returns a message describing why the working tree isn't safe to write to, or
 * `undefined` when it is. A clean tree is what makes this codemod recoverable:
 * the user can always `git checkout .` to undo it.
 */
function checkWorkingTree(cwd: string): string | undefined {
  const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd,
    encoding: "utf8",
  });

  if (inside.status !== 0 || inside.stdout.trim() !== "true") {
    return "not a git repository, so changes could not be undone";
  }

  const status = spawnSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" });

  if (status.status !== 0) {
    return "unable to read git status";
  }

  if (status.stdout.trim().length > 0) {
    return "the working tree has uncommitted changes";
  }

  return undefined;
}

/** Recursively collects files under `dir` that pass `predicate`. */
async function collectFiles(dir: string, predicate: (path: string) => boolean): Promise<string[]> {
  const found: string[] = [];

  async function walk(current: string) {
    let entries: Dirent[];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = join(current, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          await walk(full);
        }
      } else if (entry.isFile() && predicate(full)) {
        found.push(full);
      }
    }
  }

  await walk(dir);
  return found;
}

/**
 * Extracts enum names from a Prisma schema so import rewriting can tell a
 * per-enum file (which collapses into the shared enums.ts) from a model file
 * (which moves into models/).
 */
export function readEnumNames(schema: string): Set<string> {
  const names = new Set<string>();
  for (const match of schema.matchAll(/^\s*enum\s+(\w+)\s*\{/gm)) {
    const name = match[1];
    if (name) {
      names.add(name);
    }
  }
  return names;
}

/**
 * Runs the migration and returns every edit it made (or would make under
 * `dryRun`). Throws when the working tree isn't safe and `force` is not set.
 */
export async function migrateProject(options: MigrateOptions): Promise<FileEdit[]> {
  const { cwd, force, dryRun } = options;
  const edits: FileEdit[] = [];

  if (!dryRun && !force) {
    const problem = checkWorkingTree(cwd);
    if (problem) {
      throw new Error(
        `Refusing to write: ${problem}.\n` +
          "Commit or stash your work first so the migration can be reverted with `git checkout .`,\n" +
          "or re-run with --force to migrate anyway. Use --dry-run to preview the changes.",
      );
    }
  }

  const schemaPaths = await collectFiles(cwd, (path) => path.endsWith(".prisma"));

  if (schemaPaths.length === 0) {
    throw new Error(`No .prisma schema found under ${cwd}`);
  }

  // Migrate every schema, tracking the output dir(s) that generated files land
  // in so import rewriting knows what to anchor on.
  const outputBaseNames = new Set<string>();
  const enumNames = new Set<string>();

  for (const path of schemaPaths) {
    const original = await readFile(path, "utf8");
    const result = migrateSchema(original);

    for (const name of readEnumNames(original)) {
      enumNames.add(name);
    }

    if (result.previousOutput) {
      outputBaseNames.add(basename(result.previousOutput));
    }

    if (result.changes.length > 0) {
      if (!dryRun) {
        await writeSchema(path, result.content);
      }
      edits.push({ path, changes: result.changes });
    }
  }

  // No prismabox generator block is a legitimate no-op (an already-migrated
  // project, or one that never used prismabox), not a failure. Returning no
  // edits lets the caller report "nothing to migrate" and exit successfully.
  if (outputBaseNames.size === 0) {
    return edits;
  }

  const sourcePaths = await collectFiles(cwd, (path) =>
    SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension)),
  );

  for (const path of sourcePaths) {
    const original = await readFile(path, "utf8");
    let content = original;
    const changes: Change[] = [];

    for (const outputBaseName of outputBaseNames) {
      const result = migrateSourceImports(content, outputBaseName, enumNames);
      content = result.content;
      changes.push(...result.changes);
    }

    if (changes.length > 0) {
      if (!dryRun) {
        await writeFile(path, content);
      }
      edits.push({ path, changes });
    }
  }

  const manifestPath = join(cwd, "package.json");
  try {
    const original = await readFile(manifestPath, "utf8");
    const result = migratePackageJson(original, ADDED_VERSIONS);

    if (result.changes.length > 0) {
      if (!dryRun) {
        await writeFile(manifestPath, result.content);
      }
      edits.push({ path: manifestPath, changes: result.changes });
    }
  } catch {
    // No package.json at the root is fine (monorepo leaf, or a non-npm project).
  }

  return edits;
}

/**
 * Writes a .prisma file as UTF-8 without a BOM. Prisma's schema parser rejects
 * a BOM, and some Windows toolchains add one by default.
 */
async function writeSchema(path: string, content: string) {
  await writeFile(path, content, { encoding: "utf8" });
}

/** Formats the result of a run for the terminal. */
export function formatReport(edits: FileEdit[], cwd: string, dryRun: boolean): string {
  if (edits.length === 0) {
    return "Nothing to migrate: no prismabox references found.";
  }

  const lines: string[] = [];
  let total = 0;

  for (const edit of edits) {
    lines.push(`  ${relative(cwd, edit.path) || basename(edit.path)}`);
    for (const change of edit.changes) {
      lines.push(`    ${change.count}x  ${change.description}`);
      total += change.count;
    }
  }

  const header = dryRun
    ? `Would apply ${total} change(s) across ${edits.length} file(s):`
    : `Applied ${total} change(s) across ${edits.length} file(s):`;

  const footer = dryRun
    ? "\nRe-run without --dry-run to write these changes."
    : "\nNext steps:\n" +
      "  1. Install the new dependencies (npm i / pnpm i / bun install)\n" +
      "  2. Run `npx prisma generate`\n" +
      "  3. Typecheck your project to catch any imports the codemod could not resolve";

  return `${header}\n${lines.join("\n")}\n${footer}`;
}

/** CLI entry point for `prismatype migrate`. */
export async function runMigrateCli(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.info(
      "Usage: prismatype migrate [options]\n\n" +
        "Migrates a prismabox project to PrismaType: renames the generator block and\n" +
        "@prismabox.* annotations, rewrites imports of the generated output, and swaps\n" +
        "the package.json dependencies.\n\n" +
        "Options:\n" +
        "  --dry-run     Show the changes without writing them\n" +
        "  --force       Write even if the git working tree is dirty\n" +
        "  --cwd <dir>   Project root to migrate (default: current directory)\n" +
        "  -h, --help    Show this message",
    );
    return 0;
  }

  const cwdIndex = argv.indexOf("--cwd");
  const cwd = resolve(cwdIndex === -1 ? process.cwd() : (argv[cwdIndex + 1] ?? process.cwd()));
  const dryRun = argv.includes("--dry-run");

  try {
    const edits = await migrateProject({ cwd, dryRun, force: argv.includes("--force") });
    console.info(formatReport(edits, cwd, dryRun));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}
