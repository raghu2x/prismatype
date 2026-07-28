# prismatype

Generate versatile [typebox](https://github.com/sinclairzx81/typebox) schemes from your [prisma](https://github.com/prisma) schema.

> Currently does not support [mongoDB composite types](https://www.prisma.io/docs/orm/prisma-schema/data-model/models#defining-composite-types)

Install it in your project,

```bash
npm i -D prismatype
pnpm i -D prismatype
bun add -D prismatype
```

then add

```prisma
generator prismatype {
  provider = "prismatype"
  // you can optionally specify the output location. Defaults to ./prismatype
  output = "./myCoolPrismatypeDirectory"
  // if you want, you can customize the imported variable name that is used for the schemes. Defaults to "Type" which is what the standard typebox package offers
  typeboxImportVariableName = "t"
  // you also can specify the dependency from which the above import should happen. Defaults to "typebox".
  // Point this at a package that re-exports the TypeBox 1.x API (e.g. "elysia") if you don't want to import from "typebox" directly
  typeboxImportDependencyName = "elysia"
  // by default the generated schemes do not allow additional properties. You can allow them by setting this to true
  additionalProperties = true
  // optionally enable the data model generation. See the data model section below for more info
  inputModel = true
}
```

to your `prisma.schema`. You can modify the settings to your liking, please see the respective comments for info on what the option does.

> There are additional config options available which are mostly irrelevant to the average user. Please see [config.ts](src/config.ts) for all available options.

Then generate:

```bash
npx prisma generate
```

prismatype runs as part of `prisma generate` and writes one `.ts` file per model (plus a shared `enums.ts`, a `barrel.ts` re-export, and the `__nullable__` / `__transformDate__` helpers) into the `output` directory.

> ⚠️ The output directory is **wiped and recreated on every generate**. Point `output` at a folder that prismatype fully owns — don't keep hand-written files there.

## Using the generated schemes

The generated files are plain [TypeBox](https://github.com/sinclairzx81/typebox) schema objects, so you use them like any other TypeBox schema. Import from the `barrel.ts` re-export file and validate data at runtime or derive a static type:

```ts
import type { Static } from "typebox";
import { Value } from "typebox/value";
import { Post, PostInputCreate } from "./prismatype/barrel";

// Runtime validation
if (!Value.Check(PostInputCreate, req.body)) {
  throw new Error("Invalid post");
}

// Compile-time type, derived from the same schema
type Post = Static<typeof Post>;
```

Because they are ordinary TypeBox schemas, they also drop straight into frameworks built on TypeBox such as [Elysia](https://elysiajs.com/) or [Fastify](https://fastify.dev/) (with the TypeBox type provider):

```ts
import { Elysia } from "elysia";
import { PostInputCreate } from "./prismatype/barrel";

new Elysia().post("/posts", ({ body }) => createPost(body), {
  body: PostInputCreate,
});
```

> If your app imports TypeBox from a re-export (e.g. Elysia), set `typeboxImportDependencyName` so the generated files import from the same place.

## TypeBox version

Prismatype targets the TypeBox >= 1.0 API from the unscoped [`typebox`](https://www.npmjs.com/package/typebox) package. The generated code uses `Type.Evaluate(Type.Intersect([...]))` for composites, `Type.Codec` for transforms and `Type.Refine`-based schemes for `Date`/`Bytes`. The legacy 0.x `@sinclair/typebox` API is no longer supported.

## Annotations

Prismatype offers annotations to adjust the output of models and fields.

| Annotation                    | Example                                   | Description                                                                                                                                                                  |
| ----------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @prismatype.hide              | -                                         | Hides the field or model from the output                                                                                                                                     |
| @prismatype.hidden            | -                                         | Alias for @prismatype.hide                                                                                                                                                   |
| @prismatype.input.hide        | -                                         | Hides the field or model from the output only in the input model                                                                                                             |
| @prismatype.create.input.hide | -                                         | Hides the field or model from the outputs only in the input create model                                                                                                     |
| @prismatype.update.input.hide | -                                         | Hides the field or model from the outputs only in the input update model                                                                                                     |
| @prismatype.options           | @prismatype.options{ min: 10, max: 20 }   | Uses the provided options for the field or model in the generated schema. Be careful to use valid JS/TS syntax!                                                              |
| @prismatype.typeOverwrite     | @prismatype.typeOverwrite=Type.CustomName | Overwrite the type prismatype outputs for a field with a custom string. See [raghu2x/prismatype#29](https://github.com/raghu2x/prismatype/issues/29) for an extended usecase |

> For a more detailed list of available annotations, please see [annotations.ts](src/annotations/annotations.ts)

A schema using annotations could look like this:

```prisma
/// The post model
model Post {
  id        Int      @id @default(autoincrement())
  /// @prismatype.hidden
  createdAt DateTime @default(now())
  title     String   @unique

  User   User? @relation(fields: [userId], references: [id])
  /// @prismatype.options{max: 10}
  /// this is the user id
  userId Int?
}

/// @prismatype.hidden
enum Account {
  PASSKEY
  PASSWORD
}

```

> Please note that you cannot use multiple annotations in one line! Each needs to be in its own!

## Generated Schemes

The generator will output schema objects based on the models:

```ts
// the plain object without any relations
export const PostPlain = ...

// only the relations of a model
export const PostRelations = ...

// a composite model of the two, providing the full type
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

Quick reference for the suffixes:

| Export                                       | Contents                                                          |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `PostPlain`                                  | The model's own scalar and enum fields — no relations.            |
| `PostRelations`                              | Only the relation fields (related models' plain schemas inlined). |
| `Post`                                       | The full model: `Plain` and `Relations` intersected.              |
| `PostWhere` / `PostWhereUnique`              | Shapes for `where` filters and unique lookups.                    |
| `PostSelect` / `PostInclude` / `PostOrderBy` | Shapes for Prisma `select`, `include`, and `orderBy` inputs.      |

Enums are emitted separately into `enums.ts` and imported by any model file that uses them.

### Input models

To simplify the validation of input data, prismatype is able to generate schemes specifically for input data.
These are called "InputModels" and need to be explicitly enabled in the generator settings (`inputModel = true`) because they expect some conventions/field naming patterns to work properly.

> If you want to see the specifics on how the model behaves, see [here](src/generators/relations.ts) and [here](src/generators/plain.ts).

1. Foreign Ids need to end in Id (case is ignored, e.g. `userId` or `userid` will work)
2. createdAt will be detected and ignored if it follows exactly this pattern: `createdAt DateTime @default(now())`
3. updatedAt will be detected and ignored if it follows exactly this pattern: `updatedAt DateTime @updatedAt`
4. Hide annotations marked for imports (`@prismatype.input.hide`) are respected.

If enabled, the generator will additonally output more schemes for each model which can be used for creating/updating entities. The model will only allow editing fields of the entity itself. For relations, only connecting/disconnecting is allowed, but changing/creating related entities is not possible.

Related records can be identified either by a single scalar `@id` field or by a composite key declared with `@@id([...])` or `@@unique([...])`. For composite keys, the generated `connect`/`disconnect` schemes follow Prisma's nested shape, where the fields are grouped under a key joining the field names with `_`, e.g. `{ userId_teamId: { userId, teamId } }`.

## Notes

### `__nullable__` vs `Type.Optional`

Prismatype wraps nullable fields in a custom `__nullable__` method which allows `null` in addition to `undefined`. From the relevant [issue comment](https://github.com/raghu2x/prismatype/issues/33#issuecomment-2708755442):

> prisma in some scenarios allows null OR undefined as types where optional only allows for undefined/is reflected as undefined in TS types
