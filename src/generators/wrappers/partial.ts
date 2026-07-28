import { generateTypeboxOptions } from "../../annotations/options";
import { getConfig } from "../../config";

export function wrapWithPartial(input: string, excludeAdditionalPropertiesInOptions = false) {
  return `${
    getConfig().typeboxImportVariableName
  }.Partial(${input}, ${generateTypeboxOptions({ excludeAdditionalProperties: excludeAdditionalPropertiesInOptions })})`;
}
