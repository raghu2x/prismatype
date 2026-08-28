import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { formatReport, migrateProject, runMigrateCli } from "../src/migrate/index";
import { createTempProject, PRISMABOX_SCHEMA, type TempProject } from "./fixtures/project";

/**
 * Filesystem-level tests for the codemod's orchestration: schema discovery,
 * source walking, tsconfig anchoring, the working-tree guard and the CLI.
 *
 * The pure transforms are covered in migrate.test.ts; what is exercised here is
 * everything that decides *which* files get rewritten and *whether* they are
 * written at all, since that is what makes the codemod safe to run on a real
 * repository.
 */

let project: TempProject | undefined;

afterEach(async () => {
  await project?.cleanup();
  project = undefined;
});

/** Finds the edit for a project-relative path, if the run touched it. */
function editFor(edits: Awaited<ReturnType<typeof migrateProject>>, dir: string, rel: string) {
  return edits.find((edit) => edit.path === join(dir, rel));
}

describe("migrateProject", () => {
  test("rewrites schema, sources and package.json in one run", async () => {
    project = await createTempProject({
      "prisma/schema.prisma": PRISMABOX_SCHEMA,
      "src/app.ts": [
        'import { Post } from "../generated/schema/Post";',
        'import { Role } from "../generated/schema/Role";',
        'export { Everything } from "../generated/schema/barrel";',
      ].join("\n"),
      "package.json": JSON.stringify(
        { name: "app", devDependencies: { prismabox: "^1.0.0" } },
        null,
        2,
      ),
    });

    const edits = await migrateProject({ cwd: project.dir, force: true, dryRun: false });

    const schema = await project.read("prisma/schema.prisma");
    expect(schema).toContain('provider = "prismatype"');
    expect(schema).toContain("@prismatype.hide");
    expect(schema).not.toContain("prismabox");

    const source = await project.read("src/app.ts");
    expect(source).toContain('from "../generated/schema/models/Post"');
    expect(source).toContain('from "../generated/schema/enums"');
    expect(source).toContain('from "../generated/schema/model"');

    const manifest = JSON.parse(await project.read("package.json"));
    expect(manifest.devDependencies.prismabox).toBeUndefined();
    expect(manifest.devDependencies.prismatype).toBeDefined();

    // All three files are reported.
    expect(edits).toHaveLength(3);
    expect(editFor(edits, project.dir, "prisma/schema.prisma")).toBeDefined();
    expect(editFor(edits, project.dir, "src/app.ts")).toBeDefined();
    expect(editFor(edits, project.dir, "package.json")).toBeDefined();
  });

  test("dryRun reports edits without writing any of them", async () => {
    const originalSource = 'import { Post } from "./generated/schema/Post";';
    project = await createTempProject({
      "prisma/schema.prisma": PRISMABOX_SCHEMA,
      "src/app.ts": originalSource,
      "package.json": JSON.stringify({ name: "app", devDependencies: { prismabox: "^1.0.0" } }),
    });

    const edits = await migrateProject({ cwd: project.dir, force: false, dryRun: true });

    expect(edits.length).toBeGreaterThan(0);
    // Nothing on disk moved.
    expect(await project.read("prisma/schema.prisma")).toBe(PRISMABOX_SCHEMA);
    expect(await project.read("src/app.ts")).toBe(originalSource);
    expect(await project.read("package.json")).toContain("prismabox");
  });

  test("skips ignored directories when walking for sources", async () => {
    const importLine = 'import { Post } from "../generated/schema/Post";';
    project = await createTempProject({
      "prisma/schema.prisma": PRISMABOX_SCHEMA,
      "src/app.ts": importLine,
      "node_modules/pkg/index.ts": importLine,
      "dist/bundle.js": importLine,
      "coverage/report.js": importLine,
      ".next/build.ts": importLine,
    });

    const edits = await migrateProject({ cwd: project.dir, force: true, dryRun: false });

    expect(editFor(edits, project.dir, "src/app.ts")).toBeDefined();
    for (const ignored of [
      "node_modules/pkg/index.ts",
      "dist/bundle.js",
      "coverage/report.js",
      ".next/build.ts",
    ]) {
      expect(editFor(edits, project.dir, ignored)).toBeUndefined();
      expect(await project.read(ignored)).toBe(importLine);
    }
  });

  test("anchors imports on a tsconfig alias pointing at the output dir", async () => {
    // Prisma resolves a generator `output` relative to the schema's own
    // directory, so a schema in prisma/ with output "../generated/prismabox"
    // lands at <root>/generated/prismabox - which is what the alias must target
    // for readTsconfigAliases to recognise it.
    project = await createTempProject({
      "prisma/schema.prisma": PRISMABOX_SCHEMA.replace(
        '"./generated/schema"',
        '"../generated/prismabox"',
      ),
      "tsconfig.json": `{
  "compilerOptions": {
    "paths": {
      "@prismabox/*": ["./generated/prismabox/*"]
    }
  }
}`,
      "src/app.ts": [
        'import { Post } from "@prismabox/Post";',
        'import { Role } from "@prismabox/Role";',
      ].join("\n"),
    });

    await migrateProject({ cwd: project.dir, force: true, dryRun: false });

    const source = await project.read("src/app.ts");
    expect(source).toContain('from "@prismabox/models/Post"');
    expect(source).toContain('from "@prismabox/enums"');
  });

  test("collects enum names across multiple schema files", async () => {
    // The enum lives in a different .prisma file than the generator block;
    // import rewriting still has to know Role is an enum, not a model.
    project = await createTempProject({
      "prisma/schema.prisma": `generator prismabox {
  provider = "prismabox"
  output   = "./generated/schema"
}`,
      "prisma/enums.prisma": `enum Role {
  ADMIN
}`,
      "src/app.ts": 'import { Role } from "../generated/schema/Role";',
    });

    await migrateProject({ cwd: project.dir, force: true, dryRun: false });

    expect(await project.read("src/app.ts")).toContain('from "../generated/schema/enums"');
  });

  test("is a no-op when no prismabox generator block exists", async () => {
    const source = 'import { Post } from "./generated/schema/Post";';
    project = await createTempProject({
      "prisma/schema.prisma": `generator client {
  provider = "prisma-client-js"
}`,
      "src/app.ts": source,
    });

    const edits = await migrateProject({ cwd: project.dir, force: true, dryRun: false });

    // Without an output dir there is nothing to anchor imports on, so sources
    // are deliberately left alone rather than guessed at.
    expect(edits).toHaveLength(0);
    expect(await project.read("src/app.ts")).toBe(source);
  });

  test("is idempotent across a second run", async () => {
    project = await createTempProject({
      "prisma/schema.prisma": PRISMABOX_SCHEMA,
      "src/app.ts": 'import { Post } from "../generated/schema/Post";',
      "package.json": JSON.stringify({ name: "app", devDependencies: { prismabox: "^1.0.0" } }),
    });

    await migrateProject({ cwd: project.dir, force: true, dryRun: false });
    const afterFirst = {
      schema: await project.read("prisma/schema.prisma"),
      source: await project.read("src/app.ts"),
      manifest: await project.read("package.json"),
    };

    const secondEdits = await migrateProject({ cwd: project.dir, force: true, dryRun: false });

    expect(secondEdits).toHaveLength(0);
    expect(await project.read("prisma/schema.prisma")).toBe(afterFirst.schema);
    expect(await project.read("src/app.ts")).toBe(afterFirst.source);
    expect(await project.read("package.json")).toBe(afterFirst.manifest);
  });

  test("succeeds without a package.json", async () => {
    project = await createTempProject({
      "prisma/schema.prisma": PRISMABOX_SCHEMA,
      "src/app.ts": 'import { Post } from "../generated/schema/Post";',
    });

    const edits = await migrateProject({ cwd: project.dir, force: true, dryRun: false });

    expect(editFor(edits, project.dir, "src/app.ts")).toBeDefined();
    expect(editFor(edits, project.dir, "package.json")).toBeUndefined();
  });

  test("throws when no .prisma schema is found", async () => {
    project = await createTempProject({ "src/app.ts": "export const x = 1;" });

    await expect(migrateProject({ cwd: project.dir, force: true, dryRun: false })).rejects.toThrow(
      /No .prisma schema found/,
    );
  });

  test("writes schema files without a BOM", async () => {
    // Prisma's parser rejects a BOM, and Windows toolchains add one readily.
    project = await createTempProject({ "prisma/schema.prisma": PRISMABOX_SCHEMA });

    await migrateProject({ cwd: project.dir, force: true, dryRun: false });

    const bytes = await Bun.file(join(project.dir, "prisma/schema.prisma")).bytes();
    expect([bytes[0], bytes[1], bytes[2]]).not.toEqual([0xef, 0xbb, 0xbf]);
  });
});

describe("migrateProject working-tree guard", () => {
  test("refuses to write outside a git repository", async () => {
    project = await createTempProject({ "prisma/schema.prisma": PRISMABOX_SCHEMA });

    await expect(migrateProject({ cwd: project.dir, force: false, dryRun: false })).rejects.toThrow(
      /not a git repository/,
    );

    // The guard fires before anything is written.
    expect(await project.read("prisma/schema.prisma")).toBe(PRISMABOX_SCHEMA);
  });

  test("refuses to write when the working tree is dirty", async () => {
    project = await createTempProject({ "prisma/schema.prisma": PRISMABOX_SCHEMA });
    project.git();
    await project.write("prisma/schema.prisma", `${PRISMABOX_SCHEMA}\n// edited`);

    await expect(migrateProject({ cwd: project.dir, force: false, dryRun: false })).rejects.toThrow(
      /uncommitted changes/,
    );
  });

  test("writes when the tree is clean", async () => {
    project = await createTempProject({ "prisma/schema.prisma": PRISMABOX_SCHEMA });
    project.git();

    const edits = await migrateProject({ cwd: project.dir, force: false, dryRun: false });

    expect(edits.length).toBeGreaterThan(0);
    expect(await project.read("prisma/schema.prisma")).toContain('provider = "prismatype"');
  });

  test("dryRun bypasses the guard entirely", async () => {
    // No git repo at all, which would otherwise be refused.
    project = await createTempProject({ "prisma/schema.prisma": PRISMABOX_SCHEMA });

    const edits = await migrateProject({ cwd: project.dir, force: false, dryRun: true });

    expect(edits.length).toBeGreaterThan(0);
  });
});

describe("formatReport", () => {
  test("reports nothing to migrate for an empty run", () => {
    expect(formatReport([], "/project", false)).toBe(
      "Nothing to migrate: no prismabox references found.",
    );
  });

  test("totals changes and lists relative paths", () => {
    const edits = [
      {
        path: join("/project", "prisma", "schema.prisma"),
        changes: [{ description: "provider", count: 1 }],
      },
      {
        path: join("/project", "src", "app.ts"),
        changes: [
          { description: "model imports", count: 3 },
          { description: "enum imports", count: 2 },
        ],
      },
    ];

    const report = formatReport(edits, "/project", false);

    expect(report).toContain("Applied 6 change(s) across 2 file(s):");
    expect(report).toContain("3x  model imports");
    expect(report).toContain("Next steps:");
  });

  test("uses would-apply wording and a re-run hint under dryRun", () => {
    const edits = [{ path: join("/project", "a.ts"), changes: [{ description: "x", count: 1 }] }];

    const report = formatReport(edits, "/project", true);

    expect(report).toContain("Would apply 1 change(s)");
    expect(report).toContain("Re-run without --dry-run");
    expect(report).not.toContain("Next steps:");
  });
});

describe("runMigrateCli", () => {
  test("prints usage and exits 0 for --help", async () => {
    expect(await runMigrateCli(["--help"])).toBe(0);
    expect(await runMigrateCli(["-h"])).toBe(0);
  });

  test("migrates the directory given by --cwd", async () => {
    project = await createTempProject({ "prisma/schema.prisma": PRISMABOX_SCHEMA });

    const code = await runMigrateCli(["--cwd", project.dir, "--force"]);

    expect(code).toBe(0);
    expect(await project.read("prisma/schema.prisma")).toContain('provider = "prismatype"');
  });

  test("honours --dry-run", async () => {
    project = await createTempProject({ "prisma/schema.prisma": PRISMABOX_SCHEMA });

    const code = await runMigrateCli(["--cwd", project.dir, "--dry-run"]);

    expect(code).toBe(0);
    expect(await project.read("prisma/schema.prisma")).toBe(PRISMABOX_SCHEMA);
  });

  test("returns 1 when the migration fails", async () => {
    // No schema anywhere, so migrateProject throws and the CLI reports it.
    project = await createTempProject({ "src/app.ts": "export const x = 1;" });

    expect(await runMigrateCli(["--cwd", project.dir, "--force"])).toBe(1);
  });

  test("returns 1 rather than writing into a dirty tree", async () => {
    project = await createTempProject({ "prisma/schema.prisma": PRISMABOX_SCHEMA });
    project.git();
    await project.write("extra.ts", "export const y = 2;");

    expect(await runMigrateCli(["--cwd", project.dir])).toBe(1);
    expect(await project.read("prisma/schema.prisma")).toBe(PRISMABOX_SCHEMA);
  });
});
