import { getConfig } from "../config";

export function transformDateType() {
  const config = getConfig();
  return `import { ${config.typeboxImportVariableName} } from "${config.typeboxImportDependencyName}";
  export const ${config.transformDateName} = (options?: Parameters<typeof ${config.typeboxImportVariableName}.String>[0]) => ${config.typeboxImportVariableName}.Codec(${config.typeboxImportVariableName}.String({ format: 'date-time', ...options }))
   .Decode((value) => new Date(value))
   .Encode((value) => value.toISOString())\n`;
}

export function transformDateImportStatement() {
  return `import { ${getConfig().transformDateName} } from "./${
    getConfig().transformDateName
  }${getConfig().importFileExtension}"\n`;
}
