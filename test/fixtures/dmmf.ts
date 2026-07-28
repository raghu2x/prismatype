import type { DMMF } from "@prisma/generator-helper";

/**
 * Builds a DMMF.Field with sensible scalar defaults. Override only what a
 * test cares about. Defaults describe a required, non-list `String` field.
 */
export function field(overrides: Partial<DMMF.Field> = {}): DMMF.Field {
  return {
    name: "field",
    kind: "scalar",
    type: "String",
    isRequired: true,
    isList: false,
    isUnique: false,
    isId: false,
    isReadOnly: false,
    hasDefaultValue: false,
    isGenerated: false,
    isUpdatedAt: false,
    ...overrides,
  } as DMMF.Field;
}

/** Builds a DMMF.Model with the given fields and optional overrides. */
export function model(
  name: string,
  fields: DMMF.Field[],
  overrides: Partial<DMMF.Model> = {},
): DMMF.Model {
  return {
    name,
    dbName: null,
    fields,
    primaryKey: null,
    uniqueFields: [],
    uniqueIndexes: [],
    ...overrides,
  } as DMMF.Model;
}

/** Builds a DMMF.DatamodelEnum. */
export function datamodelEnum(name: string, values: string[]): DMMF.DatamodelEnum {
  return {
    name,
    values: values.map((v) => ({ name: v, dbName: null })),
  } as DMMF.DatamodelEnum;
}
