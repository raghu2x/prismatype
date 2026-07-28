import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { DMMF } from "@prisma/generator-helper";
import { getConfig } from "../../src/config";
import { processEnums } from "../../src/generators/enum";
import { processInclude } from "../../src/generators/include";
import { processOrderBy } from "../../src/generators/orderBy";
import { processPlain } from "../../src/generators/plain";
import { processPlainInputCreate } from "../../src/generators/plainInputCreate";
import { processPlainInputUpdate } from "../../src/generators/plainInputUpdate";
import {
  processRelations,
  processRelationsInputCreate,
  processRelationsInputUpdate,
} from "../../src/generators/relations";
import { processSelect } from "../../src/generators/select";
import { processWhere, processWhereUnique } from "../../src/generators/where";
import { write } from "../../src/writer";
import { datamodelEnum, field, model } from "./dmmf";

/**
 * A small but representative schema shared by the pipeline tests: an enum, a
 * parent model with a list relation, and a child model with a back-reference
 * and an enum field. Kept in one place so the behaviour test and the snapshot
 * test exercise identical input.
 */
export const pipelineEnums = [datamodelEnum("Role", ["USER", "ADMIN"])];

export const pipelineModels = [
  model("User", [
    field({ name: "id", type: "Int", isId: true }),
    field({ name: "email", type: "String", isUnique: true }),
    field({ name: "role", type: "Role", kind: "enum" }),
    field({ name: "bio", type: "String", isRequired: false }),
    field({ name: "posts", type: "Post", kind: "object", isList: true }),
  ]),
  model("Post", [
    field({ name: "id", type: "Int", isId: true }),
    field({ name: "title", type: "String" }),
    field({ name: "authorId", type: "Int" }),
    field({ name: "author", type: "User", kind: "object" }),
  ]),
];

/**
 * Runs the generators over the given DMMF and writes them to the configured
 * output directory, mirroring the wiring in `src/index.ts` (minus the Prisma
 * generatorHandler shell). Whether input-model files are emitted follows
 * `config.inputModel`, exactly as `src/index.ts` decides it. Call after
 * pointing config.output at a temp dir.
 */
export async function runPipelineOn(models: DMMF.Model[], enums: DMMF.DatamodelEnum[]) {
  const config = getConfig();
  const processedEnums = processEnums(enums);
  const processedPlain = processPlain(models, processedEnums);

  await write({
    enums: processedEnums,
    plain: processedPlain,
    relations: processRelations(models, processedEnums, processedPlain),
    where: processWhere(models, processedEnums),
    whereUnique: processWhereUnique(models, processedEnums),
    plainInputCreate: config.inputModel ? processPlainInputCreate(models, processedEnums) : [],
    plainInputUpdate: config.inputModel ? processPlainInputUpdate(models, processedEnums) : [],
    relationsInputCreate: config.inputModel
      ? processRelationsInputCreate(models, processedEnums)
      : [],
    relationsInputUpdate: config.inputModel
      ? processRelationsInputUpdate(models, processedEnums)
      : [],
    select: processSelect(models),
    include: processInclude(models),
    orderBy: processOrderBy(models),
  });
}

/**
 * Runs the generators over the shared `pipelineModels`/`pipelineEnums` fixture.
 * Thin wrapper over `runPipelineOn` kept for the existing behaviour tests.
 */
export function runPipeline() {
  return runPipelineOn(pipelineModels, pipelineEnums);
}

/** Reads a generated `<name>.ts` file from the output directory. */
export function readOutput(dir: string, name: string) {
  return readFile(join(dir, `${name}.ts`), "utf-8");
}

/**
 * Reads every generated file in the output directory into a name->contents
 * map, sorted by filename for stable snapshots. Reading the whole directory
 * (rather than a hand-picked list) guarantees no emitted file — model, enum,
 * helper or barrel — is silently left out of a snapshot.
 */
export async function readAllOutputs(dir: string): Promise<Record<string, string>> {
  const files = (await readdir(dir)).sort();
  const out: Record<string, string> = {};
  for (const file of files) {
    out[file] = await readFile(join(dir, file), "utf-8");
  }
  return out;
}
