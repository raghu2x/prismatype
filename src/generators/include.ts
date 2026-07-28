import type { DMMF } from "@prisma/generator-helper";
import { extractAnnotations } from "../annotations/annotations";
import { generateTypeboxOptions } from "../annotations/options";
import { getConfig } from "../config";
import type { ProcessedModel } from "../model";
import { isCompositeTypeField } from "./compositeField";
import { isPrimitivePrismaFieldType } from "./primitiveField";
import { wrapWithPartial } from "./wrappers/partial";

export function processInclude(
  models: DMMF.Model[] | Readonly<DMMF.Model[]>,
  compositeTypeNames: ReadonlySet<string> = new Set(),
): ProcessedModel[] {
  const processedInclude: ProcessedModel[] = [];
  for (const m of models) {
    const o = stringifyInclude(m, compositeTypeNames);
    if (o) {
      processedInclude.push({ name: m.name, stringRepresentation: o });
    }
  }
  return processedInclude;
}

export function stringifyInclude(
  data: DMMF.Model,
  compositeTypeNames: ReadonlySet<string> = new Set(),
) {
  const annotations = extractAnnotations(data.documentation);

  if (annotations.isHidden) return undefined;

  const fields = data.fields
    .map((field) => {
      const annotations = extractAnnotations(field.documentation);
      if (annotations.isHidden) return undefined;

      if (isPrimitivePrismaFieldType(field.type) || isCompositeTypeField(field, compositeTypeNames))
        return undefined;

      return `${field.name}: ${getConfig().typeboxImportVariableName}.Boolean()`;
    })
    .filter((x) => x) as string[];

  fields.push(`_count: ${getConfig().typeboxImportVariableName}.Boolean()`);

  const ret = `${getConfig().typeboxImportVariableName}.Object({${[...fields].join(
    ",",
  )}},${generateTypeboxOptions({ input: annotations })})\n`;

  return wrapWithPartial(ret);
}
