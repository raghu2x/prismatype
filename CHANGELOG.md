# Changelog

All notable changes to PrismaType are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-08-12

### Fixed

- **`prismatype migrate`** now rewrites imports written through a tsconfig path
  alias that resolves to the generated output directory. Previously an alias
  pointing straight at the output root (e.g. `"@prismabox/*": ["./generated/prismabox/*"]`)
  was skipped entirely, because matching anchored on the output directory's name
  and such an alias replaces that name rather than prefixing it. Aliases are now
  read from `tsconfig.json` and used as additional anchors, so
  `@prismabox/Section` becomes `@prismabox/models/Section`. Where several anchors
  match, the longest wins, keeping the full alias prefix intact.

### Changed

- **`prismatype migrate`** no longer touches TypeBox. It previously removed
  `@sinclair/typebox` from `package.json`, added `typebox`, and rewrote
  `@sinclair/typebox` imports in source. Which TypeBox package a project depends
  on (and at which version) is the user's decision, so the codemod now confines
  itself to prismabox and prismatype; the `package.json` step only removes
  `prismabox` and adds `prismatype`. The TypeBox swap is documented as a manual
  step in [Migrating from prismabox](/guide/migrating-from-prismabox).

### Added

- **`prismatype migrate`** merges duplicate imports left behind by the migration.
  Collapsing the per-enum files into one shared `enums` module turns several enum
  imports into several imports of the same module; these are now combined into a
  single statement. Merging is limited to single-line named imports, with
  type-only imports merged separately from value imports so bindings never cross
  between them; default, namespace, and multi-line imports are left untouched.

## [1.2.0] - 2026-08-12

### Added

- **`prismatype migrate`** codemod that automates the mechanical parts of migrating
  from prismabox. It renames the generator block and its `provider`, rewrites
  `@prismabox.*` annotations to `@prismatype.*`, updates imports of the generated
  output (per-enum imports collapse to the shared `enums` file, model imports move
  under `models/`, `barrel` becomes `model`, and `@sinclair/typebox` is repointed at
  `typebox`), and swaps the `package.json` dependencies. When a generator block never
  set `output`, the old prismabox default (`./prisma/prismabox`) is pinned explicitly
  so existing import paths keep working rather than silently relocating. Writing
  requires a clean git working tree (`--force` overrides, `--dry-run` previews);
  installing dependencies and regenerating are left to you. See
  [Migrating from prismabox](/guide/migrating-from-prismabox#automated-migration-codemod).
- **`deriveDbStringConstraints`** generator option (default `false`). When enabled,
  length-bearing native column types (`@db.VarChar(n)`, `@db.Char(n)` and their
  provider variants) contribute a `maxLength: n` constraint to the generated string
  schema. The constraint is applied to the input models only (`InputCreate` and
  `InputUpdate`); the plain output model and `Where` schemas are left unconstrained.
  An explicit `@prismatype.options{maxLength}` overrides the derived value, and fields
  with a `@prismatype.typeOverwrite` are skipped. This is the first use of the DMMF's
  `field.nativeType`. See [Configuration](/guide/configuration#derivedbstringconstraints).

## [1.1.0] - 2026-08-05

### Changed

- Per-model files are now emitted into a `models/` subdirectory of the `output`
  directory, and the re-export barrel is a root-level `model.ts` (replacing the
  previous `barrel.ts`) that re-exports every model file. Because model files sit
  one directory deeper, their imports of the shared `enums.ts` and helper files use
  `../`.
- The bundled CLI (`dist/cli.js`) is now built as ESM instead of CJS.

## [1.0.1] - 2026-07-29

### Recursion

- Migrated recursive `Where` and `WhereUnique` schemas from `Type.Recursive` (with a
  self-referencing callback) to `Type.Cyclic` with `Type.Ref`. Each cyclic schema is
  now keyed by its model name, and the generated `AND` / `OR` / `NOT` clauses
  reference that model via `Type.Ref` rather than an inline `Self` binding.
- This brings the emitted recursive schemas in line with the TypeBox 1.x reference
  model.

## [1.0.0] - 2026-07-29

PrismaType is a Prisma generator that emits
[TypeBox](https://github.com/sinclairzx81/typebox) schemas from your Prisma schema
as part of `prisma generate`, giving you a single source of truth for runtime
validation (`Value.Check`) and compile-time types (`Static`).

### Generator

- Runs as a `prisma generate` plugin: PrismaType consumes the DMMF and writes one
  `.ts` file per model into a `models/` subdirectory of the configured `output`
  directory.
- Each generate run also emits, at the output root, a shared `enums.ts`, a `model.ts`
  re-export of every model file, and the `__nullable__` / `__transformDate__` helpers.
- Targets **TypeBox 1.x**, using `Type.Refine` wrappers for `DateTime` and `Bytes`
  in place of the removed `Type.Date` / `Type.Uint8Array`.

### Schemas

- **Per-model**: `Plain`, `Relations`, and the composite
  `Model = Composite([ModelPlain, ModelRelations])`.
- **Query**: `Where`, `WhereUnique`, `Select`, and `Include`.
- **Input**: `InputCreate`, `InputUpdate`, and related schemas, generated when
  `inputModel` is enabled.
- **Recursion**: self-referencing `Where` / `WhereUnique` schemas via the
  `allowRecursion` option.

### Data types

- **MongoDB composite types**: `type` blocks are resolved and inlined at every use
  site, with nested-composite resolution and cycle handling.
- **`DateTime` formatting** through `useJsonTypes`, supporting a formatted-string
  mode and a `"transformer"` codec mode backed by the `__transformDate__` helper.

### Customization

- **Annotations** via Prisma doc comments (`///`): `@prismatype.hide`,
  `@prismatype.options{...}`, `@prismatype.typeOverwrite=...`, and input-specific
  variants.
- **Configuration** through the generator block, including `output`, `inputModel`,
  `allowRecursion`, `useJsonTypes`, `additionalProperties`, and a configurable
  TypeBox import variable name. All options are validated with a TypeBox schema.

[1.2.1]: https://github.com/raghu2x/prismatype/releases/tag/v1.2.1
[1.2.0]: https://github.com/raghu2x/prismatype/releases/tag/v1.2.0
[1.1.0]: https://github.com/raghu2x/prismatype/releases/tag/v1.1.0
[1.0.1]: https://github.com/raghu2x/prismatype/releases/tag/v1.0.1
[1.0.0]: https://github.com/raghu2x/prismatype/releases/tag/v1.0.0
