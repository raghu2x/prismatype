---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "prismatype"
  text: "TypeBox schemas from your Prisma schema"
  tagline: A Prisma generator that emits versatile TypeBox schemas as part of prisma generate — validate at runtime and derive static types from a single source of truth.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/raghu2x/prismatype

features:
  - title: One schema, two jobs
    details: The output is plain TypeBox — use it for runtime validation with Value.Check and derive compile-time types with Static from the exact same object.
  - title: Runs with prisma generate
    details: Add a generator block to schema.prisma and run prisma generate. prismatype writes one .ts file per model plus shared enum and helper files.
  - title: Rich per-model schemas
    details: Plain, Relations, the full composite, plus Where, WhereUnique, Select, Include and OrderBy shapes — and optional input models for create/update.
  - title: Framework ready
    details: The generated schemas drop straight into Elysia, Fastify (TypeBox provider), and anything else built on the TypeBox 1.x API.
---
