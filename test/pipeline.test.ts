import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readOutput, readRootOutput, runPipeline } from "./fixtures/pipeline";
import { resetConfig } from "./helpers";

/**
 * Full-pipeline behaviour test: runs the real generators over a representative
 * DMMF, then `write()`s to a temp directory and asserts the on-disk output.
 * This mirrors the wiring in `src/index.ts` (minus the Prisma generatorHandler
 * shell) and exercises model assembly, the writer, the model barrel, and
 * formatting together.
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

  test("writes per-model files under models/ and shared files at the root", async () => {
    await runPipeline();
    const rootFiles = (await readdir(dir)).sort();
    const modelFiles = (await readdir(join(dir, "models"))).sort();

    // Per-model files live in the models/ subdirectory.
    expect(modelFiles).toContain("User.ts");
    expect(modelFiles).toContain("Post.ts");
    // All enums live in a single shared file at the root, not one per enum.
    expect(rootFiles).toContain("enums.ts");
    // Helper modules and the model barrel are always emitted at the root.
    expect(rootFiles).toContain("__nullable__.ts");
    expect(rootFiles).toContain("__transformDate__.ts");
    expect(rootFiles).toContain("model.ts");
  });

  test("the model barrel re-exports every model file and nothing else", async () => {
    await runPipeline();
    const barrel = await readRootOutput(dir, "model");

    expect(barrel).toContain('export * from "./models/User";');
    expect(barrel).toContain('export * from "./models/Post";');
    // The barrel re-exports models only, not enums or helpers.
    expect(barrel).not.toContain("enums");
    expect(barrel).not.toContain("__nullable__");
    expect(barrel).not.toContain("__transformDate__");
    // The barrel should not re-export itself.
    expect(barrel).not.toContain('"./model"');
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
    const enumsFile = await readRootOutput(dir, "enums");

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
