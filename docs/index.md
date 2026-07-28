---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "PrismaType"
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
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v18M3 9h18"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>'
    details: The output is plain TypeBox — use it for runtime validation with Value.Check and derive compile-time types with Static from the exact same object.
  - title: Runs with prisma generate
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M21 3v6h-6"/><path d="M12 7v5l3 2"/></svg>'
    details: Add a generator block to schema.prisma and run prisma generate. prismatype writes one .ts file per model plus shared enum and helper files.
  - title: Rich per-model schemas
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6a8 3 0 0 0 16 0V5"/><path d="M4 11v6a8 3 0 0 0 16 0v-6"/></svg>'
    details: Plain, Relations, the full composite, plus Where, WhereUnique, Select, Include and OrderBy shapes — and optional input models for create/update.
  - title: Framework ready
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>'
    details: The generated schemas drop straight into Elysia, Fastify (TypeBox provider), and anything else built on the TypeBox 1.x API.
---
