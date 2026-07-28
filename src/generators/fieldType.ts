import type { DMMF } from "@prisma/generator-helper";
import { type extractAnnotations, isTypeOverwriteVariant } from "../annotations/annotations";
import { generateTypeboxOptions } from "../annotations/options";
import type { ProcessedModel } from "../model";
import { enumNameToExportedName } from "./enum";
import {
  isPrimitivePrismaFieldType,
  type PrimitivePrismaFieldType,
  stringifyPrimitiveType,
} from "./primitiveField";

/**
 * Maps a single Prisma field to its base TypeBox type string.
 *
 * This is the shared core reused by the plain, where and where-unique
 * generators. It resolves, in order:
 *   1. a `@prismatype.typeOverwrite=` annotation (used verbatim),
 *   2. a primitive scalar via `stringifyPrimitiveType`,
 *   3. an enum reference via its exported name.
 *
 * Returns `undefined` for relation fields (anything that is neither a
 * primitive nor a known enum). Callers own list wrapping, nullability,
 * optionality and hidden-field filtering.
 */
export function stringifyFieldType(
  field: DMMF.Field,
  annotations: ReturnType<typeof extractAnnotations>,
  processedEnums: ProcessedModel[],
): string | undefined {
  if (isPrimitivePrismaFieldType(field.type)) {
    const overwrittenType = annotations.annotations.filter(isTypeOverwriteVariant).at(0)?.value;

    if (overwrittenType) {
      return overwrittenType;
    }

    return stringifyPrimitiveType({
      fieldType: field.type as PrimitivePrismaFieldType,
      options: generateTypeboxOptions({
        excludeAdditionalProperties: false,
        input: annotations,
      }),
    });
  }

  if (processedEnums.find((e) => e.name === field.type)) {
    return enumNameToExportedName(field.type);
  }

  return undefined;
}
