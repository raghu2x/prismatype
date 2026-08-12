import { describe, expect, test } from "bun:test";
import { readEnumNames, readTsconfigAliases } from "../src/migrate/index";
import {
  mergeDuplicateImports,
  migrateAnnotations,
  migrateImportSpecifier,
  migratePackageJson,
  migrateSchema,
  migrateSourceImports,
} from "../src/migrate/transforms";

const VERSIONS = { prismatype: "^1.2.1" };

describe("migrateSchema", () => {
  test("renames the generator block, provider, and annotations", () => {
    const input = `generator prismabox {
  provider   = "prismabox"
  output     = "./generated/schema"
  inputModel = true
}

model Post {
  /// @prismabox.hide
  secret String
  /// @prismabox.input.hide
  internal String
}`;

    const result = migrateSchema(input);

    expect(result.content).toContain("generator prismatype {");
    expect(result.content).toContain('provider   = "prismatype"');
    expect(result.content).toContain("@prismatype.hide");
    expect(result.content).toContain("@prismatype.input.hide");
    expect(result.content).not.toContain("prismabox");
    expect(result.previousOutput).toBe("./generated/schema");
  });

  test("preserves an explicit output path", () => {
    const input = `generator prismabox {
  provider = "prismabox"
  output   = "./generated/schema"
}`;

    const result = migrateSchema(input);

    expect(result.content).toContain('output   = "./generated/schema"');
    expect(result.previousOutput).toBe("./generated/schema");
  });

  test("pins the previously-default output so import paths do not move", () => {
    // prismabox defaults to ./prisma/prismabox, PrismaType to ./prisma/prismatype.
    // Without pinning, generated files would silently relocate.
    const input = `generator prismabox {
  provider = "prismabox"
}`;

    const result = migrateSchema(input);

    expect(result.content).toContain('output   = "./prisma/prismabox"');
    expect(result.previousOutput).toBe("./prisma/prismabox");
  });

  test("aligns the injected output line with the block's existing = column", () => {
    const input = `generator prismabox {
  provider   = "prismabox"
  inputModel = true
}`;

    const result = migrateSchema(input);

    // "provider   =" pads to column 13, so "output" must pad to match.
    expect(result.content).toContain('  output     = "./prisma/prismabox"');
  });

  test("keeps a custom generator block name", () => {
    const input = `generator typeboxSchemas {
  provider = "prismabox"
}`;

    const result = migrateSchema(input);

    expect(result.content).toContain("generator typeboxSchemas {");
    expect(result.content).toContain('provider = "prismatype"');
  });

  test("leaves unrelated generator blocks alone", () => {
    const input = `generator client {
  provider = "prisma-client-js"
}

generator prismabox {
  provider = "prismabox"
  output   = "./gen"
}`;

    const result = migrateSchema(input);

    expect(result.content).toContain('provider = "prisma-client-js"');
    expect(result.content).toContain('provider = "prismatype"');
  });

  test("reports no prismabox block when none exists", () => {
    const input = `generator client {
  provider = "prisma-client-js"
}`;

    expect(migrateSchema(input).previousOutput).toBeUndefined();
  });

  test("is idempotent", () => {
    const input = `generator prismabox {
  provider = "prismabox"
  output   = "./gen"
}

model Post {
  /// @prismabox.hide
  secret String
}`;

    const once = migrateSchema(input).content;
    const twice = migrateSchema(once).content;

    expect(twice).toBe(once);
  });
});

describe("migrateAnnotations", () => {
  test("rewrites every annotation variant", () => {
    const input = [
      "@prismabox.hide",
      "@prismabox.hidden",
      "@prismabox.input.hide",
      "@prismabox.create.input.hide",
      "@prismabox.update.input.hide",
      "@prismabox.options{ minLength: 2 }",
      "@prismabox.typeOverwrite=Type.String()",
    ].join("\n");

    const result = migrateAnnotations(input);

    expect(result.content).not.toContain("@prismabox.");
    expect(result.content).toContain("@prismatype.create.input.hide");
    expect(result.content).toContain("@prismatype.options{ minLength: 2 }");
    expect(result.content).toContain("@prismatype.typeOverwrite=Type.String()");
    expect(result.changes[0]?.count).toBe(7);
  });
});

describe("migrateImportSpecifier", () => {
  const enums = new Set(["Role", "Status"]);

  test("moves a model file under models/", () => {
    expect(migrateImportSpecifier("./generated/schema/Post", "schema", enums)).toBe(
      "./generated/schema/models/Post",
    );
  });

  test("collapses a per-enum file into the shared enums file", () => {
    expect(migrateImportSpecifier("./generated/schema/Role", "schema", enums)).toBe(
      "./generated/schema/enums",
    );
  });

  test("renames barrel to model", () => {
    expect(migrateImportSpecifier("./generated/schema/barrel", "schema", enums)).toBe(
      "./generated/schema/model",
    );
  });

  test("preserves an explicit file extension", () => {
    expect(migrateImportSpecifier("./generated/schema/Post.js", "schema", enums)).toBe(
      "./generated/schema/models/Post.js",
    );
  });

  test("ignores specifiers outside the output directory", () => {
    expect(migrateImportSpecifier("./lib/Post", "schema", enums)).toBeUndefined();
    expect(migrateImportSpecifier("typebox", "schema", enums)).toBeUndefined();
  });

  test("leaves already-migrated specifiers untouched", () => {
    expect(
      migrateImportSpecifier("./generated/schema/models/Post", "schema", enums),
    ).toBeUndefined();
    expect(migrateImportSpecifier("./generated/schema/enums", "schema", enums)).toBeUndefined();
    expect(migrateImportSpecifier("./generated/schema/model", "schema", enums)).toBeUndefined();
  });

  test("resolves paths that traverse upward", () => {
    expect(migrateImportSpecifier("../../generated/schema/Post", "schema", enums)).toBe(
      "../../generated/schema/models/Post",
    );
  });

  test("rewrites a tsconfig alias that points straight at the output dir", () => {
    // "@prismabox" -> generated/prismabox: the alias replaces the directory
    // name entirely, so there is no leading path segment to anchor on.
    const anchors = new Set(["prismabox", "@prismabox"]);

    expect(migrateImportSpecifier("@prismabox/Section", anchors, enums)).toBe(
      "@prismabox/models/Section",
    );
    expect(migrateImportSpecifier("@prismabox/Role", anchors, enums)).toBe("@prismabox/enums");
  });

  test("prefers the longest matching anchor", () => {
    // Both "prismabox" and "@generated/prismabox" match; the longer prefix must
    // win so the rewritten path keeps its full alias.
    const anchors = new Set(["prismabox", "@generated/prismabox"]);

    expect(migrateImportSpecifier("@generated/prismabox/Post", anchors, enums)).toBe(
      "@generated/prismabox/models/Post",
    );
  });
});

describe("readTsconfigAliases", () => {
  const outputs = new Set(["generated/prismabox"]);

  test("finds aliases pointing at the output directory", () => {
    const tsconfig = `{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@generated/*": ["./generated/*"],
      "@prismabox/*": ["./generated/prismabox/*"]
    }
  }
}`;

    const aliases = readTsconfigAliases(tsconfig, outputs);

    expect(aliases.has("@prismabox")).toBe(true);
    // "@generated" points at the parent, which already matches via the output
    // directory's own name, so it is not needed as an extra anchor.
    expect(aliases.has("@generated")).toBe(false);
    expect(aliases.has("@")).toBe(false);
  });

  test("tolerates comments and trailing commas", () => {
    const tsconfig = `{
  // tsconfig allows comments
  "compilerOptions": {
    /* and block comments */
    "paths": {
      "@prismabox/*": ["./generated/prismabox/*"],
    },
  },
}`;

    expect(readTsconfigAliases(tsconfig, outputs).has("@prismabox")).toBe(true);
  });

  test("returns nothing for an unparseable or path-less tsconfig", () => {
    expect(readTsconfigAliases("{ not json", outputs).size).toBe(0);
    expect(readTsconfigAliases('{"compilerOptions":{}}', outputs).size).toBe(0);
  });
});

describe("mergeDuplicateImports", () => {
  test("merges repeated imports of the same module", () => {
    const input = [
      "import { ChargeSource } from '@prismabox/enums';",
      "import { PaymentMode } from '@prismabox/enums';",
      "import { FeeStatus } from '@prismabox/enums';",
      "const x = 1;",
    ].join("\n");

    const result = mergeDuplicateImports(input);

    expect(result.content).toBe(
      "import { ChargeSource, PaymentMode, FeeStatus } from '@prismabox/enums';\nconst x = 1;",
    );
  });

  test("keeps type-only and value imports separate", () => {
    const input = [
      "import type { T } from './e';",
      "import { V } from './e';",
      "import type { U } from './e';",
    ].join("\n");

    const result = mergeDuplicateImports(input);

    expect(result.content).toContain("import type { T, U } from './e';");
    expect(result.content).toContain("import { V } from './e';");
  });

  test("preserves aliased specifiers and drops exact duplicates", () => {
    expect(
      mergeDuplicateImports("import { A as B } from './e';\nimport { C } from './e';").content,
    ).toBe("import { A as B, C } from './e';");

    expect(
      mergeDuplicateImports("import { A } from './e';\nimport { A } from './e';").content,
    ).toBe("import { A } from './e';");
  });

  test("leaves default, namespace, and single imports alone", () => {
    const untouched = [
      "import D from './e';\nimport { A } from './e';",
      "import * as N from './e';\nimport { A } from './e';",
      "import { A } from './a';\nimport { B } from './b';",
    ];

    for (const input of untouched) {
      expect(mergeDuplicateImports(input).content).toBe(input);
    }
  });
});

describe("migrateSourceImports", () => {
  const enums = new Set(["Role"]);

  test("rewrites import, export, dynamic import and require", () => {
    const input = [
      'import { Post } from "./generated/schema/Post";',
      'export { Role } from "./generated/schema/Role";',
      'const m = await import("./generated/schema/barrel");',
      'const r = require("./generated/schema/User");',
    ].join("\n");

    const result = migrateSourceImports(input, "schema", enums);

    expect(result.content).toContain('from "./generated/schema/models/Post"');
    expect(result.content).toContain('from "./generated/schema/enums"');
    expect(result.content).toContain('import("./generated/schema/model")');
    expect(result.content).toContain('require("./generated/schema/models/User")');
  });

  test("leaves TypeBox imports untouched", () => {
    // Which TypeBox package to import from is the user's call, so the codemod
    // must not rewrite it in either direction.
    const input =
      'import { Type } from "@sinclair/typebox";\nimport { Value } from "@sinclair/typebox/value";';
    const result = migrateSourceImports(input, "schema", enums);

    expect(result.content).toBe(input);
    expect(result.changes).toHaveLength(0);
  });

  test("leaves unrelated source untouched", () => {
    const input = 'import { z } from "zod";\nconst schema = "./generated/schema/Post";';
    const result = migrateSourceImports(input, "schema", enums);

    expect(result.changes).toHaveLength(0);
    expect(result.content).toBe(input);
  });

  test("is idempotent", () => {
    const input = 'import { Post } from "./generated/schema/Post";';
    const once = migrateSourceImports(input, "schema", enums).content;
    const twice = migrateSourceImports(once, "schema", enums).content;

    expect(twice).toBe(once);
  });
});

describe("migratePackageJson", () => {
  test("swaps prismabox for prismatype", () => {
    const input = JSON.stringify(
      {
        name: "app",
        dependencies: { "@sinclair/typebox": "^0.34.0", zod: "^3.0.0" },
        devDependencies: { prismabox: "^1.0.0", prisma: "^7.0.0" },
      },
      null,
      2,
    );

    const result = migratePackageJson(input, VERSIONS);
    const parsed = JSON.parse(result.content);

    expect(parsed.devDependencies.prismabox).toBeUndefined();
    expect(parsed.devDependencies.prismatype).toBe(VERSIONS.prismatype);
    // untouched entries survive
    expect(parsed.dependencies.zod).toBe("^3.0.0");
    expect(parsed.devDependencies.prisma).toBe("^7.0.0");
  });

  test("leaves TypeBox dependencies to the user", () => {
    // The codemod neither removes @sinclair/typebox nor installs typebox:
    // choosing the TypeBox package and version is the user's decision.
    const input = JSON.stringify(
      {
        name: "app",
        dependencies: { "@sinclair/typebox": "^0.34.0" },
        devDependencies: { prismabox: "^1.0.0" },
      },
      null,
      2,
    );

    const parsed = JSON.parse(migratePackageJson(input, VERSIONS).content);

    expect(parsed.dependencies["@sinclair/typebox"]).toBe("^0.34.0");
    expect(parsed.dependencies.typebox).toBeUndefined();
    expect(parsed.devDependencies.typebox).toBeUndefined();
  });

  test("does not relocate an already-declared dependency", () => {
    const input = JSON.stringify({ name: "app", dependencies: { prismatype: "^1.0.0" } }, null, 2);

    const result = migratePackageJson(input, VERSIONS);

    expect(result.changes).toHaveLength(0);
    expect(JSON.parse(result.content).devDependencies).toBeUndefined();
  });

  test("returns the input unchanged when the manifest is not valid JSON", () => {
    const input = "{ not json";
    expect(migratePackageJson(input, VERSIONS).content).toBe(input);
  });
});

describe("readEnumNames", () => {
  test("collects enum names from a schema", () => {
    const schema = `enum Role {
  ADMIN
  USER
}

model Post {
  id String @id
}

enum Status {
  DRAFT
}`;

    const names = readEnumNames(schema);

    expect(names.has("Role")).toBe(true);
    expect(names.has("Status")).toBe(true);
    expect(names.has("Post")).toBe(false);
  });
});
