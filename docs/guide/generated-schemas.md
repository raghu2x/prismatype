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
| `PostPlain`                                  | The model's own scalar and enum fields — no relations.            |
| `PostRelations`                              | Only the relation fields (related models' plain schemas inlined). |
| `Post`                                       | The full model: `Plain` and `Relations` intersected.              |
| `PostWhere` / `PostWhereUnique`              | Shapes for `where` filters and unique lookups.                    |
| `PostSelect` / `PostInclude` / `PostOrderBy` | Shapes for Prisma `select`, `include`, and `orderBy` inputs.      |

Enums are emitted separately into `enums.ts` and imported by any model file that uses
them.

## Input models

To simplify validating input data, prismatype can generate schemas specifically for
create and update payloads. These are called **input models** and must be explicitly
enabled with [`inputModel = true`](/guide/configuration#inputmodel), because they rely on
some field-naming conventions to work properly.

When enabled, each model gains additional schemas that can be used for creating and
updating entities. An input model only allows editing fields of the entity itself. For
relations, only connecting and disconnecting are allowed — changing or creating related
entities is not.

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
{ userId_teamId: { userId, teamId } }
```
