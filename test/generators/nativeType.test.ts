import { describe, expect, test } from "bun:test";
import { deriveNativeTypeOptions } from "../../src/generators/nativeType";
import { field } from "../fixtures/dmmf";

describe("deriveNativeTypeOptions", () => {
  test("derives maxLength from @db.VarChar(n)", () => {
    const f = field({ nativeType: ["VarChar", ["255"]] });
    expect(deriveNativeTypeOptions(f)).toBe("maxLength: 255");
  });

  test("derives maxLength from @db.Char(n) (as maxLength only, no minLength)", () => {
    const f = field({ nativeType: ["Char", ["10"]] });
    expect(deriveNativeTypeOptions(f)).toBe("maxLength: 10");
  });

  test("matches provider variants case-insensitively", () => {
    expect(deriveNativeTypeOptions(field({ nativeType: ["NVarChar", ["40"]] }))).toBe(
      "maxLength: 40",
    );
    expect(deriveNativeTypeOptions(field({ nativeType: ["nchar", ["8"]] }))).toBe("maxLength: 8");
    expect(deriveNativeTypeOptions(field({ nativeType: ["VarChar2", ["12"]] }))).toBe(
      "maxLength: 12",
    );
  });

  test("returns undefined when there is no native type", () => {
    expect(deriveNativeTypeOptions(field())).toBeUndefined();
    expect(deriveNativeTypeOptions(field({ nativeType: null }))).toBeUndefined();
  });

  test("returns undefined for length-less native types", () => {
    expect(deriveNativeTypeOptions(field({ nativeType: ["Text", []] }))).toBeUndefined();
    expect(deriveNativeTypeOptions(field({ nativeType: ["Uuid", []] }))).toBeUndefined();
  });

  test("returns undefined for a non-string native type", () => {
    // e.g. @db.Decimal(10, 2) is not a length-bearing string type
    expect(
      deriveNativeTypeOptions(field({ nativeType: ["Decimal", ["10", "2"]] })),
    ).toBeUndefined();
  });

  test("returns undefined when the length argument is missing or non-numeric", () => {
    expect(deriveNativeTypeOptions(field({ nativeType: ["VarChar", []] }))).toBeUndefined();
    expect(deriveNativeTypeOptions(field({ nativeType: ["VarChar", ["abc"]] }))).toBeUndefined();
    expect(deriveNativeTypeOptions(field({ nativeType: ["VarChar", ["0"]] }))).toBeUndefined();
  });
});
