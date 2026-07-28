import type { DMMF } from "@prisma/generator-helper";
import { extractAnnotations } from "../annotations/annotations";
import { generateTypeboxOptions } from "../annotations/options";
import { getConfig } from "../config";
import type { ProcessedModel } from "../model";
import { isPrimitivePrismaFieldType } from "./primitiveField";
import { makeEnum } from "./wrappers/enum";
import { wrapWithPartial } from "./wrappers/partial";

export function processOrderBy(models: DMMF.Model[] | Readonly<DMMF.Model[]>): ProcessedModel[] {
  const processedOrderBy: ProcessedModel[] = [];
  for (const m of models) {
    const o = stringifyOrderBy(m);
    if (o) {
      processedOrderBy.push({ name: m.name, stringRepresentation: o });
    }
  }
  return processedOrderBy;
}

export function stringifyOrderBy(data: DMMF.Model) {
  const annotations = extractAnnotations(data.documentation);

  if (annotations.isHidden) return undefined;

  const fields = data.fields
    .map((field) => {
      const annotations = extractAnnotations(field.documentation);
      if (annotations.isHidden) return undefined;

      // Relation fields are intentionally omitted; only scalar fields are
      // orderable in the generated schema.
      if (isPrimitivePrismaFieldType(field.type)) {
        return `${field.name}: ${makeEnum(["asc", "desc"])}`;
      }
    })
    .filter((x) => x) as string[];

  const ret = `${getConfig().typeboxImportVariableName}.Object({${[...fields].join(
    ",",
  )}},${generateTypeboxOptions({ input: annotations })})\n`;

  return wrapWithPartial(ret);
}
