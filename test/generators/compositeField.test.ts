import { beforeEach, describe, expect, test } from "bun:test";
import { buildCompositeSchemas, isCompositeTypeField } from "../../src/generators/compositeField";
import type { ProcessedModel } from "../../src/model";
import { field, model } from "../fixtures/dmmf";
import { resetConfig } from "../helpers";

const noEnums: ProcessedModel[] = [];

describe("isCompositeTypeField", () => {
  const names = new Set(["Address"]);

  test("true for an object field whose type is a known composite", () => {
    expect(isCompositeTypeField(field({ type: "Address", kind: "object" }), names)).toBe(true);
  });

  test("false for a relation to a model (not in the composite set)", () => {
    expect(isCompositeTypeField(field({ type: "Post", kind: "object" }), names)).toBe(false);
  });

  test("false for a scalar field", () => {
    expect(isCompositeTypeField(field({ type: "String", kind: "scalar" }), names)).toBe(false);
  });
});

describe("buildCompositeSchemas", () => {
  beforeEach(() => resetConfig());

  test("builds an inlined Type.Object for a composite type", () => {
    const address = model("Address", [
      field({ name: "street", type: "String" }),
      field({ name: "city", type: "String" }),
    ]);

    const schemas = buildCompositeSchemas([address], noEnums);
    const addr = schemas.get("Address");

    expect(addr).toBeDefined();
    expect(addr).toContain("street: Type.String()");
    expect(addr).toContain("city: Type.String()");
    expect(addr).toStartWith("Type.Object(");
  });

  test("wraps a list scalar field inside a composite type in Type.Array", () => {
    const address = model("Address", [
      field({ name: "city", type: "String" }),
      field({ name: "tags", type: "String", isList: true }),
    ]);

    const addr = buildCompositeSchemas([address], noEnums).get("Address");

    expect(addr).toContain("tags: Type.Array(Type.String(");
  });

  test("makes an optional scalar field inside a composite type nullable", () => {
    const address = model("Address", [
      field({ name: "city", type: "String" }),
      field({ name: "zip", type: "String", isRequired: false }),
    ]);

    const addr = buildCompositeSchemas([address], noEnums).get("Address");

    expect(addr).toContain("zip: __nullable__(");
  });

  test("inlines a nested composite type into its parent", () => {
    const geo = model("Geo", [
      field({ name: "lat", type: "Float" }),
      field({ name: "lng", type: "Float" }),
    ]);
    const address = model("Address", [
      field({ name: "city", type: "String" }),
      field({ name: "geo", type: "Geo", kind: "object" }),
    ]);

    const schemas = buildCompositeSchemas([address, geo], noEnums);
    const addr = schemas.get("Address");

    // The nested Geo object is inlined, not referenced by name.
    expect(addr).toContain("geo:");
    expect(addr).toContain("lat:");
    expect(addr).toContain("lng:");
  });

  test("skips a self-referential composite field rather than looping forever", () => {
    const node = model("Node", [
      field({ name: "label", type: "String" }),
      field({ name: "child", type: "Node", kind: "object", isRequired: false }),
    ]);

    const schemas = buildCompositeSchemas([node], noEnums);
    const built = schemas.get("Node");

    expect(built).toBeDefined();
    expect(built).toContain("label:");
    // The unresolvable self-reference is dropped.
    expect(built).not.toContain("child:");
  });
});
