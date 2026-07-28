# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

prismatype is a Prisma generator that emits [TypeBox](https://github.com/sinclairzx81/typebox) schemas from a Prisma schema. It runs as a `prisma generate` plugin: Prisma parses the schema, hands prismatype the DMMF (Data Model Meta Format), and prismatype writes `.ts` files of TypeBox schema objects to the configured output directory.

The generated code is **stringly-typed**: generators produce TypeScript _source strings_ (e.g. `` `Type.Object({...})` ``), not TypeBox schema objects. Nothing is evaluated against the real TypeBox library at generation time — that only happens when a consumer imports the output. This is why so much logic is string concatenation.

## Commands

Runtime is **Bun**. Linting/formatting is **oxc** (`oxlint` + `oxfmt`), not ESLint/Prettier.

- `bun run build` — typecheck then bundle `src/cli.ts` → `dist/cli.js` (CJS, minified) via `build.ts`
- `bun run dev` — build, then run `prisma generate` against `prisma/schema.prisma` (regenerates `prisma/generated/`)
- `bun run typecheck` — `tsc --noEmit`
- `bun run lint` — `oxlint --fix`
- `bun run test` — `bun test` (built-in Bun runner; tests live in `test/`)
- `bun run check` — `oxlint && oxfmt --check && bun test` (this is what CI runs; no `--fix`)
- `bun run format` — `oxfmt`

### Testing

Tests use the built-in **`bun test`** runner (Jest-compatible `describe`/`test`/`expect`), no extra deps.

- `test/helpers.ts` — `resetConfig(overrides?)` resets the global config singleton to defaults; call it in `beforeEach` since generators read config via `getConfig()`.
- `test/fixtures/dmmf.ts` — `field()` / `model()` / `datamodelEnum()` factories for hand-built DMMF.
- Most tests assert the generated **source strings** (`toContain`/`toBe`). `test/e2e.test.ts` goes further: it `eval`s generated strings against the real `typebox` package and runs `Value.Check` on sample data, so it verifies the emitted code actually builds a working schema — not just that the string matches.

Manual verification is still useful for whole-schema output: change code, `bun run dev`, inspect `prisma/generated/schema/` (snapshot before/after since that dir is gitignored).

## Architecture

### Pipeline (`src/index.ts`)

`generatorHandler.onGenerate` is the entry point. Per generate run it:

1. `setConfig()` from the generator block (merged with the resolved `output` path)
2. wipes and recreates the output directory
3. calls each `process*` generator, collecting their returned `ProcessedModel[]` arrays into a single `Collections` object (input-model generators are only run when `inputModel` is set; otherwise their entries default to `[]`)
4. `write(collections)` flushes everything to disk

### Two-phase generator pattern (important)

Every generator in `src/generators/` follows the same shape:

- **Phase 1 — `processX(models, ...)`**: called from `index.ts`. Builds strings and **returns** a `ProcessedModel[]` (`{ name, stringRepresentation }`). Generators are pure functions of their inputs — no module-level state, no `Object.freeze`, re-runnable in-process. Cross-generator dependencies are passed **explicitly as parameters**, not read from globals: `processedEnums` flows into `plain`/`where`/`relations`, and `processedPlain` flows into `relations` (which inlines related models' plain schemas).
- **Phase 2 — `src/model.ts`**: `mapAllModelsForWrite(collections)` takes the `Collections` object (all the phase-1 return arrays), groups entries by model name, and appends suffixes (`Plain`, `Relations`, `Where`, `Select`, `InputCreate`, etc.). It also synthesizes the composite `Model = Composite([ModelPlain, ModelRelations])` and prepends the required import statements (TypeBox import, enum imports, `__nullable__`, `__transformDate__`) per file.

So generators **don't** know about imports or file layout — they only produce named schema strings. `model.ts` owns assembly; `writer.ts` (`src/writer.ts`) formats each file with `oxfmt` and writes it, plus a `barrel.ts` re-export file.

The shared "map one Prisma field → TypeBox type string" logic (scalar / `typeOverwrite` / enum, or `undefined` for relations) lives in one place: `stringifyFieldType` in `src/generators/fieldType.ts`, reused by the `plain` and `where`/`whereUnique` generators. Callers still own list-wrapping, nullability, optionality and hidden-field filtering.

### Config (`src/config.ts`)

Config is itself validated with a TypeBox `Type.Object` schema and stored in a frozen module-level singleton. Access it **only** via `getConfig()` — it's imported all over the generators. `setConfig` runs `Value.Clean` → `Value.Default` → `Value.Convert` → `Value.Decode` so string values from the Prisma generator block get coerced to their declared types. All generator options and their defaults live here (the README points users here for the "advanced" options).

### Annotations (`src/annotations/`)

Prisma field/model doc comments (`///`) carry prismatype directives like `@prismatype.hide`, `@prismatype.options{...}`, `@prismatype.typeOverwrite=...`. `extractAnnotations()` parses a documentation string into `{ annotations, description, isHidden* }`. `annotationKeys` ordering is deliberate — more specific keys (e.g. `input.hide`) must be matched before substrings of longer keys. `generateTypeboxOptions()` (`options.ts`) turns annotations + config into the trailing `{...}` options string appended to each `Type.X(...)` call.

### Primitive mapping (`src/generators/primitiveField.ts`)

Maps Prisma scalar types → TypeBox calls. Key targets **TypeBox >= 1.0 only** (the unscoped `typebox` package):

- `DateTime` / `Bytes` → `Type.Refine(Type.Unsafe<...>(...), (v) => v instanceof ...)` because 1.x removed `Type.Date`/`Type.Uint8Array`
- `DateTime` also branches on `useJsonTypes` (`true` → formatted string, `"transformer"` → `__transformDate__` codec)

### Wrappers (`src/generators/wrappers/`)

Small string transformers composed onto field types: `wrapWithArray`, `wrapWithNullable` (emits the `__nullable__` helper allowing `null` _and_ `undefined`, distinct from `Type.Optional`), `wrapWithOptional`, `makeComposite` (emits `Type.Evaluate(Type.Intersect([...]))` for 1.x), `partial`, `union`, `enum`.

## Gotchas

- **`prisma/generated/` is gitignored.** A clean `git diff` after regenerating proves nothing about output changes — to check output diffs, snapshot before/after manually.
- **TypeBox 1.x only.** The legacy 0.x `@sinclair/typebox` API is not supported. See the `typebox-1-migration-facts` memory for verified 1.x API equivalents.
- **Windows / PowerShell 5.1**: `Set-Content -Encoding utf8` writes a BOM, which breaks Prisma's schema parser. Write schema files without a BOM.
- The generated schemas are only "real" once a consumer imports them against the actual `typebox` package; generation itself never evaluates them.
