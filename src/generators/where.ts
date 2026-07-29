import type { DMMF } from "@prisma/generator-helper";
import { extractAnnotations } from "../annotations/annotations";
import { generateTypeboxOptions } from "../annotations/options";
import { getConfig } from "../config";
import type { ProcessedModel } from "../model";
import { stringifyFieldType } from "./fieldType";
import { wrapWithArray } from "./wrappers/array";
import { makeIntersection } from "./wrappers/intersect";
import { wrapWithPartial } from "./wrappers/partial";
import { makeUnion } from "./wrappers/union";

export function processWhere(
  models: DMMF.Model[] | Readonly<DMMF.Model[]>,
  processedEnums: ProcessedModel[],
): ProcessedModel[] {
  const processedWhere: ProcessedModel[] = [];
  for (const m of models) {
    const o = stringifyWhere(m, processedEnums);
    if (o) {
      processedWhere.push({ name: m.name, stringRepresentation: o });
    }
  }
  return processedWhere;
}

export function stringifyWhere(data: DMMF.Model, processedEnums: ProcessedModel[]) {
  const annotations = extractAnnotations(data.documentation);
  if (annotations.isHidden) return undefined;

  const fields = data.fields
    .map((field) => {
      const annotations = extractAnnotations(field.documentation);
      if (annotations.isHidden) return undefined;

      let stringifiedType = stringifyFieldType(field, annotations, processedEnums);
      if (stringifiedType === undefined) return undefined;

      if (field.isList) {
        stringifiedType = wrapWithArray(stringifiedType);
      }

      return `${field.name}: ${stringifiedType}`;
    })
    .filter((x) => x) as string[];

  if (getConfig().allowRecursion) {
    return wrapWithPartial(
      `${getConfig().typeboxImportVariableName}.Cyclic({${data.name}:${
        getConfig().typeboxImportVariableName
      }.Object({${AND_OR_NOT(data.name)},${fields.join(",")}},${generateTypeboxOptions({
        excludeAdditionalProperties: true,
        input: annotations,
      })})}, "${data.name}")`,
    );
  }

  return wrapWithPartial(
    `${getConfig().typeboxImportVariableName}.Object({${fields.join(
      ",",
    )}},${generateTypeboxOptions({ excludeAdditionalProperties: true, input: annotations })})`,
  );
}

export function processWhereUnique(
  models: DMMF.Model[] | Readonly<DMMF.Model[]>,
  processedEnums: ProcessedModel[],
): ProcessedModel[] {
  const processedWhereUnique: ProcessedModel[] = [];
  for (const m of models) {
    const o = stringifyWhereUnique(m, processedEnums);
    if (o) {
      processedWhereUnique.push({ name: m.name, stringRepresentation: o });
    }
  }
  return processedWhereUnique;
}

export function stringifyWhereUnique(data: DMMF.Model, processedEnums: ProcessedModel[]) {
  const annotations = extractAnnotations(data.documentation);
  if (annotations.isHidden) return undefined;

  const uniqueCompositeFields = data.uniqueFields
    .filter((fields) => fields.length > 1)
    .map((fields) => {
      const compositeName = fields.join("_");
      const fieldObjects = fields.map(
        // oxlint-disable-next-line typescript/no-non-null-assertion -- this must exist
        (f) => data.fields.find((field) => field.name === f)!,
      );

      const stringifiedFieldObjects = fieldObjects.map((f) => {
        const annotations = extractAnnotations(f.documentation);
        if (annotations.isHidden) return undefined;

        const stringifiedType = stringifyFieldType(f, annotations, processedEnums);
        if (stringifiedType === undefined) {
          throw new Error("Invalid type for unique composite generation");
        }

        return `${f.name}: ${stringifiedType}`;
      });

      const compositeObject = `${
        getConfig().typeboxImportVariableName
      }.Object({${stringifiedFieldObjects.join(
        ",",
      )}}, ${generateTypeboxOptions({ excludeAdditionalProperties: true })})`;

      return `${compositeName}: ${compositeObject}`;
    });

  const allFields = data.fields
    .map((field) => {
      const annotations = extractAnnotations(field.documentation);
      if (annotations.isHidden) return undefined;

      let stringifiedType = stringifyFieldType(field, annotations, processedEnums);
      if (stringifiedType === undefined) return undefined;

      if (field.isList) {
        stringifiedType = wrapWithArray(stringifiedType);
      }

      return `${field.name}: ${stringifiedType}`;
    })
    .filter((x) => x) as string[];

  const uniqueFields = data.fields
    .map((field) => {
      const annotations = extractAnnotations(field.documentation);
      if (annotations.isHidden) return undefined;
      if (!field.isUnique && !field.isId) return undefined;

      let stringifiedType = stringifyFieldType(field, annotations, processedEnums);
      if (stringifiedType === undefined) return undefined;

      if (field.isList) {
        stringifiedType = wrapWithArray(stringifiedType);
      }

      return `${field.name}: ${stringifiedType}`;
    })
    .filter((x) => x) as string[];

  const uniqueBaseObject = `${getConfig().typeboxImportVariableName}.Object({${[
    ...uniqueFields,
    ...uniqueCompositeFields,
  ].join(
    ",",
  )}},${generateTypeboxOptions({ excludeAdditionalProperties: true, input: annotations })})`;

  if (getConfig().allowRecursion) {
    return `${getConfig().typeboxImportVariableName}.Cyclic({${data.name}: ${makeIntersection([
      wrapWithPartial(uniqueBaseObject, true),
      makeUnion(
        [...uniqueFields, ...uniqueCompositeFields].map(
          (f) => `${getConfig().typeboxImportVariableName}.Object({${f}})`,
        ),
      ),
      wrapWithPartial(
        `${getConfig().typeboxImportVariableName}.Object({${AND_OR_NOT(data.name)}})`,
        true,
      ),
      wrapWithPartial(
        `${
          getConfig().typeboxImportVariableName
        }.Object({${allFields.join(",")}}, ${generateTypeboxOptions()})`,
      ),
    ])}}, "${data.name}")`;
  }

  return makeIntersection([
    wrapWithPartial(uniqueBaseObject, true),
    makeUnion(
      [...uniqueFields, ...uniqueCompositeFields].map(
        (f) => `${getConfig().typeboxImportVariableName}.Object({${f}})`,
      ),
    ),
    wrapWithPartial(`${getConfig().typeboxImportVariableName}.Object({${allFields.join(",")}})`),
  ]);
}

function AND_OR_NOT(modelName: string) {
  const self = `${getConfig().typeboxImportVariableName}.Ref("${modelName}")`;
  return `AND: ${getConfig().typeboxImportVariableName}.Union([${self}, ${wrapWithArray(self)}]),
	NOT: ${getConfig().typeboxImportVariableName}.Union([${self}, ${wrapWithArray(self)}]),
	OR: ${wrapWithArray(self)}`;
}
