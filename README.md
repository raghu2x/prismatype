# PrismaType

[![npm version](https://img.shields.io/npm/v/prismatype.svg?logo=npm)](https://www.npmjs.com/package/prismatype)
[![CI](https://github.com/raghu2x/prismatype/actions/workflows/pull_request.yml/badge.svg)](https://github.com/raghu2x/prismatype/actions/workflows/pull_request.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Generate versatile [TypeBox](https://github.com/sinclairzx81/typebox) schemas from your
[Prisma](https://github.com/prisma) schema, as part of `prisma generate`.

The output is plain TypeBox, so you validate at runtime with `Value.Check` and derive
compile-time types with `Static` — from a single source of truth.

## Requirements

- **Prisma** 7 or newer
- **Node.js** 22 or newer
- **TypeBox** 1.x or newer (the unscoped `typebox` package, or a package that re-exports the 1.x API)

## Install

```bash
npm i -D prismatype
pnpm i -D prismatype
bun add -D prismatype
```

Add the generator to your `schema.prisma`:

```prisma
generator prismatype {
  provider = "prismatype"
  output   = "./prismatype"
  inputModel = true
}
```

Then generate:

```bash
npx prisma generate
```

PrismaType writes one `.ts` file per model into a `models/` subdirectory of the `output`
directory, plus a shared `enums.ts`, a `model.ts` re-export, and the `__nullable__` /
`__transformDate__` helpers at the output root.

> ⚠️ The output directory is **wiped and recreated on every generate**. Point `output` at
> a folder that PrismaType fully owns — don't keep hand-written files there.

## Documentation

Read the [full documentation](https://prismatype.netlify.app/) for guides, configuration, and annotations.

## License

[MIT](LICENSE)
