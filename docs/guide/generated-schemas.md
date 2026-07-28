# Generated Schemas

For each model in your Prisma schema, prismatype outputs several schema objects. Using a
`Post` model as an example:

```ts
// the plain object without any relations
export const PostPlain = ...

// only the relations of a model
export const PostRelations = ...

// a composite of the two, providing the full type
export const Post = ...

// a schema for validating the prisma where input for this model
export const PostWhere = ...

// a schema for validating the prisma unique where input for this model
export const PostWhereUnique = ...

// a schema for validating the prisma order by input for this model
export const PostOrderBy = ...

// a schema for validating the prisma include input for this model
export const PostInclude = ...

// a schema for validating the prisma select input for this model
export const PostSelect = ...
```

## Suffix reference

| Export                                       | Contents                                                          |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `PostPlain`                                  | The model's own scalar and enum fields, no relations.             |
| `PostRelations`                              | Only the relation fields (related models' plain schemas inlined). |
| `Post`                                       | The full model: `Plain` and `Relations` intersected.              |
| `PostWhere` / `PostWhereUnique`              | Shapes for `where` filters and unique lookups.                    |
| `PostSelect` / `PostInclude` / `PostOrderBy` | Shapes for Prisma `select`, `include`, and `orderBy` inputs.      |

Enums are emitted separately into `enums.ts` and imported by any model file that uses
them.

## MongoDB composite types

[MongoDB composite types](https://www.prisma.io/docs/orm/prisma-schema/data-model/models#defining-composite-types)
(`type` blocks) are supported. Unlike relations, a composite type gets no schema of its
own; its `Type.Object(...)` is inlined directly into every model that uses it, and it
appears in the model's `Plain` schema (and its input models) rather than in `Relations`.
Nested composite types are inlined the same way.

```prisma
type Address {
  street String
  city   String
}

model User {
  id      String   @id @default(auto()) @map("_id") @db.ObjectId
  address Address?
}
```

```ts
// the composite type is inlined into UserPlain
export const UserPlain = Type.Object({
  id: Type.String(),
  address: __nullable__(Type.Object({ street: Type.String(), city: Type.String() })),
});
```

## Input models

To simplify validating input data, prismatype can generate schemas specifically for
create and update payloads. These are called **input models** and must be explicitly
enabled with [`inputModel = true`](/guide/configuration#inputmodel), because they rely on
some field-naming conventions to work properly.

When enabled, each model gains additional schemas that can be used for creating and
updating entities. An input model only allows editing fields of the entity itself. For
relations, only connecting and disconnecting are allowed; changing or creating related
entities is not.

### Input model exports

For a `Post` model, enabling `inputModel` adds these exports (mirroring the `Plain` /
`Relations` / composite split of the read schemas):

| Export                     | Contents                                                                  |
| -------------------------- | ------------------------------------------------------------------------- |
| `PostPlainInputCreate`     | The model's own editable fields for a create payload.                     |
| `PostRelationsInputCreate` | The relation `connect` / `disconnect` shapes for a create payload.        |
| `PostInputCreate`          | Composite of the two above; the schema you validate create requests with. |
| `PostPlainInputUpdate`     | The model's own editable fields for an update payload (all optional).     |
| `PostRelationsInputUpdate` | The relation `connect` / `disconnect` shapes for an update payload.       |
| `PostInputUpdate`          | Composite of the two above; the schema you validate update requests with. |

In practice you import the composites, `PostInputCreate` and `PostInputUpdate`. The
`Plain*` / `Relations*` halves are exported so you can compose narrower shapes yourself.

### Conventions

For input models to behave correctly, prismatype expects these conventions:

1. **Foreign IDs** need to end in `Id` (case is ignored, e.g. `userId` or `userid` both
   work).
2. **`createdAt`** is detected and ignored if it follows exactly this pattern:
   `createdAt DateTime @default(now())`.
3. **`updatedAt`** is detected and ignored if it follows exactly this pattern:
   `updatedAt DateTime @updatedAt`.
4. **Input hide annotations** (`@prismatype.input.hide` and its variants) are respected.
   See [Annotations](/guide/annotations).

Whether the ID, `createdAt`, `updatedAt`, and foreign-key fields are omitted from input
models is controlled by the `ignore*OnInputModel` [configuration
options](/guide/configuration), which are all on by default.

### Connecting related records

Related records can be identified either by a single scalar `@id` field or by a composite
key declared with `@@id([...])` or `@@unique([...])`. For composite keys, the generated
`connect`/`disconnect` schemas follow Prisma's nested shape, where the fields are grouped
under a key joining the field names with `_`:

```ts
// composite key of userId + teamId
{
  userId_teamId: {
    (userId, teamId);
  }
}
```
