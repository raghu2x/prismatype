# PrismaType

Generate versatile [TypeBox](https://github.com/sinclairzx81/typebox) schemas from your
[Prisma](https://github.com/prisma) schema, as part of `prisma generate`.

The output is plain TypeBox, so you validate at runtime with `Value.Check` and derive
compile-time types with `Static` — from a single source of truth.

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

PrismaType writes one `.ts` file per model (plus a shared `enums.ts`, a `barrel.ts`
re-export, and the `__nullable__` / `__transformDate__` helpers) into the `output`
directory.

> ⚠️ The output directory is **wiped and recreated on every generate**. Point `output` at
> a folder that PrismaType fully owns — don't keep hand-written files there.

## Documentation

Read the [full documentation](https://prismatype.netlify.app/) for guides, configuration, and annotations.

## License

[MIT](LICENSE)
