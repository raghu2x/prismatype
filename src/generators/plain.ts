import type { DMMF } from "@prisma/generator-helper";
import { extractAnnotations } from "../annotations/annotations";
import { generateTypeboxOptions } from "../annotations/options";
import { getConfig } from "../config";
import type { ProcessedModel } from "../model";
import { stringifyFieldType } from "./fieldType";
import { wrapWithArray } from "./wrappers/array";
import { wrapWithNullable } from "./wrappers/nullable";
import { wrapWithOptional } from "./wrappers/optional";

export function processPlain(
  models: DMMF.Model[] | Readonly<DMMF.Model[]>,
  processedEnums: ProcessedModel[],
  compositeSchemas: Map<string, string> = new Map(),
): ProcessedModel[] {
  const processedPlain: ProcessedModel[] = [];
  for (const m of models) {
    const o = stringifyPlain(m, processedEnums, false, false, compositeSchemas);
    if (o) {
      processedPlain.push({ name: m.name, stringRepresentation: o });
    }
  }
  return processedPlain;
}

export function stringifyPlain(
  data: DMMF.Model,
  processedEnums: ProcessedModel[],
  isInputModelCreate = false,
  isInputModelUpdate = false,
  compositeSchemas: Map<string, string> = new Map(),
) {
  const annotations = extractAnnotations(data.documentation);

  if (
    annotations.isHidden ||
    ((isInputModelCreate || isInputModelUpdate) && annotations.isHiddenInput) ||
    (isInputModelCreate && annotations.isHiddenInputCreate) ||
    (isInputModelUpdate && annotations.isHiddenInputUpdate)
  )
    return undefined;

  const fields = data.fields
    .map((field) => {
      const annotations = extractAnnotations(field.documentation);
      if (
        annotations.isHidden ||
        ((isInputModelCreate || isInputModelUpdate) && annotations.isHiddenInput) ||
        (isInputModelCreate && annotations.isHiddenInputCreate) ||
        (isInputModelUpdate && annotations.isHiddenInputUpdate)
      )
        return undefined;

      // ===============================
      // INPUT MODEL FILTERS
      // ===============================
      // if we generate an input model we want to omit certain fields

      if (
        getConfig().ignoreIdOnInputModel &&
        (isInputModelCreate || isInputModelUpdate) &&
        field.isId
      )
        return undefined;
      if (
        getConfig().ignoreCreatedAtOnInputModel &&
        (isInputModelCreate || isInputModelUpdate) &&
        field.name === "createdAt" &&
        field.hasDefaultValue
      )
        return undefined;
      if (
        getConfig().ignoreUpdatedAtOnInputModel &&
        (isInputModelCreate || isInputModelUpdate) &&
        field.isUpdatedAt
      )
        return undefined;

      if (
        getConfig().ignoreForeignOnInputModel &&
        (isInputModelCreate || isInputModelUpdate) &&
        (field.name.toLowerCase().endsWith("id") ||
          field.name.toLowerCase().endsWith("foreign") ||
          field.name.toLowerCase().endsWith("foreignkey"))
      ) {
        return undefined;
      }

      // ===============================
      // INPUT MODEL FILTERS END
      // ===============================

      // A MongoDB composite-type field inlines the composite's object; anything
      // else resolves to a scalar/enum. Both then flow through the same list /
      // nullability / optionality wrapping below.
      let stringifiedType =
        (field.kind === "object" ? compositeSchemas.get(field.type) : undefined) ??
        stringifyFieldType(field, annotations, processedEnums);

      if (stringifiedType === undefined) {
        return undefined;
      }

      if (field.isList) {
        stringifiedType = wrapWithArray(stringifiedType);
      }

      let madeOptional = false;

      if (!field.isRequired) {
        stringifiedType = wrapWithNullable(stringifiedType);
      }

      if (
        isInputModelUpdate ||
        (isInputModelCreate && !field.isRequired && !field.hasDefaultValue)
      ) {
        stringifiedType = wrapWithOptional(stringifiedType);
        madeOptional = true;
      }

      if (!madeOptional && field.hasDefaultValue && (isInputModelCreate || isInputModelUpdate)) {
        stringifiedType = wrapWithOptional(stringifiedType);
        madeOptional = true;
      }

      return `${field.name}: ${stringifiedType}`;
    })
    .filter((x) => x) as string[];

  return `${getConfig().typeboxImportVariableName}.Object({${[
    ...fields,
    !(isInputModelCreate || isInputModelUpdate) ? (getConfig().additionalFieldsPlain ?? []) : [],
  ].join(",")}},${generateTypeboxOptions({ input: annotations })})\n`;
}
