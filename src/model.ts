import { getConfig } from "./config";
import { getUsedEnumImports } from "./generators/enum";
import { transformDateImportStatement, transformDateType } from "./generators/transformDate";
import { makeComposite } from "./generators/wrappers/composite";
import { nullableImport, nullableType } from "./generators/wrappers/nullable";

export type ProcessedModel = {
  name: string;
  stringRepresentation: string;
};

/**
 * The full set of processed schema strings produced by the generators for a
 * single generate run. Threaded explicitly through assembly so no generator
 * relies on module-level mutable state.
 */
export type Collections = {
  enums: ProcessedModel[];
  plain: ProcessedModel[];
  relations: ProcessedModel[];
  plainInputCreate: ProcessedModel[];
  plainInputUpdate: ProcessedModel[];
  relationsInputCreate: ProcessedModel[];
  relationsInputUpdate: ProcessedModel[];
  where: ProcessedModel[];
  whereUnique: ProcessedModel[];
  select: ProcessedModel[];
  include: ProcessedModel[];
  orderBy: ProcessedModel[];
};

function convertModelToStandalone(input: Pick<ProcessedModel, "name" | "stringRepresentation">) {
  return `export const ${getConfig().exportedTypePrefix}${input.name} = ${input.stringRepresentation}\n`;
}

function typepoxImportStatement() {
  return `import { ${getConfig().typeboxImportVariableName} } from "${
    getConfig().typeboxImportDependencyName
  }"\n`;
}

function enumImportStatement(content: string, processedEnums: ProcessedModel[]) {
  const usedEnums = getUsedEnumImports(content, processedEnums);
  if (usedEnums.length === 0) return "";
  return `import { ${usedEnums.join(", ")} } from "./${
    getConfig().enumsFileName
  }${getConfig().importFileExtension}"\n`;
}

function stringifyEnumsFile(processedEnums: ProcessedModel[]) {
  return processedEnums
    .map((e) =>
      convertModelToStandalone({
        name: e.name,
        stringRepresentation: e.stringRepresentation,
      }),
    )
    .join("\n");
}

export function mapAllModelsForWrite(collections: Collections) {
  const {
    enums: processedEnums,
    plain: processedPlain,
    relations: processedRelations,
    plainInputCreate: processedPlainInputCreate,
    plainInputUpdate: processedPlainInputUpdate,
    relationsInputCreate: processedRelationsInputCreate,
    relationsInputUpdate: processedRelationsInputUpdate,
    where: processedWhere,
    whereUnique: processedWhereUnique,
    select: processedSelect,
    include: processedInclude,
    orderBy: processedOrderBy,
  } = collections;

  const modelsPerName = new Map<ProcessedModel["name"], ProcessedModel["stringRepresentation"]>();

  const process = (models: ProcessedModel[], suffix: string) => {
    for (const processedModel of models) {
      const standalone = convertModelToStandalone({
        ...processedModel,
        name: `${processedModel.name}${suffix}`,
      });
      const current = modelsPerName.get(processedModel.name);
      if (current) {
        modelsPerName.set(processedModel.name, `${current}\n${standalone}`);
      } else {
        modelsPerName.set(processedModel.name, standalone);
      }
    }
  };

  process(processedPlain, "Plain");
  process(processedRelations, "Relations");
  process(processedPlainInputCreate, "PlainInputCreate");
  process(processedPlainInputUpdate, "PlainInputUpdate");
  process(processedRelationsInputCreate, "RelationsInputCreate");
  process(processedRelationsInputUpdate, "RelationsInputUpdate");
  process(processedWhere, "Where");
  process(processedWhereUnique, "WhereUnique");
  process(processedSelect, "Select");
  process(processedInclude, "Include");
  process(processedOrderBy, "OrderBy");

  for (const [key, value] of modelsPerName) {
    const plain = processedPlain.find((e) => e.name === key);
    const relations = processedRelations.find((e) => e.name === key);
    let composite: string;
    if (plain && relations) {
      composite = makeComposite([`${key}Plain`, `${key}Relations`]);
    } else if (plain) {
      composite = `${key}Plain`;
    } else if (relations) {
      composite = `${key}Relations`;
    } else {
      continue;
    }

    modelsPerName.set(
      key,
      `${value}\n${convertModelToStandalone({
        name: key,
        stringRepresentation: composite,
      })}`,
    );
  }

  for (const [key, value] of modelsPerName) {
    const create = processedRelationsInputCreate.find((e) => e.name === key);

    if (create) {
      const composite = makeComposite([`${key}PlainInputCreate`, `${key}RelationsInputCreate`]);
      modelsPerName.set(
        key,
        `${value}\n${convertModelToStandalone({
          name: `${key}InputCreate`,
          stringRepresentation: composite,
        })}`,
      );
    }
  }

  for (const [key, value] of modelsPerName) {
    const update = processedRelationsInputUpdate.find((e) => e.name === key);

    if (update) {
      const composite = makeComposite([`${key}PlainInputUpdate`, `${key}RelationsInputUpdate`]);
      modelsPerName.set(
        key,
        `${value}\n${convertModelToStandalone({
          name: `${key}InputUpdate`,
          stringRepresentation: composite,
        })}`,
      );
    }
  }

  for (const [key, value] of modelsPerName) {
    modelsPerName.set(
      key,
      `${typepoxImportStatement()}\n${transformDateImportStatement()}\n${nullableImport()}\n${enumImportStatement(
        value,
        processedEnums,
      )}\n${value}`,
    );
  }

  if (processedEnums.length > 0) {
    modelsPerName.set(
      getConfig().enumsFileName,
      `${typepoxImportStatement()}\n${stringifyEnumsFile(processedEnums)}`,
    );
  }

  modelsPerName.set(getConfig().nullableName, nullableType());
  modelsPerName.set(getConfig().transformDateName, transformDateType());

  return modelsPerName;
}
