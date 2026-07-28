import { beforeEach, describe, expect, test } from "bun:test";
import { extractAnnotations } from "../../src/annotations/annotations";
import { stringifyFieldType } from "../../src/generators/fieldType";
import type { ProcessedModel } from "../../src/model";
import { field } from "../fixtures/dmmf";
import { resetConfig } from "../helpers";

const enums: ProcessedModel[] = [{ name: "Role", stringRepresentation: "Type.Enum([])" }];

function annotate(doc?: string) {
  return extractAnnotations(doc);
}

describe("stringifyFieldType", () => {
  beforeEach(() => resetConfig());

  test("maps a primitive scalar via stringifyPrimitiveType", () => {
    const out = stringifyFieldType(field({ type: "String" }), annotate(), enums);
    expect(out).toBe("Type.String()");
  });

  test("uses a typeOverwrite annotation verbatim", () => {
    const out = stringifyFieldType(
      field({ type: "String" }),
      annotate("@prismatype.typeOverwrite=Type.Literal('x')"),
      enums,
    );
    expect(out).toBe("Type.Literal('x')");
  });

  test("resolves a known enum to its exported name", () => {
    const out = stringifyFieldType(field({ type: "Role" }), annotate(), enums);
    expect(out).toBe("Role");
  });

  test("applies the exported type prefix to enum references", () => {
    resetConfig({ exportedTypePrefix: "Db" });
    const out = stringifyFieldType(field({ type: "Role" }), annotate(), enums);
    expect(out).toBe("DbRole");
  });

  test("returns undefined for a relation (unknown, non-primitive) type", () => {
    const out = stringifyFieldType(field({ type: "User" }), annotate(), enums);
    expect(out).toBeUndefined();
  });
});
