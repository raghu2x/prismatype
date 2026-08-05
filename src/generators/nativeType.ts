import type { DMMF } from "@prisma/generator-helper";

/**
 * Native database column types that carry a length argument prismatype can turn
 * into a TypeBox `maxLength` string constraint. Matched case-insensitively so
 * the different provider spellings (`VarChar`, `NVarChar`, `Char`, `NChar`,
 * `VarChar2`, ...) all resolve. Length-less text types (`Text`, `LongText`,
 * `Bytes`, ...) are intentionally absent: they have no bound to derive.
 */
const LENGTH_BEARING_NATIVE_TYPES = new Set([
  "char",
  "nchar",
  "varchar",
  "nvarchar",
  "varchar2",
  "nvarchar2",
]);

/**
 * Derives a TypeBox options fragment (e.g. `maxLength: 255`) from a field's
 * native database type, or `undefined` when nothing can be derived.
 *
 * Only length-bearing string column types (`@db.VarChar(n)`, `@db.Char(n)` and
 * their provider variants) yield a fragment. Per the design, fixed-length
 * `Char(n)` is treated identically to `VarChar(n)`: only a `maxLength` is
 * emitted, never a `minLength`, so unpadded input is still accepted.
 *
 * The returned string is a bare object-property fragment (no braces) so callers
 * can merge it into the trailing `{...}` options of a `Type.String(...)` call.
 */
export function deriveNativeTypeOptions(field: DMMF.Field): string | undefined {
  const nativeType = field.nativeType;
  if (!nativeType) {
    return undefined;
  }

  const [name, args] = nativeType;
  if (!LENGTH_BEARING_NATIVE_TYPES.has(name.toLowerCase())) {
    return undefined;
  }

  const rawLength = args?.[0];
  if (rawLength === undefined) {
    return undefined;
  }

  const length = Number.parseInt(rawLength, 10);
  if (!Number.isInteger(length) || length <= 0) {
    return undefined;
  }

  return `maxLength: ${length}`;
}
