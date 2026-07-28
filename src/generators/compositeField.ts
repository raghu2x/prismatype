import type { DMMF } from "@prisma/generator-helper";
import { extractAnnotations } from "../annotations/annotations";
import { generateTypeboxOptions } from "../annotations/options";
import { getConfig } from "../config";
import type { ProcessedModel } from "../model";
import { stringifyFieldType } from "./fieldType";
import { wrapWithArray } from "./wrappers/array";
import { wrapWithNullable } from "./wrappers/nullable";

/**
 * MongoDB composite types (`type` blocks) are exposed through
 * `datamodel.types`. Structurally a composite type is just a `DMMF.Model` with
 * no id and no relations, and a model references one through a `kind: "object"`
 * field whose `type` is the composite's name and which carries no
 * `relationName` (a real relation always has one).
 *
 * prismatype inlines composite types at their use sites (rather than emitting a
 * separate importable schema), mirroring how the relations generator inlines a
 * related model's plain schema. This module builds the inlined `Type.Object`
 * string for each composite type and resolves a model field to it.
 */

/** True when a field references a composite type rather than a model relation. */
export function isCompositeTypeField(
  field: DMMF.Field,
  compositeTypeNames: ReadonlySet<string>,
): boolean {
  return field.kind === "object" && compositeTypeNames.has(field.type);
}

/**
 * Builds a `name -> inlined Type.Object(...)` map for every composite type.
 *
 * Composite types may nest other composite types, so this resolves them
 * together: a field whose type is another composite is inlined by looking it up
 * in the map being built. Types are processed so that a dependency is available
 * before the composite that uses it; any still-unresolved reference (e.g. a
 * cycle) is skipped, matching how the relations generator drops fields it can't
 * resolve.
 */
export function buildCompositeSchemas(
  types: DMMF.Model[] | Readonly<DMMF.Model[]>,
  processedEnums: ProcessedModel[],
): Map<string, string> {
  const compositeTypeNames = new Set(types.map((t) => t.name));
  const schemas = new Map<string, string>();

  // Resolve iteratively: each pass emits every composite whose composite-type
  // dependencies are already resolved. Repeat until a pass makes no progress,
  // which leaves genuinely cyclic composites unresolved (and thus skipped).
  let remaining = [...types];
  while (remaining.length > 0) {
    const stillUnresolved: DMMF.Model[] = [];
    let progressed = false;

    for (const type of remaining) {
      const dependsOnUnresolved = type.fields.some(
        (f) =>
          isCompositeTypeField(f, compositeTypeNames) &&
          f.type !== type.name &&
          !schemas.has(f.type),
      );

      if (dependsOnUnresolved) {
        stillUnresolved.push(type);
        continue;
      }

      schemas.set(
        type.name,
        stringifyCompositeType(type, processedEnums, compositeTypeNames, schemas),
      );
      progressed = true;
    }

    if (!progressed) break;
    remaining = stillUnresolved;
  }

  return schemas;
}

/** Builds the `Type.Object({...})` string for a single composite type. */
function stringifyCompositeType(
  data: DMMF.Model,
  processedEnums: ProcessedModel[],
  compositeTypeNames: ReadonlySet<string>,
  resolvedSchemas: Map<string, string>,
): string {
  const annotations = extractAnnotations(data.documentation);

  const fields = data.fields
    .map((field) => {
      const fieldAnnotations = extractAnnotations(field.documentation);
      if (fieldAnnotations.isHidden) return undefined;

      let stringifiedType = isCompositeTypeField(field, compositeTypeNames)
        ? resolvedSchemas.get(field.type)
        : stringifyFieldType(field, fieldAnnotations, processedEnums);

      if (stringifiedType === undefined) return undefined;

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
  )}},${generateTypeboxOptions({ input: annotations })})`;
}
