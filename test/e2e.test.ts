import { beforeEach, describe, expect, test } from "bun:test";
import { Type } from "typebox";
import { Value } from "typebox/value";
import { buildCompositeSchemas } from "../src/generators/compositeField";
import { stringifyPlain } from "../src/generators/plain";
import type { ProcessedModel } from "../src/model";
import { field, model } from "./fixtures/dmmf";
import { resetConfig } from "./helpers";

const noEnums: ProcessedModel[] = [];

/**
 * Evaluates a generated TypeBox source string against the real typebox
 * library, so we assert not just the string shape but that the emitted code
 * actually builds a working schema. `__nullable__` is provided since the
 * generators reference it as a helper.
 */
function evalSchema(src: string | undefined) {
  if (src === undefined) throw new Error("expected a generated schema string, got undefined");
  const nullable = <T>(schema: T) => Type.Union([Type.Null(), schema as never]);
  // oxlint-disable-next-line no-new-func -- deliberately evaluating generated output
  return new Function("Type", "__nullable__", `return ${src}`)(Type, nullable);
}

describe("e2e: generated output validates against real typebox", () => {
  beforeEach(() => resetConfig());

  test("a plain model accepts valid data and rejects invalid data", () => {
    const m = model("User", [
      field({ name: "id", type: "Int" }),
      field({ name: "name", type: "String" }),
      field({ name: "active", type: "Boolean" }),
    ]);

    const schema = evalSchema(stringifyPlain(m, noEnums));

    expect(Value.Check(schema, { id: 1, name: "Ada", active: true })).toBe(true);
    expect(Value.Check(schema, { id: "not-a-number", name: "Ada", active: true })).toBe(false);
  });

  test("additionalProperties: false is enforced in the emitted schema", () => {
    const m = model("User", [field({ name: "id", type: "Int" })]);
    const schema = evalSchema(stringifyPlain(m, noEnums));

    expect(Value.Check(schema, { id: 1 })).toBe(true);
    expect(Value.Check(schema, { id: 1, extra: "nope" })).toBe(false);
  });

  test("an optional field accepts null via the nullable helper", () => {
    const m = model("User", [
      field({ name: "id", type: "Int" }),
      field({ name: "bio", type: "String", isRequired: false }),
    ]);
    const schema = evalSchema(stringifyPlain(m, noEnums));

    expect(Value.Check(schema, { id: 1, bio: null })).toBe(true);
    expect(Value.Check(schema, { id: 1, bio: "hi" })).toBe(true);
  });

  test("an inlined MongoDB composite-type field validates nested objects", () => {
    const address = model("Address", [
      field({ name: "street", type: "String" }),
      field({ name: "city", type: "String" }),
    ]);
    const user = model("User", [
      field({ name: "id", type: "Int" }),
      field({ name: "address", type: "Address", kind: "object" }),
      field({ name: "photos", type: "Photo", kind: "object", isList: true }),
    ]);
    const photo = model("Photo", [
      field({ name: "url", type: "String" }),
      field({ name: "width", type: "Int" }),
    ]);

    const compositeSchemas = buildCompositeSchemas([address, photo], noEnums);
    const schema = evalSchema(stringifyPlain(user, noEnums, false, false, compositeSchemas));

    expect(
      Value.Check(schema, {
        id: 1,
        address: { street: "Main", city: "Metropolis" },
        photos: [{ url: "http://x", width: 100 }],
      }),
    ).toBe(true);
    // A composite field with a missing required sub-field is rejected.
    expect(
      Value.Check(schema, {
        id: 1,
        address: { street: "Main" },
        photos: [],
      }),
    ).toBe(false);
    // A non-array for a list composite field is rejected.
    expect(
      Value.Check(schema, {
        id: 1,
        address: { street: "Main", city: "Metropolis" },
        photos: { url: "http://x", width: 100 },
      }),
    ).toBe(false);
  });
});
