import { access, mkdir, rm } from "node:fs/promises";
import { generatorHandler } from "@prisma/generator-helper";
import { getConfig, setConfig } from "./config";
import { buildCompositeSchemas } from "./generators/compositeField";
import { processEnums } from "./generators/enum";
import { processInclude } from "./generators/include";
import { processOrderBy } from "./generators/orderBy";
import { processPlain } from "./generators/plain";
import { processPlainInputCreate } from "./generators/plainInputCreate";
import { processPlainInputUpdate } from "./generators/plainInputUpdate";
import {
  processRelations,
  processRelationsInputCreate,
  processRelationsInputUpdate,
} from "./generators/relations";
import { processSelect } from "./generators/select";
import { processWhere, processWhereUnique } from "./generators/where";
import { write } from "./writer";

generatorHandler({
  onManifest() {
    return {
      defaultOutput: "./prismatype",
      prettyName: "prismatype",
    };
  },
  async onGenerate(options) {
    setConfig({
      ...options.generator.config,
      // for some reason, the output is an object with a value key
      output: options.generator.output?.value,
    });

    const config = getConfig();

    try {
      await access(config.output);
      await rm(config.output, { recursive: true });
    } catch {}

    await mkdir(config.output, { recursive: true });

    const { models, enums, types } = options.dmmf.datamodel;

    const processedEnums = processEnums(enums);
    // MongoDB composite types (`type` blocks) are inlined into the models that
    // reference them; build their schemas (and name set) once and thread them
    // through the generators.
    const compositeSchemas = buildCompositeSchemas(types, processedEnums);
    const compositeTypeNames = new Set(types.map((t) => t.name));

    const processedPlain = processPlain(models, processedEnums, compositeSchemas);

    await write({
      enums: processedEnums,
      plain: processedPlain,
      relations: processRelations(models, processedEnums, processedPlain, compositeTypeNames),
      where: processWhere(models, processedEnums),
      whereUnique: processWhereUnique(models, processedEnums),
      plainInputCreate: config.inputModel
        ? processPlainInputCreate(models, processedEnums, compositeSchemas)
        : [],
      plainInputUpdate: config.inputModel
        ? processPlainInputUpdate(models, processedEnums, compositeSchemas)
        : [],
      relationsInputCreate: config.inputModel
        ? processRelationsInputCreate(models, processedEnums, compositeTypeNames)
        : [],
      relationsInputUpdate: config.inputModel
        ? processRelationsInputUpdate(models, processedEnums, compositeTypeNames)
        : [],
      select: processSelect(models),
      include: processInclude(models, compositeTypeNames),
      orderBy: processOrderBy(models),
    });
  },
});
