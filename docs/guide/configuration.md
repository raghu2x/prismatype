# Configuration

All options are set inside the `generator prismatype { ... }` block in your
`schema.prisma`. Values are strings, booleans, or arrays as noted below; Prisma passes
them to prismatype, which coerces them to their declared types.

```prisma
generator prismatype {
  provider = "prismatype"
  output   = "./prismatype"
  inputModel = true
}
```

## Common options

### `output`

- **Type:** `string`
- **Default:** `./prismatype`

Directory the generated files are written to.

::: danger
This directory is **wiped and recreated on every generate**. Point it at a folder that
prismatype fully owns.
:::

### `typeboxImportVariableName`

- **Type:** `string`
- **Default:** `"Type"`

The variable name used to reference TypeBox in the generated schemas (the standard
`typebox` package exports `Type`). Set to something else, e.g. `"t"`, if your import uses a
different name.

### `typeboxImportDependencyName`

- **Type:** `string`
- **Default:** `"typebox"`

The package the TypeBox import comes from. Defaults to the unscoped `typebox` package
(TypeBox >= 1.0). Point this at a package that re-exports the TypeBox 1.x API (e.g.
`"elysia"`) if you don't want to import from `typebox` directly. See
[Using the Schemas](/guide/usage#use-with-frameworks).

### `additionalProperties`

- **Type:** `boolean`
- **Default:** `false`

Whether the generated object schemas allow properties beyond those declared. When `false`,
schemas set `additionalProperties: false`.

### `inputModel`

- **Type:** `boolean`
- **Default:** `false`

Enables generation of create/update input models. See
[Input models](/guide/generated-schemas#input-models) for the conventions these rely on.

## Input model options

These only take effect when [`inputModel`](#inputmodel) is enabled. All default to `true`.

### `ignoreIdOnInputModel`

- **Type:** `boolean`
- **Default:** `true`

Omits the `@id` field from input models.

### `ignoreCreatedAtOnInputModel`

- **Type:** `boolean`
- **Default:** `true`

Omits a `createdAt DateTime @default(now())` field from input models.

### `ignoreUpdatedAtOnInputModel`

- **Type:** `boolean`
- **Default:** `true`

Omits an `updatedAt DateTime @updatedAt` field from input models.

### `ignoreForeignOnInputModel`

- **Type:** `boolean`
- **Default:** `true`

Omits foreign-key fields (those ending in `Id`) from input models, since relations are
handled through connect/disconnect instead.

## Advanced options

### `useJsonTypes`

- **Type:** `false | true | "transformer"`
- **Default:** `false`

Controls how non-JSON-native types (like `DateTime`) are emitted so output is compatible
with tooling that only supports JSON primitives:

- `false` — off; native types are used.
- `true` — such types are emitted as a formatted `string` (e.g. `Date` becomes a
  `string`).
- `"transformer"` — uses TypeBox codecs (`__transformDate__`) to accept native JS `Date`
  values but transform them to strings on processing.

### `allowRecursion`

- **Type:** `boolean`
- **Default:** `true`

Whether to allow recursion in the generated schemas. Disabling it reduces generated code
size.

### `additionalFieldsPlain`

- **Type:** `string[]`
- **Default:** _none_

Extra fields to inject into the plain generated schemas. Each entry must be a valid field
string in the context where it is used.

```prisma
generator prismatype {
  provider   = "prismatype"
  inputModel = true
  output     = "./generated/schema"
  additionalFieldsPlain = ["additional: Type.Optional(Type.String())"]
}
```

### `nullableName`

- **Type:** `string`
- **Default:** `"__nullable__"`

Name of the generated helper used to wrap nullable fields. See
[TypeBox & Nullability](/guide/typebox).

### `transformDateName`

- **Type:** `string`
- **Default:** `"__transformDate__"`

Name of the generated date-transform codec used when
[`useJsonTypes`](#usejsontypes) is `"transformer"`.

### `importFileExtension`

- **Type:** `string`
- **Default:** `""`

File extension added to imports between generated files. Set to `".js"` to support
`nodenext` module resolution.

### `exportedTypePrefix`

- **Type:** `string`
- **Default:** `""`

Prefix added to every exported schema name.

### `enumsFileName`

- **Type:** `string`
- **Default:** `"enums"`

Name (without extension) of the file all generated enums are emitted into and imported
from by model files.
