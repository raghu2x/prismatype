# Using the Schemas

The generated files are plain [TypeBox](https://github.com/sinclairzx81/typebox) schema
objects, so you use them like any other TypeBox schema. Import from the `barrel.ts`
re-export file and validate data at runtime or derive a static type, from the exact same
object.

## Runtime validation and static types

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

## Use with frameworks

Because they are ordinary TypeBox schemas, they drop straight into frameworks built on
TypeBox, such as [Elysia](https://elysiajs.com/) or
[Fastify](https://fastify.dev/) (with the TypeBox type provider):

```ts
import { Elysia } from "elysia";
import { PostInputCreate } from "./prismatype/barrel";

new Elysia().post("/posts", ({ body }) => createPost(body), {
  body: PostInputCreate,
});
```

::: tip Match your import source
If your app imports TypeBox from a re-export (e.g. Elysia), set
[`typeboxImportDependencyName`](/guide/configuration#typeboximportdependencyname) so the
generated files import from the same place. Otherwise you may end up with two distinct
TypeBox instances.
:::
