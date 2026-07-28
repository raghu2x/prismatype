import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "PrismaType",
  description:
    "Generate versatile TypeBox schemas from your Prisma schema, as part of prisma generate.",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Configuration", link: "/guide/configuration" },
      {
        text: "npm",
        link: "https://www.npmjs.com/package/prismatype",
      },
    ],

    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Using the Schemas", link: "/guide/usage" },
          { text: "Generated Schemas", link: "/guide/generated-schemas" },
          { text: "Annotations", link: "/guide/annotations" },
          { text: "Configuration", link: "/guide/configuration" },
          { text: "TypeBox & Nullability", link: "/guide/typebox" },
        ],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/raghu2x/prismatype" }],

    editLink: {
      pattern: "https://github.com/raghu2x/prismatype/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © Raghvendra Yadav",
    },
  },
});
