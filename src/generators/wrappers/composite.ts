import { generateTypeboxOptions } from "../../annotations/options";
import { getConfig } from "../../config";

export function makeComposite(inputModels: string[]) {
  const config = getConfig();
  const models = inputModels.map((i) => `${config.exportedTypePrefix}${i}`).join(",");

  // typebox >= 1.0 has no Type.Composite, Evaluate(Intersect) produces the same flattened object
  return `${config.typeboxImportVariableName}.Evaluate(${config.typeboxImportVariableName}.Intersect([${models}]), ${generateTypeboxOptions()})\n`;
}
