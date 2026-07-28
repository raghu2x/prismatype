# prismatype

Generate versatile [TypeBox](https://github.com/sinclairzx81/typebox) schemas from your
[Prisma](https://github.com/prisma) schema, as part of `prisma generate`.

The output is plain TypeBox, so you validate at runtime with `Value.Check` and derive
compile-time types with `Static` — from a single source of truth.

> Currently does not support [MongoDB composite types](https://www.prisma.io/docs/orm/prisma-schema/data-model/models#defining-composite-types).

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

prismatype writes one `.ts` file per model (plus a shared `enums.ts`, a `barrel.ts`
re-export, and the `__nullable__` / `__transformDate__` helpers) into the `output`
directory.

> ⚠️ The output directory is **wiped and recreated on every generate**. Point `output` at
> a folder that prismatype fully owns — don't keep hand-written files there.

## Documentation

Full documentation lives in the [docs site](docs/guide/getting-started.md):

- [Getting Started](docs/guide/getting-started.md)
- [Using the Schemas](docs/guide/usage.md)
- [Generated Schemas](docs/guide/generated-schemas.md) (including input models)
- [Annotations](docs/guide/annotations.md)
- [Configuration](docs/guide/configuration.md) — every generator option
- [TypeBox & Nullability](docs/guide/typebox.md)

To run the docs locally:

```bash
bun run docs:dev
```

## License

[MIT](LICENSE)
