import type { DMMF } from "@prisma/generator-helper";
import type { ProcessedModel } from "../model";
import { stringifyPlain } from "./plain";

export function processPlainInputCreate(
  models: DMMF.Model[] | Readonly<DMMF.Model[]>,
  processedEnums: ProcessedModel[],
): ProcessedModel[] {
  const processedPlainInputCreate: ProcessedModel[] = [];
  for (const m of models) {
    const o = stringifyPlain(m, processedEnums, true, false);
    if (o) {
      processedPlainInputCreate.push({ name: m.name, stringRepresentation: o });
    }
  }
  return processedPlainInputCreate;
}
