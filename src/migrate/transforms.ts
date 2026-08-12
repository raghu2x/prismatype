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
 * `outputAnchors` is the set of path fragments that identify the generated tree:
 * the output directory's own name (e.g. `schema` for `./generated/schema`), plus
 * any tsconfig alias that resolves to it (e.g. `@prismabox`). When several
 * anchors match, the longest wins so an aliased path keeps its full prefix.
 */
export function migrateImportSpecifier(
  specifier: string,
  outputAnchors: ReadonlySet<string> | string,
  enumNames: ReadonlySet<string>,
): string | undefined {
  const anchors = typeof outputAnchors === "string" ? [outputAnchors] : Array.from(outputAnchors);

  // Try every known anchor and keep the longest match. A tsconfig alias that
  // points straight at the output dir (e.g. "@prismabox" -> generated/prismabox)
  // has no leading segment, so `(?:^|/)` must be able to match at position 0;
  // preferring the longest prefix keeps "@generated/prismabox" from being
  // matched on the shorter bare "prismabox" anchor alone.
  let prefix: string | undefined;
  let rest: string | undefined;

  for (const anchor of anchors) {
    const match = specifier.match(new RegExp(`^(.*(?:^|/)${escapeRegExp(anchor)})/(.+)$`));
    if (match && (prefix === undefined || (match[1]?.length ?? 0) > prefix.length)) {
      prefix = match[1];
      rest = match[2];
    }
  }

  if (prefix === undefined || rest === undefined) {
    return undefined;
  }

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
 * the generated output directory. TypeBox imports are deliberately untouched:
 * which TypeBox package to import from is the user's decision.
 *
 * Matching is done on the specifier string inside import/export/`require`/dynamic
 * -import syntax rather than by parsing, which keeps the codemod dependency-free
 * and is safe because only the quoted specifier is ever rewritten.
 */
export function migrateSourceImports(
  content: string,
  outputAnchors: ReadonlySet<string> | string,
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
      const rewritten = migrateImportSpecifier(specifier, outputAnchors, enumNames);
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

  // Collapsing per-enum files into one shared `enums` module turns N separate
  // enum imports into N imports of the same module, so merge them.
  const merged = mergeDuplicateImports(result);
  result = merged.content;
  changes.push(...merged.changes);

  return { content: result, changes };
}

/**
 * Merges repeated plain named imports from the same module into one statement.
 *
 * Only the simplest, unambiguous shape is merged: single-line
 * `import { A, B } from "x";` statements with no default or namespace binding.
 * Type-only imports are merged separately from value imports so
 * `import type` never absorbs a value binding (or vice versa), and anything
 * else (default imports, `import * as`, side-effect imports, multi-line
 * statements) is left untouched.
 */
export function mergeDuplicateImports(content: string): TransformResult {
  const changes: Change[] = [];

  // A whole-line named import: optional `type`, a braced clause with no nested
  // braces, and a quoted module. Anchored per line so multi-line imports and
  // any statement sharing a line are skipped.
  const namedImport =
    /^([^\S\n]*)import\s+(type\s+)?\{([^{}]*)\}\s*from\s*(["'])([^"']+)\4;?[^\S\n]*$/;

  const lines = content.split("\n");
  // Grouped by module, then by kind, so value and type imports of the same
  // module never merge into each other. Nesting the maps keeps the module name
  // an untouched key rather than packing two values into one string.
  const groups = new Map<
    string,
    Map<"type" | "value", { indices: number[]; specifiers: string[] }>
  >();

  lines.forEach((line, index) => {
    const match = line.match(namedImport);
    if (!match) {
      return;
    }

    const moduleName = match[5];
    if (moduleName === undefined) {
      return;
    }

    const kind: "type" | "value" = match[2] ? "type" : "value";
    const specifiers = (match[3] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const byKind =
      groups.get(moduleName) ??
      new Map<"type" | "value", { indices: number[]; specifiers: string[] }>();
    const group = byKind.get(kind) ?? { indices: [], specifiers: [] };
    group.indices.push(index);
    group.specifiers.push(...specifiers);
    byKind.set(kind, group);
    groups.set(moduleName, byKind);
  });

  const removed = new Set<number>();
  let mergedCount = 0;

  for (const [moduleName, byKind] of groups) {
    for (const [kind, group] of byKind) {
      if (group.indices.length < 2) {
        continue;
      }

      const first = group.indices[0];
      if (first === undefined) {
        continue;
      }

      // Deduplicate while preserving first-seen order, so `A, A` becomes `A`.
      const unique = Array.from(new Set(group.specifiers));
      const source = lines[first] ?? "";
      const indent = source.match(/^[^\S\n]*/)?.[0] ?? "";
      const quote = source.includes("'") ? "'" : '"';
      const semicolon = source.trimEnd().endsWith(";") ? ";" : "";
      const typeKeyword = kind === "type" ? "type " : "";

      lines[first] =
        `${indent}import ${typeKeyword}{ ${unique.join(", ")} } from ${quote}${moduleName}${quote}${semicolon}`;

      for (const index of group.indices.slice(1)) {
        removed.add(index);
      }

      mergedCount += group.indices.length - 1;
    }
  }

  if (mergedCount === 0) {
    return { content, changes };
  }

  pushChange(changes, "merged duplicate imports of the same module", mergedCount);

  return { content: lines.filter((_, index) => !removed.has(index)).join("\n"), changes };
}

/**
 * Swaps the generator dependency in a package.json: drops prismabox and adds
 * prismatype as a dev dependency.
 *
 * TypeBox is deliberately left alone. Which TypeBox package a project depends
 * on (and at which version) is the user's call, so the codemod neither removes
 * `@sinclair/typebox` nor installs `typebox`.
 *
 * Operates on the raw text so key order, indentation, and any comments-free
 * formatting the user has are preserved as much as JSON round-tripping allows.
 * Returns the new manifest text plus the list of changes.
 */
export function migratePackageJson(
  content: string,
  versions: { prismatype: string },
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
    if ("prismabox" in record) {
      delete record.prismabox;
      removed++;
    }
  }

  pushChange(changes, "removed prismabox", removed);

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

  pushChange(changes, "added prismatype", added);

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
