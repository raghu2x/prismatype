# Troubleshooting

Common issues and their fixes.

## Validation passes but types don't match (two TypeBox instances)

If `Value.Check` behaves oddly, or TypeScript complains that a generated schema isn't
assignable to what your framework expects, you likely have **two copies of TypeBox** in
your dependency tree: the generated files import from one, your app from another.

Set [`typeboxImportDependencyName`](/guide/configuration#typeboximportdependencyname) to
the same package your app imports TypeBox from. For example, if your app uses Elysia's
re-export:

```prisma
generator prismatype {
  provider = "prismatype"
  typeboxImportDependencyName = "elysia"
}
```

See [Using the Schemas](/guide/usage#use-with-frameworks) for the framework context.

## My hand-written files in the output folder disappeared

prismatype **wipes and recreates** the output directory on every `prisma generate`. Point
[`output`](/guide/configuration#output) at a folder that prismatype fully owns, and keep
your own code elsewhere.

## `ERR_MODULE_NOT_FOUND` / imports fail under nodenext

When your project uses `"moduleResolution": "nodenext"` (or otherwise requires explicit
extensions), the extensionless imports between generated files won't resolve. Set
[`importFileExtension`](/guide/configuration#importfileextension) to `".js"`:

```prisma
generator prismatype {
  provider = "prismatype"
  importFileExtension = ".js"
}
```

## `Date` values are rejected / serialize oddly

TypeBox 1.x has no `Type.Date`. prismatype emits a refined `Unsafe` schema for `DateTime`
by default. If you need JSON-serializable output, or want to accept native `Date` objects
and transform them to strings, use
[`useJsonTypes`](/guide/configuration#usejsontypes) (`true` for formatted strings,
`"transformer"` for a codec). See [TypeBox & Nullability](/guide/typebox).

## MongoDB composite types aren't generated

prismatype does not currently support
[MongoDB composite types](https://www.prisma.io/docs/orm/prisma-schema/data-model/models#defining-composite-types).
Models using them will not generate correctly.

## An annotation is being ignored

Each annotation must be on its **own** `///` line; you cannot combine multiple annotations
on one line. Also confirm the directive spelling against the
[Annotations](/guide/annotations) reference. Any `///` line that isn't a recognized
annotation is treated as the field's `description` instead.

## The generated `__nullable__` / `__transformDate__` names clash

Rename the helpers with
[`nullableName`](/guide/configuration#nullablename) and
[`transformDateName`](/guide/configuration#transformdatename). Prefix every exported
schema with [`exportedTypePrefix`](/guide/configuration#exportedtypeprefix) if the model
export names collide with other symbols in your app.
