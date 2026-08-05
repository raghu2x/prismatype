import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfig, MODEL_BARREL_FILE_NAME, MODELS_DIR_NAME } from "./config";
import { format } from "./format";
import { type Collections, mapAllModelsForWrite } from "./model";

/**
 * Builds the root-level `model.ts` barrel that re-exports every generated model
 * file from the `models/` subdirectory. It deliberately does not re-export the
 * shared enums file or the helper modules.
 */
function generateModelBarrelFile(modelNames: string[]) {
  return modelNames
    .map(
      (name) => `export * from "./${MODELS_DIR_NAME}/${name}${getConfig().importFileExtension}";`,
    )
    .join("\n");
}

export async function write(collections: Collections) {
  const { models, root } = mapAllModelsForWrite(collections);
  const output = getConfig().output;
  const modelsDir = join(output, MODELS_DIR_NAME);

  await mkdir(modelsDir, { recursive: true });

  const modelEntries = Array.from(models.entries());
  const rootEntries = Array.from(root.entries());

  return Promise.all([
    ...modelEntries.map(async ([name, content]) => {
      return writeFile(join(modelsDir, `${name}.ts`), await format(content));
    }),
    ...rootEntries.map(async ([name, content]) => {
      return writeFile(join(output, `${name}.ts`), await format(content));
    }),
    writeFile(
      join(output, `${MODEL_BARREL_FILE_NAME}.ts`),
      await format(generateModelBarrelFile(modelEntries.map(([name]) => name))),
    ),
  ]);
}
