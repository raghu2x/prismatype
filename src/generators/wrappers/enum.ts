import { generateTypeboxOptions } from "../../annotations/options";
import { getConfig } from "../../config";

export function makeEnum(
  values: string[],
  // `additionalProperties` is meaningless on an enum, so it is omitted by
  // default (`excludeAdditionalProperties: false` prevents emitting it).
  options = generateTypeboxOptions({ excludeAdditionalProperties: false }),
) {
  const variants = values.map((v) => `'${v}'`).join(",");
  return `${getConfig().typeboxImportVariableName}.Enum([${variants}], ${options})\n`;
}
