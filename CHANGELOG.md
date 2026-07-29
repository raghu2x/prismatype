# Changelog

All notable changes to PrismaType are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  `.ts` file per model into the configured `output` directory.
- Each generate run also emits a shared `enums.ts`, a `barrel.ts` re-export, and the
  `__nullable__` / `__transformDate__` helpers.
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

[1.0.1]: https://github.com/raghu2x/prismatype/releases/tag/v1.0.1
[1.0.0]: https://github.com/raghu2x/prismatype/releases/tag/v1.0.0
