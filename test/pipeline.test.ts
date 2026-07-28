import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readOutput, runPipeline } from "./fixtures/pipeline";
import { resetConfig } from "./helpers";

/**
 * Full-pipeline behaviour test: runs the real generators over a representative
 * DMMF, then `write()`s to a temp directory and asserts the on-disk output.
 * This mirrors the wiring in `src/index.ts` (minus the Prisma generatorHandler
 * shell) and exercises model assembly, the writer, the barrel, and formatting
 * together.
 *
 * `prisma/generated/` is gitignored, so this (with the snapshot test) is the
 * only guard against whole-schema output regressions. This file asserts
 * behaviour/contracts; `pipeline.snapshot.test.ts` locks the exact output.
 */

describe("full pipeline: generators -> write -> disk", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "prismatype-"));
    resetConfig({ output: dir });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("writes one file per model plus the shared enum and helper files", async () => {
    await runPipeline();
    const files = (await readdir(dir)).sort();

    expect(files).toContain("User.ts");
    expect(files).toContain("Post.ts");
    // All enums live in a single shared file (config.enumsFileName), not one per enum.
    expect(files).toContain("enums.ts");
    // Helper modules are always emitted.
    expect(files).toContain("__nullable__.ts");
    expect(files).toContain("__transformDate__.ts");
    expect(files).toContain("barrel.ts");
  });

  test("the barrel re-exports every generated file", async () => {
    await runPipeline();
    const barrel = await readOutput(dir, "barrel");

    expect(barrel).toContain('export * from "./User";');
    expect(barrel).toContain('export * from "./Post";');
    expect(barrel).toContain('export * from "./enums";');
    expect(barrel).toContain('export * from "./__nullable__";');
    expect(barrel).toContain('export * from "./__transformDate__";');
    // The barrel should not re-export itself.
    expect(barrel).not.toContain('export * from "./barrel"');
  });

  test("each model file imports Type from the configured dependency", async () => {
    await runPipeline();
    const user = await readOutput(dir, "User");
    expect(user).toContain('import { Type } from "typebox";');
  });

  test("emits the Plain, Relations, Where and Select variants for a model", async () => {
    await runPipeline();
    const user = await readOutput(dir, "User");

    expect(user).toContain("UserPlain");
    expect(user).toContain("UserRelations");
    expect(user).toContain("UserWhere");
    expect(user).toContain("UserSelect");
  });

  test("synthesizes the composite Model from Plain + Relations", async () => {
    await runPipeline();
    const user = await readOutput(dir, "User");

    // model.ts builds `Model = Composite([Plain, Relations])`.
    expect(user).toMatch(/export const User =/);
    expect(user).toContain("UserPlain");
    expect(user).toContain("UserRelations");
  });

  test("the plain schema carries scalar fields and skips relations", async () => {
    await runPipeline();
    const user = await readOutput(dir, "User");

    expect(user).toContain("email:");
    expect(user).toContain("bio:");
    // `posts` is a relation and belongs in Relations, not Plain.
    expect(user).toMatch(/UserPlain[\s\S]*Type\.Object/);
  });

  test("the shared enums file emits the Role values", async () => {
    await runPipeline();
    const enumsFile = await readOutput(dir, "enums");

    expect(enumsFile).toContain("Role");
    expect(enumsFile).toContain("USER");
    expect(enumsFile).toContain("ADMIN");
  });

  test("relation schemas reference the related model's fields", async () => {
    await runPipeline();
    const user = await readOutput(dir, "User");
    // UserRelations inlines the Post plain schema for the `posts` field.
    expect(user).toContain("posts:");
  });

  test("omits input-model files when inputModel is disabled (default)", async () => {
    await runPipeline();
    const user = await readOutput(dir, "User");

    expect(user).not.toContain("UserInputCreate");
    expect(user).not.toContain("UserInputUpdate");
  });

  test("emits input-model variants when inputModel is enabled", async () => {
    resetConfig({ output: dir, inputModel: true });
    await runPipeline();
    const user = await readOutput(dir, "User");

    expect(user).toContain("UserInputCreate");
    expect(user).toContain("UserInputUpdate");
  });
});
