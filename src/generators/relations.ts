import type { DMMF } from "@prisma/generator-helper";
import { extractAnnotations } from "../annotations/annotations";
import { generateTypeboxOptions } from "../annotations/options";
import { getConfig } from "../config";
import type { ProcessedModel } from "../model";
import { isPrimitivePrismaFieldType } from "./primitiveField";
import { wrapWithArray } from "./wrappers/array";
import { wrapWithNullable } from "./wrappers/nullable";
import { wrapWithPartial } from "./wrappers/partial";

export function processRelations(
  models: DMMF.Model[] | Readonly<DMMF.Model[]>,
  processedEnums: ProcessedModel[],
  processedPlain: ProcessedModel[],
): ProcessedModel[] {
  const processedRelations: ProcessedModel[] = [];
  for (const m of models) {
    const o = stringifyRelations(m, processedEnums, processedPlain);
    if (o) {
      processedRelations.push({ name: m.name, stringRepresentation: o });
    }
  }
  return processedRelations;
}

export function stringifyRelations(
  data: DMMF.Model,
  processedEnums: ProcessedModel[],
  processedPlain: ProcessedModel[],
) {
  const annotations = extractAnnotations(data.documentation);
  if (annotations.isHidden) return undefined;

  const fields = data.fields
    .map((field) => {
      const annotations = extractAnnotations(field.documentation);

      if (
        annotations.isHidden ||
        isPrimitivePrismaFieldType(field.type) ||
        processedEnums.find((e) => e.name === field.type)
      ) {
        return undefined;
      }

      let stringifiedType = processedPlain.find((e) => e.name === field.type)?.stringRepresentation;

      if (!stringifiedType) {
        return undefined;
      }

      if (field.isList) {
        stringifiedType = wrapWithArray(stringifiedType);
      }

      if (!field.isRequired) {
        stringifiedType = wrapWithNullable(stringifiedType);
      }

      return `${field.name}: ${stringifiedType}`;
    })
    .filter((x) => x) as string[];

  return `${getConfig().typeboxImportVariableName}.Object({${fields.join(
    ",",
  )}},${generateTypeboxOptions({ input: annotations })})\n`;
}

function prismaTypeToTypeboxType(prismaType: string): string {
  switch (prismaType) {
    case "String":
      return "String";
    case "Int":
    case "BigInt":
      return "Integer";
    default:
      return "";
  }
}

/**
 * Builds the inner object used to uniquely identify a related record in a
 * `connect`/`disconnect` shape.
 *
 * Prisma allows identifying a record either by a single scalar `@id`/`@unique`
 * field (e.g. `{ id: ... }`) or by a compound key declared with `@@id([...])`
 * or `@@unique([...])`. For compound keys Prisma nests the fields under a key
 * that joins the field names with `_` (e.g. `{ userId_teamId: { userId, teamId } }`).
 *
 * Returns `undefined` when no supported unique identifier can be found.
 */
function stringifyConnectUnique(
  fieldType: string,
  allModels: DMMF.Model[] | Readonly<DMMF.Model[]>,
  options: string,
): string | undefined {
  const relatedModel = allModels.find((m) => m.name === fieldType);
  if (!relatedModel) return undefined;

  const typeboxImportVariableName = getConfig().typeboxImportVariableName;

  // Prefer a single scalar `@id` field.
  const idField = relatedModel.fields.find((f) => f.isId);
  if (idField) {
    const typeboxIdType = prismaTypeToTypeboxType(idField.type);
    if (typeboxIdType) {
      return `${typeboxImportVariableName}.Object({
				${idField.name}: ${typeboxImportVariableName}.${typeboxIdType}(${options}),
			}, ${options})`;
    }
    return undefined;
  }

  // Fall back to a compound key. A composite `@@id([...])` is exposed through
  // `primaryKey.fields`, while a compound `@@unique([...])` shows up in
  // `uniqueFields`. Prisma identifies records by such keys through a nested
  // object keyed by the field names joined with `_`.
  const compositeFields =
    (relatedModel.primaryKey?.fields.length ?? 0) > 1
      ? relatedModel.primaryKey?.fields
      : relatedModel.uniqueFields.find((fields) => fields.length > 1);
  if (!compositeFields) return undefined;

  const inner = compositeFields.map((name) => {
    const scalar = relatedModel.fields.find((f) => f.name === name);
    if (!scalar) return undefined;
    const typeboxType = prismaTypeToTypeboxType(scalar.type);
    if (!typeboxType) return undefined;
    return `${scalar.name}: ${typeboxImportVariableName}.${typeboxType}(${options})`;
  });

  if (inner.some((f) => f === undefined)) return undefined;

  const compositeName = compositeFields.join("_");
  return `${typeboxImportVariableName}.Object({
			${compositeName}: ${typeboxImportVariableName}.Object({
				${inner.join(",")}
			}, ${options}),
		}, ${options})`;
}

export function processRelationsInputCreate(
  models: DMMF.Model[] | Readonly<DMMF.Model[]>,
  processedEnums: ProcessedModel[],
): ProcessedModel[] {
  const processedRelationsInputCreate: ProcessedModel[] = [];
  for (const m of models) {
    const o = stringifyRelationsInputCreate(m, models, processedEnums);
    if (o) {
      processedRelationsInputCreate.push({
        name: m.name,
        stringRepresentation: o,
      });
    }
  }
  return processedRelationsInputCreate;
}

export function stringifyRelationsInputCreate(
  data: DMMF.Model,
  allModels: DMMF.Model[] | Readonly<DMMF.Model[]>,
  processedEnums: ProcessedModel[],
) {
  const annotations = extractAnnotations(data.documentation);
  if (annotations.isHidden || annotations.isHiddenInput || annotations.isHiddenInputCreate)
    return undefined;

  const fields = data.fields
    .map((field) => {
      const annotations = extractAnnotations(field.documentation);

      if (
        annotations.isHidden ||
        annotations.isHiddenInput ||
        annotations.isHiddenInputCreate ||
        isPrimitivePrismaFieldType(field.type) ||
        processedEnums.find((e) => e.name === field.type)
      ) {
        return undefined;
      }

      let connectString = stringifyConnectUnique(
        field.type,
        allModels,
        generateTypeboxOptions({ input: annotations }),
      );

      if (!connectString) {
        throw new Error(
          `Unsupported ID type: ${field.type} on model ${data.name} in relation ${field.name}`,
        );
      }

      if (field.isList) {
        connectString = wrapWithArray(connectString);
      }

      let stringifiedType = `${getConfig().typeboxImportVariableName}.Object({
				connect: ${connectString},
			}, ${generateTypeboxOptions()})`;

      if (!field.isRequired || field.isList) {
        stringifiedType = `${getConfig().typeboxImportVariableName}.Optional(${stringifiedType})`;
      }

      return `${field.name}: ${stringifiedType}`;
    })
    .filter((x) => x) as string[];

  return `${getConfig().typeboxImportVariableName}.Object({${fields.join(
    ",",
  )}},${generateTypeboxOptions({ input: annotations })})\n`;
}

export function processRelationsInputUpdate(
  models: DMMF.Model[] | Readonly<DMMF.Model[]>,
  processedEnums: ProcessedModel[],
): ProcessedModel[] {
  const processedRelationsInputUpdate: ProcessedModel[] = [];
  for (const m of models) {
    const o = stringifyRelationsInputUpdate(m, models, processedEnums);
    if (o) {
      processedRelationsInputUpdate.push({
        name: m.name,
        stringRepresentation: o,
      });
    }
  }
  return processedRelationsInputUpdate;
}

export function stringifyRelationsInputUpdate(
  data: DMMF.Model,
  allModels: DMMF.Model[] | Readonly<DMMF.Model[]>,
  processedEnums: ProcessedModel[],
) {
  const annotations = extractAnnotations(data.documentation);
  if (annotations.isHidden || annotations.isHiddenInput || annotations.isHiddenInputUpdate)
    return undefined;

  const fields = data.fields
    .map((field) => {
      const annotations = extractAnnotations(field.documentation);

      if (
        annotations.isHidden ||
        annotations.isHiddenInput ||
        annotations.isHiddenInputUpdate ||
        isPrimitivePrismaFieldType(field.type) ||
        processedEnums.find((e) => e.name === field.type)
      ) {
        return undefined;
      }

      const connectUnique = stringifyConnectUnique(
        field.type,
        allModels,
        generateTypeboxOptions({ input: annotations }),
      );

      if (!connectUnique) {
        throw new Error(
          `Unsupported ID type: ${field.type} on model ${data.name} in relation ${field.name}`,
        );
      }

      let stringifiedType: string;

      if (field.isList) {
        stringifiedType = wrapWithPartial(`${getConfig().typeboxImportVariableName}.Object({
						connect: ${wrapWithArray(connectUnique)},
						disconnect: ${wrapWithArray(connectUnique)}
					}, ${generateTypeboxOptions({ input: annotations })})`);
      } else {
        if (field.isRequired) {
          stringifiedType = `${getConfig().typeboxImportVariableName}.Object({
						connect: ${connectUnique}
					}, ${generateTypeboxOptions({ input: annotations })})`;
        } else {
          stringifiedType = wrapWithPartial(`${getConfig().typeboxImportVariableName}.Object({
						connect: ${connectUnique},
						disconnect: ${getConfig().typeboxImportVariableName}.Boolean()
					}, ${generateTypeboxOptions({ input: annotations })})`);
        }
      }

      return `${field.name}: ${stringifiedType}`;
    })
    .filter((x) => x) as string[];

  return wrapWithPartial(
    `${getConfig().typeboxImportVariableName}.Object({${fields.join(
      ",",
    )}},${generateTypeboxOptions({ input: annotations })})`,
  );
}
