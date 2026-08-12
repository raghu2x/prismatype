import { ENUMS_FILE_NAME, MODEL_BARREL_FILE_NAME, MODELS_DIR_NAME } from "../config";

/**
 * Pure string transforms used by the `prismatype migrate` codemod. Everything in
 * here takes source text in and returns source text out, so the whole migration
 * is testable without touching the filesystem.
 */

/** prismabox's default output directory, used when its generator block omits `output`. */
export const PRISMABOX_DEFAULT_OUTPUT = "./prisma/prismabox";

/** The filename prismabox emits as its re-export barrel. */
export const PRISMABOX_BARREL_FILE_NAME = "barrel";

/** The TypeBox 0.x package prismabox imports from. */
export const TYPEBOX_LEGACY_PACKAGE = "@sinclair/typebox";

/** The TypeBox 1.x package PrismaType imports from. */
export const TYPEBOX_PACKAGE = "typebox";

export type Change = {
  /** One-line, human-readable summary of what was rewritten. */
  description: string;
  /** How many occurrences the rule rewrote. */
  count: number;
};

export type TransformResult = {
  /** The rewritten source. Identical to the input when `changes` is empty. */
  content: string;
  changes: Change[];
};

/**
 * Records a change only when the rule actually matched, so callers can cheaply
 * tell "file untouched" from "file rewritten" by checking `changes.length`.
 */
function pushChange(changes: Change[], description: string, count: number) {
  if (count > 0) {
    changes.push({ description, count });
  }
}

/** Escapes a string for safe interpolation into a RegExp. */
function escapeRegExp(input: string): string {
  return input.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Counts matches without consuming a lastIndex-bearing regex, so the same
 * pattern can be reused for the subsequent replace.
 */
function countMatches(content: string, pattern: RegExp): number {
  return Array.from(content.matchAll(pattern)).length;
}

/**
 * Rewrites `@prismabox.*` doc-comment annotations to `@prismatype.*`.
 *
 * Only the namespace changes; every suffix (`hide`, `input.hide`, `options{...}`,
 * `typeOverwrite=...`) carries over verbatim, so a namespace-level replace is
 * both sufficient and safe.
 */
export function migrateAnnotations(content: string): TransformResult {
  const pattern = /@prismabox\./g;
  const count = countMatches(content, pattern);

  return {
    content: count > 0 ? content.replaceAll(pattern, "@prismatype.") : content,
    changes: count > 0 ? [{ description: "@prismabox.* -> @prismatype.*", count }] : [],
  };
}

/**
 * Reads the `output` value out of a generator block body, if it sets one.
 * Returns `undefined` when the block relies on the provider's default.
 */
function readOutputOption(blockBody: string): string | undefined {
  const match = blockBody.match(/^\s*output\s*=\s*"([^"]*)"/m);
  return match?.[1];
}

export type SchemaMigration = TransformResult & {
  /**
   * The output path the prismabox generator block resolved to (explicit value,
   * or prismabox's default when unset). `undefined` when no prismabox generator
   * block was found. Import rewriting keys off this.
   */
  previousOutput: string | undefined;
  /** The output path after migration. Equal to `previousOutput` when it was explicit. */
  nextOutput: string | undefined;
};

/**
 * Migrates a `schema.prisma`:
 *
 * - renames the `generator prismabox { ... }` block and its `provider` to prismatype
 * - pins the previously-implicit `output` so import paths don't silently move
 *   (prismabox defaults to `./prisma/prismabox`, PrismaType to `./prisma/prismatype`)
 * - rewrites `@prismabox.*` annotations
 *
 * The generator block is matched structurally rather than by a blanket
 * find-and-replace so an unrelated identifier containing "prismabox" (a model
 * named `PrismaboxLog`, a comment) is left alone.
 */
export function migrateSchema(content: string): SchemaMigration {
  const changes: Change[] = [];
  let previousOutput: string | undefined;
  let nextOutput: string | undefined;
  let result = content;

  // Match `generator <name> { <body> }` where the body declares prismabox as its
  // provider. Keying off the provider (not the block name) means a block named
  // anything still migrates, and a block named `prismabox` pointing at a
  // different provider does not.
  const generatorBlock = /generator\s+(\w+)\s*\{([^}]*)\}/g;
  let blockCount = 0;
  let pinnedOutput = 0;

  result = result.replaceAll(generatorBlock, (whole, blockName: string, body: string) => {
    if (!/^\s*provider\s*=\s*"prismabox"/m.test(body)) {
      return whole;
    }

    blockCount++;
    previousOutput = readOutputOption(body) ?? PRISMABOX_DEFAULT_OUTPUT;
    nextOutput = previousOutput;

    let nextBody = body.replace(/(^\s*provider\s*=\s*)"prismabox"/m, '$1"prismatype"');

    // prismabox defaulted `output` to ./prisma/prismabox and PrismaType defaults
    // to ./prisma/prismatype. If the block never set `output`, writing the old
    // default in keeps the generated files exactly where the app already imports
    // them from, turning a silent relocation into a no-op.
    if (readOutputOption(body) === undefined) {
      const providerLine = nextBody.match(/^([^\S\n]*)provider(\s*)=\s*"prismatype".*$/m);
      if (providerLine) {
        const indent = providerLine[1] ?? "  ";
        // Match the block's existing `=` alignment: pad "output" to the same
        // column "provider" occupies so the injected line doesn't look foreign.
        const providerPad = (providerLine[2] ?? " ").length;
        const gap = " ".repeat(Math.max(1, "provider".length + providerPad - "output".length));
        nextBody = nextBody.replace(
          providerLine[0],
          `${providerLine[0]}\n${indent}output${gap}= "${PRISMABOX_DEFAULT_OUTPUT}"`,
        );
        pinnedOutput++;
      }
    }

    // Only rename the block itself when it was actually called "prismabox";
    // a custom name is the user's and is left intact.
    const nextName = blockName === "prismabox" ? "prismatype" : blockName;

    return `generator ${nextName} {${nextBody}}`;
  });

  pushChange(changes, 'generator provider "prismabox" -> "prismatype"', blockCount);
  pushChange(
    changes,
    `pinned previously-default output to "${PRISMABOX_DEFAULT_OUTPUT}" (PrismaType's default differs)`,
    pinnedOutput,
  );

  const annotations = migrateAnnotations(result);
  result = annotations.content;
  changes.push(...annotations.changes);

  return { content: result, changes, previousOutput, nextOutput };
}

/**
 * Rewrites a single import specifier that points into the generated output
 * directory, or returns `undefined` when it points somewhere else.
 *
 * Three layout changes have to be undone:
 * - per-enum files collapsed into one shared `enums.ts` at the output root
 * - per-model files moved down into a `models/` subdirectory
 * - `barrel.ts` renamed to `model.ts`
 *
 * `outputBaseName` is the last path segment of the configured output dir (e.g.
 * `schema` for `./generated/schema`); it is what anchors a relative specifier
 * like `../generated/schema/Post` to the generated tree.
 */
export function migrateImportSpecifier(
  specifier: string,
  outputBaseName: string,
  enumNames: ReadonlySet<string>,
): string | undefined {
  const anchor = escapeRegExp(outputBaseName);
  // Capture everything up to and including the output dir, then the trailing
  // path inside it. Anything without a trailing segment is already root-level.
  const match = specifier.match(new RegExp(`^(.*(?:^|/)${anchor})/(.+)$`));
  if (!match) {
    return undefined;
  }

  const prefix = match[1];
  const rest = match[2] ?? "";

  // Preserve an explicit extension (".js" under nodenext) across the rewrite.
  const extensionMatch = rest.match(/\.(js|ts|jsx|tsx|mjs|cjs)$/);
  const extension = extensionMatch?.[0] ?? "";
  const bare = extension ? rest.slice(0, -extension.length) : rest;

  // Already-migrated paths are left alone so the codemod is idempotent.
  if (
    bare === ENUMS_FILE_NAME ||
    bare === MODEL_BARREL_FILE_NAME ||
    bare.startsWith(`${MODELS_DIR_NAME}/`)
  ) {
    return undefined;
  }

  if (bare === PRISMABOX_BARREL_FILE_NAME) {
    return `${prefix}/${MODEL_BARREL_FILE_NAME}${extension}`;
  }

  // A known enum name resolves to the shared enums file; anything else that
  // looks like a single generated file is a model and moves under models/.
  if (enumNames.has(bare)) {
    return `${prefix}/${ENUMS_FILE_NAME}${extension}`;
  }

  if (!bare.includes("/")) {
    return `${prefix}/${MODELS_DIR_NAME}/${bare}${extension}`;
  }

  return undefined;
}

/**
 * Rewrites every import/export specifier in a TS/JS source file that points at
 * the generated output directory, plus any lingering `@sinclair/typebox` import.
 *
 * Matching is done on the specifier string inside import/export/`require`/dynamic
 * -import syntax rather than by parsing, which keeps the codemod dependency-free
 * and is safe because only the quoted specifier is ever rewritten.
 */
export function migrateSourceImports(
  content: string,
  outputBaseName: string,
  enumNames: ReadonlySet<string>,
): TransformResult {
  const changes: Change[] = [];
  let result = content;

  let enumsRewrites = 0;
  let modelRewrites = 0;
  let barrelRewrites = 0;

  // Matches the quoted specifier of `from "..."`, `import "..."`,
  // `import("...")` and `require("...")`.
  const specifierPattern = /(\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])([^"']+)(\2)/g;

  result = result.replaceAll(
    specifierPattern,
    (whole, lead: string, quote: string, specifier: string) => {
      const rewritten = migrateImportSpecifier(specifier, outputBaseName, enumNames);
      if (rewritten === undefined) {
        return whole;
      }

      if (rewritten.endsWith(ENUMS_FILE_NAME) || rewritten.includes(`/${ENUMS_FILE_NAME}.`)) {
        enumsRewrites++;
      } else if (rewritten.includes(`/${MODELS_DIR_NAME}/`)) {
        modelRewrites++;
      } else {
        barrelRewrites++;
      }

      return `${lead}${quote}${rewritten}${quote}`;
    },
  );

  pushChange(changes, `per-enum imports -> "${ENUMS_FILE_NAME}"`, enumsRewrites);
  pushChange(changes, `model imports -> "${MODELS_DIR_NAME}/*"`, modelRewrites);
  pushChange(
    changes,
    `"${PRISMABOX_BARREL_FILE_NAME}" -> "${MODEL_BARREL_FILE_NAME}"`,
    barrelRewrites,
  );

  const typeboxPattern = new RegExp(
    `(["'])${escapeRegExp(TYPEBOX_LEGACY_PACKAGE)}((?:/[^"']*)?)\\1`,
    "g",
  );
  const typeboxCount = countMatches(result, typeboxPattern);
  if (typeboxCount > 0) {
    result = result.replaceAll(typeboxPattern, `$1${TYPEBOX_PACKAGE}$2$1`);
    pushChange(changes, `"${TYPEBOX_LEGACY_PACKAGE}" -> "${TYPEBOX_PACKAGE}"`, typeboxCount);
  }

  return { content: result, changes };
}

/**
 * Swaps the dependencies in a parsed package.json: drops prismabox and TypeBox
 * 0.x, adds prismatype (dev) and typebox (runtime).
 *
 * Operates on the raw text so key order, indentation, and any comments-free
 * formatting the user has are preserved as much as JSON round-tripping allows.
 * Returns the new manifest text plus the list of changes.
 */
export function migratePackageJson(
  content: string,
  versions: { prismatype: string; typebox: string },
): TransformResult {
  const changes: Change[] = [];
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return { content, changes };
  }

  const depFields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  let removed = 0;

  for (const field of depFields) {
    const deps = parsed[field];
    if (typeof deps !== "object" || deps === null) {
      continue;
    }

    const record = deps as Record<string, string>;
    for (const name of ["prismabox", TYPEBOX_LEGACY_PACKAGE]) {
      if (name in record) {
        delete record[name];
        removed++;
      }
    }
  }

  pushChange(changes, `removed prismabox / ${TYPEBOX_LEGACY_PACKAGE}`, removed);

  // Only add what isn't already declared somewhere, so re-running the codemod
  // doesn't move a dependency the user deliberately placed.
  const declaredIn = (name: string) =>
    depFields.some((field) => {
      const deps = parsed[field];
      return typeof deps === "object" && deps !== null && name in (deps as Record<string, string>);
    });

  let added = 0;

  if (!declaredIn("prismatype")) {
    const dev = (parsed.devDependencies ??= {}) as Record<string, string>;
    dev.prismatype = versions.prismatype;
    parsed.devDependencies = sortKeys(dev);
    added++;
  }

  if (!declaredIn(TYPEBOX_PACKAGE)) {
    const runtime = (parsed.dependencies ??= {}) as Record<string, string>;
    runtime[TYPEBOX_PACKAGE] = versions.typebox;
    parsed.dependencies = sortKeys(runtime);
    added++;
  }

  pushChange(changes, `added prismatype / ${TYPEBOX_PACKAGE}`, added);

  if (changes.length === 0) {
    return { content, changes };
  }

  const indent = detectIndent(content);
  const trailingNewline = content.endsWith("\n") ? "\n" : "";

  return { content: `${JSON.stringify(parsed, null, indent)}${trailingNewline}`, changes };
}

/** Sorts object keys alphabetically, matching how package managers write manifests. */
function sortKeys(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

/** Detects the indentation width of an existing JSON document, defaulting to 2. */
function detectIndent(content: string): number {
  const match = content.match(/\n(\s+)"/);
  const whitespace = match?.[1] ?? "  ";
  return whitespace.includes("\t") ? 1 : whitespace.length;
}
