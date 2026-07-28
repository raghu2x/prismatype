import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { readAllOutputs, runPipelineOn } from "./fixtures/pipeline";
import { richEnums, richModels } from "./fixtures/richSchema";
import { resetConfig } from "./helpers";

/**
 * Full-output snapshot tests. For a given config, these run the whole pipeline
 * over the maximal `richSchema` fixture and snapshot *every* generated file —
 * models, the shared enums file, the `__nullable__` / `__transformDate__`
 * helpers and the barrel — by reading the entire output directory rather than a
 * hand-picked list. That means a new emitted file, a dropped file, or any diff
 * inside a file that a targeted assertion would miss all show up here.
 *
 * Each config variation gets its own snapshot so the branches that only config
 * can reach (input models, `useJsonTypes`, `additionalProperties`) are pinned
 * too. `richSchema` covers the branches that schema shape can reach (every
 * scalar, list/nullable wrappers, all annotation kinds, relations, recursion).
 *
 * Committed snapshots live in `__snapshots__/`. To intentionally update them
 * after a real output change, run `bun test --update-snapshots`.
 *
 * Note: the output is oxfmt-formatted, so an oxfmt version bump legitimately
 * churns these snapshots. Review the diff, then update.
 */

async function withOutput(overrides: Record<string, unknown>, fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "prismatype-snap-"));
  try {
    resetConfig({ output: dir, ...overrides });
    await runPipelineOn(richModels, richEnums);
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("full output snapshots (rich schema)", () => {
  test("default config: every generated file", async () => {
    await withOutput({}, async (dir) => {
      expect(await readAllOutputs(dir)).toMatchSnapshot();
    });
  });

  test("inputModel enabled: every generated file", async () => {
    await withOutput({ inputModel: true }, async (dir) => {
      expect(await readAllOutputs(dir)).toMatchSnapshot();
    });
  });

  test("useJsonTypes=true: DateTime becomes a formatted string", async () => {
    await withOutput({ useJsonTypes: true }, async (dir) => {
      expect(await readAllOutputs(dir)).toMatchSnapshot();
    });
  });

  test('useJsonTypes="transformer": DateTime uses the __transformDate__ codec', async () => {
    await withOutput({ useJsonTypes: "transformer" }, async (dir) => {
      expect(await readAllOutputs(dir)).toMatchSnapshot();
    });
  });

  test("additionalProperties=true: objects allow extra keys", async () => {
    await withOutput({ additionalProperties: true }, async (dir) => {
      expect(await readAllOutputs(dir)).toMatchSnapshot();
    });
  });
});
