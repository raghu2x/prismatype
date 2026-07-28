import type { DMMF } from "@prisma/generator-helper";
import { extractAnnotations } from "../annotations/annotations";
import { generateTypeboxOptions } from "../annotations/options";
import { getConfig } from "../config";
import type { ProcessedModel } from "../model";
import { makeEnum } from "./wrappers/enum";

export function processEnums(
  enums: DMMF.DatamodelEnum[] | Readonly<DMMF.DatamodelEnum[]>,
): ProcessedModel[] {
  const processedEnums: ProcessedModel[] = [];
  for (const e of enums) {
    const stringRepresentation = stringifyEnum(e);
    if (stringRepresentation) {
      processedEnums.push({
        name: e.name,
        stringRepresentation,
      });
    }
  }
  return processedEnums;
}

export function stringifyEnum(data: DMMF.DatamodelEnum) {
  const annotations = extractAnnotations(data.documentation);
  if (annotations.isHidden) return undefined;

  return makeEnum(
    data.values.map((v) => v.name),
    generateTypeboxOptions({
      input: annotations,
      excludeAdditionalProperties: false,
    }),
  );
}

/**
 * The exported symbol name a generated enum is available under.
 * Enums are emitted once into a single `enums` file and referenced by
 * this name from model files, rather than being inlined.
 */
export function enumNameToExportedName(name: string) {
  return `${getConfig().exportedTypePrefix}${name}`;
}

/**
 * Returns the exported enum symbols referenced within a generated model
 * string, so the correct named imports can be added to its file.
 */
export function getUsedEnumImports(content: string, processedEnums: ProcessedModel[]) {
  return processedEnums
    .map((e) => enumNameToExportedName(e.name))
    .filter((exportedName) => new RegExp(`\\b${exportedName}\\b`).test(content));
}
