import type { DMMF } from "@prisma/generator-helper";
import type { ProcessedModel } from "../model";
import { stringifyPlain } from "./plain";

export function processPlainInputUpdate(
  models: DMMF.Model[] | Readonly<DMMF.Model[]>,
  processedEnums: ProcessedModel[],
): ProcessedModel[] {
  const processedPlainInputUpdate: ProcessedModel[] = [];
  for (const m of models) {
    const o = stringifyPlain(m, processedEnums, false, true);
    if (o) {
      processedPlainInputUpdate.push({ name: m.name, stringRepresentation: o });
    }
  }
  return processedPlainInputUpdate;
}
