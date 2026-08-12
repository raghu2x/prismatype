#!/usr/bin/env node

/**
 * Entry point for both the Prisma generator and the migration codemod.
 *
 * Prisma spawns this binary with no arguments and speaks JSON-RPC over stdio, so
 * the generator must remain the default path: only an explicit `migrate`
 * subcommand diverts to the codemod. The generator module is imported lazily
 * because importing it registers a stdio handler, which would otherwise hang the
 * codemod waiting on a message Prisma is never going to send.
 */

const [subcommand, ...rest] = process.argv.slice(2);

if (subcommand === "migrate") {
  const { runMigrateCli } = await import("./migrate/index");
  process.exitCode = await runMigrateCli(rest);
} else {
  await import("./index");
}
