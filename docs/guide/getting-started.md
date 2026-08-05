# Getting Started

PrismaType is a [Prisma](https://github.com/prisma) generator that emits versatile
[TypeBox](https://github.com/sinclairzx81/typebox) schemas from your Prisma schema.
It runs as part of `prisma generate`: Prisma parses your schema, hands PrismaType the
data model, and PrismaType writes `.ts` files of TypeBox schemas to an output directory.

## Requirements

Before installing, make sure your project meets these minimums:

- **Prisma** 7 or newer
- **Node.js** 22 or newer
- **TypeBox** 1.x or newer (the unscoped `typebox` package, or a package that re-exports the 1.x API)

## Install

Add PrismaType as a dev dependency with your package manager of choice:

::: code-group

```bash [npm]
npm i -D prismatype
```

```bash [pnpm]
pnpm i -D prismatype
```

```bash [bun]
bun add -D prismatype
```

:::

## Add the generator

Add a `generator` block to your `schema.prisma`:

```prisma
generator prismatype {
  provider = "prismatype"
  // you can optionally specify the output location. Defaults to ./prismatype
  output = "./myCoolPrismatypeDirectory"
  // customize the imported variable name used for the schemas.
  // Defaults to "Type", which is what the standard typebox package offers
  typeboxImportVariableName = "t"
  // specify the dependency the above import comes from. Defaults to "typebox".
  // Point this at a package that re-exports the TypeBox 1.x API (e.g. "elysia")
  // if you don't want to import from "typebox" directly
  typeboxImportDependencyName = "elysia"
  // by default the generated schemas do not allow additional properties.
  // Allow them by setting this to true
  additionalProperties = true
  // optionally enable input model generation. See "Generated Schemas" for details
  inputModel = true
}
```

You can adjust these settings to your liking. Every option, including the advanced ones
not shown here, is documented on the [Configuration](/guide/configuration) page.

## Generate

Run Prisma's generate command:

```bash
npx prisma generate
```

PrismaType runs as part of `prisma generate` and writes one `.ts` file per model into a
`models/` subdirectory of the `output` directory, plus, at the output root:

- a shared `enums.ts` file that every model using an enum imports from,
- a `model.ts` re-export file so you can import every model from one place,
- the `__nullable__` and `__transformDate__` helper files.

::: danger The output directory is wiped on every generate
PrismaType **wipes and recreates** the output directory on every generate run. Point
`output` at a folder that PrismaType fully owns; don't keep hand-written files there.
:::

## Next steps

- [Using the Schemas](/guide/usage): validate data and derive static types.
- [Generated Schemas](/guide/generated-schemas): what each generated export contains.
- [Annotations](/guide/annotations): hide fields, add options, and override types.
- [Troubleshooting](/guide/troubleshooting): fixes for the most common issues.
