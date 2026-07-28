import { getConfig } from "../config";

const PrimitiveFields = [
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "String",
  "DateTime",
  "Json",
  "Boolean",
  "Bytes",
] as const;

export type PrimitivePrismaFieldType = (typeof PrimitiveFields)[number];

export function isPrimitivePrismaFieldType(str: string): str is PrimitivePrismaFieldType {
  // oxlint-disable-next-line typescript/no-explicit-any -- we want to check if the string is a valid primitive field
  return PrimitiveFields.includes(str as any);
}

export function stringifyPrimitiveType({
  fieldType,
  options,
}: {
  fieldType: PrimitivePrismaFieldType;
  options: string;
}) {
  if (["Int", "BigInt"].includes(fieldType)) {
    return `${getConfig().typeboxImportVariableName}.Integer(${options})`;
  }

  if (["Float", "Decimal"].includes(fieldType)) {
    return `${getConfig().typeboxImportVariableName}.Number(${options})`;
  }

  if (fieldType === "String") {
    return `${getConfig().typeboxImportVariableName}.String(${options})`;
  }

  if (["DateTime"].includes(fieldType)) {
    const config = getConfig();
    if (config.useJsonTypes === "transformer") {
      return `${getConfig().transformDateName}(${options})`;
    }

    if (config.useJsonTypes) {
      let opts = options;
      if (opts.includes("{") && opts.includes("}")) {
        opts = opts.replace("{", "{ format: 'date-time', ");
      } else {
        opts = `{ format: 'date-time' }`;
      }
      return `${config.typeboxImportVariableName}.String(${opts})`;
    }

    // typebox >= 1.0 has no Type.Date, validate the JS Date instance via Refine
    return `${config.typeboxImportVariableName}.Refine(${config.typeboxImportVariableName}.Unsafe<Date>(${options || "{}"}), (value) => value instanceof Date)`;
  }

  if (fieldType === "Json") {
    return `${getConfig().typeboxImportVariableName}.Any(${options})`;
  }

  if (fieldType === "Boolean") {
    return `${getConfig().typeboxImportVariableName}.Boolean(${options})`;
  }

  if (fieldType === "Bytes") {
    const config = getConfig();
    // typebox >= 1.0 has no Type.Uint8Array, validate the instance via Refine
    return `${config.typeboxImportVariableName}.Refine(${config.typeboxImportVariableName}.Unsafe<Uint8Array>(${options || "{}"}), (value) => value instanceof Uint8Array)`;
  }

  throw new Error("Invalid type for primitive generation");
}
