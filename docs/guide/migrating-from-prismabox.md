# Migrating from prismabox

PrismaType began as a fork of [prismabox](https://github.com/m1212e/prismabox), so if
you're coming from prismabox the concepts, generated exports, and annotations will feel
familiar. This guide covers everything that changed and walks through the migration
step by step.

## Should you migrate?

prismabox and PrismaType target different runtimes. Pick based on your stack:

| Your stack                                            | Use                                                      |
| ----------------------------------------------------- | -------------------------------------------------------- |
| **TypeBox 0.x** (`@sinclair/typebox`) or **Elysia 1** | Stay on [prismabox](https://github.com/m1212e/prismabox) |
| **TypeBox 1.x** (`typebox`) or **Elysia 2**           | Use **PrismaType**                                       |

If you're on TypeBox 1.x, migrating is the right call. prismabox's active development is
[on hold](https://github.com/m1212e/prismabox/issues/59), and it does not officially
support the newer runtimes.

### Why PrismaType exists

prismabox is a solid generator, but its original author has paused development. PrismaType
picks up where it left off and adds:

- **TypeBox 1.x support.** prismabox emits the TypeBox 0.x API (`@sinclair/typebox`).
  PrismaType targets the 1.x `typebox` package (see [API differences](#typebox-api-differences)).
- **Prisma 7 support.** prismabox targets Prisma 6 (it can run on 7, but that's not
  officially supported). PrismaType requires Prisma 7.
- **MongoDB composite types.** prismabox
  [does not support](https://github.com/m1212e/prismabox#readme) MongoDB `type` blocks.
  PrismaType resolves and inlines them. See [Generated Schemas](/guide/generated-schemas#mongodb-composite-types).
- **A full documentation site** (this site) instead of a single README.
- **Full test coverage**, including end-to-end tests that evaluate the generated strings
  against the real `typebox` package.

## Requirements

Before migrating, make sure your project meets PrismaType's minimums:

- **Prisma** 7 or newer (prismabox targets Prisma 6)
- **Node.js** 22 or newer
- **TypeBox** 1.x or newer (the unscoped `typebox` package, or a package that re-exports
  the 1.x API, such as Elysia 2)

## Migration steps

### 1. Swap the dependencies

Remove prismabox and the TypeBox 0.x package, then install PrismaType and TypeBox 1.x:

::: code-group

```bash [npm]
npm remove prismabox @sinclair/typebox
npm i -D prismatype
npm i typebox
```

```bash [pnpm]
pnpm remove prismabox @sinclair/typebox
pnpm i -D prismatype
pnpm i typebox
```

```bash [bun]
bun remove prismabox @sinclair/typebox
bun add -D prismatype
bun add typebox
```

:::

::: tip Using Elysia 2?
Elysia 2 re-exports the TypeBox 1.x API, so you can point the generator at Elysia with
`typeboxImportDependencyName = "elysia"` in the generator block (see step 2). You still
need `typebox` installed, though: Elysia depends on it, and the re-exported API won't
resolve without it. Keep `typebox` in your dependencies.
:::

### 2. Update the generator block

Rename the generator and its provider from `prismabox` to `prismatype`:

```prisma
// Before
generator prismabox {
  provider   = "prismabox"
  output     = "./generated/schema"
  inputModel = true
}

// After
generator prismatype {
  provider   = "prismatype"
  output     = "./generated/schema"
  inputModel = true
}
```

Keeping the same `output` path (here `./generated/schema`) means your app's import paths
don't change. The configuration keys are otherwise identical, with two things to note:

- **`typeboxImportDependencyName`** now defaults to `typebox` (it was `@sinclair/typebox`
  in prismabox). If you relied on the default, you don't need to set anything. If you
  import from a re-export like Elysia, keep pointing it there (`"elysia"`).
- **`output`** defaults to `./prisma/prismatype` (prismabox defaulted to
  `./prisma/prismabox`). If you didn't set `output` before and relied on the default,
  either add an explicit `output` or update your import paths to the new default.

Every option prismabox supported is still supported and behaves the same way. See the
[Configuration](/guide/configuration) page for the full list.

### 3. Rename annotations

All `@prismabox.*` doc-comment annotations become `@prismatype.*`. The suffixes are
unchanged, only the namespace differs:

| prismabox                               | PrismaType                                |
| --------------------------------------- | ----------------------------------------- |
| `@prismabox.hide` / `@prismabox.hidden` | `@prismatype.hide` / `@prismatype.hidden` |
| `@prismabox.input.hide`                 | `@prismatype.input.hide`                  |
| `@prismabox.create.input.hide`          | `@prismatype.create.input.hide`           |
| `@prismabox.update.input.hide`          | `@prismatype.update.input.hide`           |
| `@prismabox.options{ ... }`             | `@prismatype.options{ ... }`              |
| `@prismabox.typeOverwrite=...`          | `@prismatype.typeOverwrite=...`           |

A find-and-replace of `@prismabox.` with `@prismatype.` across your `schema.prisma` is
enough. See [Annotations](/guide/annotations) for the full reference.

### 4. Update imports of the generated output

If you kept the same `output` path (as in the example above), your app's import paths
don't change. Only update them if you also changed `output` during the migration, or if
you relied on the old default, in which case the files now live under
`./prisma/prismatype` instead of `./prisma/prismabox`.

Because the output directory is **wiped and recreated on every generate**, you don't need
to delete the old files by hand when the path stays the same. If you moved `output` to a
new directory, remove the stale prismabox directory that PrismaType no longer manages.

### 5. Regenerate

```bash
npx prisma generate
```

Your app-facing imports stay the same: the exported schema names (`PostPlain`,
`PostRelations`, `Post`, `PostWhere`, `PostInputCreate`, etc.) are identical to prismabox.
Only the underlying TypeBox calls change (see below).

## TypeBox API differences

PrismaType emits the **TypeBox 1.x** API, which differs from the 0.x API prismabox emits.
You rarely need to care about this (you import the generated schemas and call
`Value.Check` / `Static` the same way), but if you read or diff the generated output,
these are the notable changes:

| Concern                   | prismabox (TypeBox 0.x)               | PrismaType (TypeBox 1.x)                                                                              |
| ------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Import source             | `@sinclair/typebox`                   | `typebox`                                                                                             |
| `DateTime` / `Bytes`      | `Type.Date()` / `Type.Uint8Array()`   | `Type.Refine(Type.Unsafe<...>(...), ...)` (0.x's `Type.Date` / `Type.Uint8Array` were removed in 1.x) |
| Recursive `Where` schemas | `Type.Recursive` with a self callback | `Type.Cyclic` keyed by model name, referenced via `Type.Ref`                                          |
| Composite `Model` schema  | `Type.Composite([...])`               | `Type.Evaluate(Type.Intersect([...]))`                                                                |

The runtime semantics are equivalent; these are just the 1.x-native ways of expressing the
same shapes. For more on nullability and the `__nullable__` helper (which carries over
from prismabox unchanged), see [TypeBox & Nullability](/guide/typebox).

## Enums

Two things changed for enums. Both are cosmetic; validation behaves identically.

### Enum shape: `Type.Enum` instead of a union of literals

prismabox emits a union of string literals for each enum. PrismaType emits a single
`Type.Enum([...])` call:

```ts
// prismabox (TypeBox 0.x)
export const Role = Type.Union([Type.Literal("ADMIN"), Type.Literal("USER")]);

// PrismaType (TypeBox 1.x)
export const Role = Type.Enum(["ADMIN", "USER"]);
```

This is not a downgrade. In TypeBox 1.x, `Type.Enum(["ADMIN", "USER"])` produces the same
literal-union static type you'd get from the union form:

```ts
type Role = Static<typeof Role>; // "ADMIN" | "USER"
```

`Value.Check` accepts and rejects exactly the same values as the union form. The only
differences are the emitted JSON Schema (`{ enum: [...] }` rather than
`{ anyOf: [{ const: ... }] }`) and that the `Type.Enum` output is far more compact for
large enums.

### One shared enums file instead of one file per enum

prismabox writes **one file per enum**. PrismaType emits a **single shared `enums.ts`**
that every model importing an enum pulls from. Update any imports that reached into a
per-enum file to point at the shared enums file instead:

```ts
// Before (prismabox: one file per enum)
import { Role } from "./generated/schema/Role";
import { Status } from "./generated/schema/Status";

// After (PrismaType: single shared enums file at the output root)
import { Role, Status } from "./generated/schema/enums";
```

### Per-model files live in a `models/` subdirectory

prismabox writes each model's file directly into the output directory. PrismaType writes
per-model files into a **`models/`** subdirectory (the shared `enums.ts` and the
`__nullable__` / `__transformDate__` helpers stay at the output root). Update any imports
that reached into a per-model file to include the `models/` segment:

```ts
// Before (prismabox: model files at the output root)
import { Post } from "./generated/schema/Post";

// After (PrismaType: model files under models/)
import { Post } from "./generated/schema/models/Post";
```

### `model.ts` replaces `barrel.ts`

prismabox emits a `barrel.ts` that re-exports every generated file (models, enums, and
helpers). PrismaType emits a **`model.ts`** at the output root that re-exports only the
model files, so importing everything from one place still works. Update any barrel import
to point at `model.ts`:

```ts
// Before (prismabox: re-export barrel)
import { Post, PostInputCreate } from "./generated/schema/barrel";

// After (PrismaType: model barrel)
import { Post, PostInputCreate } from "./generated/schema/model";
```

## Behavior that carries over unchanged

To reassure you nothing subtle shifted, these behave exactly as they did in prismabox:

- The set of generated exports per model (`Plain`, `Relations`, the composite `Model`,
  `Where`, `WhereUnique`, `Select`, `Include`, `OrderBy`, and the input models).
- Input-model conventions: foreign IDs ending in `Id`, the `createdAt DateTime @default(now())`
  and `updatedAt DateTime @updatedAt` detection, and `input.hide` annotations.
- The `ignore*OnInputModel` options and their defaults.
- The `__nullable__` wrapper for fields that allow `null` in addition to `undefined`.

## Getting help

If something doesn't line up after migrating, check
[Troubleshooting](/guide/troubleshooting) or open an issue on
[GitHub](https://github.com/raghu2x/prismatype).
