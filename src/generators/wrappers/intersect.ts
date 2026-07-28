import { generateTypeboxOptions } from "../../annotations/options";
import { getConfig } from "../../config";

export function makeIntersection(
  inputModels: string[],
  options = generateTypeboxOptions({ excludeAdditionalProperties: true }),
) {
  return `${getConfig().typeboxImportVariableName}.Intersect([${inputModels.join(
    ",",
  )}], ${options})\n`;
}
