import { getConfig } from "../../config";

export function nullableType() {
  return `import { ${
    getConfig().typeboxImportVariableName
  }, type TSchema } from "${getConfig().typeboxImportDependencyName}"
export const ${getConfig().nullableName} = <T extends TSchema>(schema: T) => ${
    getConfig().typeboxImportVariableName
  }.Union([${getConfig().typeboxImportVariableName}.Null(), schema])\n`;
}

export function nullableImport(pathPrefix = "./") {
  return `import { ${getConfig().nullableName} } from "${pathPrefix}${
    getConfig().nullableName
  }${getConfig().importFileExtension}"\n`;
}

export function wrapWithNullable(input: string) {
  return `${getConfig().nullableName}(${input})`;
}
