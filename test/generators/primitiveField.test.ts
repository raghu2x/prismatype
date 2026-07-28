import { beforeEach, describe, expect, test } from "bun:test";
import {
  isPrimitivePrismaFieldType,
  stringifyPrimitiveType,
} from "../../src/generators/primitiveField";
import { resetConfig } from "../helpers";

describe("isPrimitivePrismaFieldType", () => {
  test("recognizes primitives", () => {
    for (const t of [
      "Int",
      "BigInt",
      "Float",
      "Decimal",
      "String",
      "DateTime",
      "Json",
      "Boolean",
      "Bytes",
    ]) {
      expect(isPrimitivePrismaFieldType(t)).toBe(true);
    }
  });

  test("rejects non-primitives", () => {
    expect(isPrimitivePrismaFieldType("User")).toBe(false);
    expect(isPrimitivePrismaFieldType("Role")).toBe(false);
  });
});

describe("stringifyPrimitiveType", () => {
  beforeEach(() => resetConfig());

  const cases: [string, string][] = [
    ["Int", "Type.Integer()"],
    ["BigInt", "Type.Integer()"],
    ["Float", "Type.Number()"],
    ["Decimal", "Type.Number()"],
    ["String", "Type.String()"],
    ["Json", "Type.Any()"],
    ["Boolean", "Type.Boolean()"],
  ];

  for (const [fieldType, expected] of cases) {
    test(`maps ${fieldType}`, () => {
      // @ts-expect-error narrowing not needed for the test literal
      expect(stringifyPrimitiveType({ fieldType, options: "" })).toBe(expected);
    });
  }

  test("DateTime defaults to a Refine over a Date instance", () => {
    const out = stringifyPrimitiveType({ fieldType: "DateTime", options: "" });
    expect(out).toContain("Type.Refine(");
    expect(out).toContain("Type.Unsafe<Date>({})");
    expect(out).toContain("value instanceof Date");
  });

  test("DateTime with useJsonTypes=true emits a date-time formatted string", () => {
    resetConfig({ useJsonTypes: "true" });
    const out = stringifyPrimitiveType({ fieldType: "DateTime", options: "" });
    expect(out).toBe("Type.String({ format: 'date-time' })");
  });

  test('DateTime with useJsonTypes="transformer" uses the transformer helper', () => {
    resetConfig({ useJsonTypes: "transformer" });
    const out = stringifyPrimitiveType({ fieldType: "DateTime", options: "" });
    expect(out).toBe("__transformDate__()");
  });

  test("DateTime with useJsonTypes=true merges format into existing options", () => {
    resetConfig({ useJsonTypes: "true" });
    const out = stringifyPrimitiveType({ fieldType: "DateTime", options: "{ minLength: 1 }" });
    expect(out).toBe("Type.String({ format: 'date-time',  minLength: 1 })");
  });

  test("Bytes threads through provided options", () => {
    const out = stringifyPrimitiveType({ fieldType: "Bytes", options: "{ title: 'b' }" });
    expect(out).toContain("Type.Unsafe<Uint8Array>({ title: 'b' })");
  });
});
