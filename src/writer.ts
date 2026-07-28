import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateBarrelFile } from "./barrel";
import { getConfig } from "./config";
import { format } from "./format";
import { type Collections, mapAllModelsForWrite } from "./model";

export async function write(collections: Collections) {
  const mappings = Array.from(mapAllModelsForWrite(collections).entries());
  return Promise.all([
    ...mappings.map(async ([name, content]) => {
      return writeFile(join(getConfig().output, `${name}.ts`), await format(content));
    }),
    writeFile(
      join(getConfig().output, "barrel.ts"),
      await format(generateBarrelFile(mappings.map(([key]) => key))),
    ),
  ]);
}
