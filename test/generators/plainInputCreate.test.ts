import { beforeEach, describe, expect, test } from "bun:test";
import { processPlainInputCreate } from "../../src/generators/plainInputCreate";
import type { ProcessedModel } from "../../src/model";
import { field, model } from "../fixtures/dmmf";
import { resetConfig } from "../helpers";

const noEnums: ProcessedModel[] = [];

describe("processPlainInputCreate", () => {
  beforeEach(() => resetConfig());

  test("returns one ProcessedModel per non-hidden model", () => {
    const models = [model("A", [field({ name: "name" })]), model("B", [field({ name: "name" })])];
    const out = processPlainInputCreate(models, noEnums);
    expect(out.map((m) => m.name)).toEqual(["A", "B"]);
    expect(out[0]?.stringRepresentation).toContain("Type.Object({");
  });

  test("is pure: a second call yields an equal, fresh array", () => {
    const models = [model("A", [field({ name: "name" })])];
    const first = processPlainInputCreate(models, noEnums);
    const second = processPlainInputCreate(models, noEnums);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  test("drops a model that stringifies to undefined (fully hidden)", () => {
    const models = [
      model("Visible", [field({ name: "name" })]),
      model("Secret", [field({ name: "name" })], {
        documentation: "@prismatype.hidden",
      } as never),
    ];
    const out = processPlainInputCreate(models, noEnums);
    expect(out.map((m) => m.name)).toEqual(["Visible"]);
  });

  test("required scalar without a default stays required (not optional)", () => {
    const m = model("User", [field({ name: "email", isRequired: true, hasDefaultValue: false })]);
    const out = processPlainInputCreate([m], noEnums)[0]?.stringRepresentation ?? "";
    expect(out).toContain("email: Type.String(");
    expect(out).not.toContain("email: Type.Optional(");
  });

  test("required scalar with a default becomes optional", () => {
    const m = model("User", [field({ name: "status", isRequired: true, hasDefaultValue: true })]);
    const out = processPlainInputCreate([m], noEnums)[0]?.stringRepresentation ?? "";
    expect(out).toContain("status: Type.Optional(");
  });

  test("optional scalar without a default becomes optional and nullable", () => {
    const m = model("User", [field({ name: "bio", isRequired: false, hasDefaultValue: false })]);
    const out = processPlainInputCreate([m], noEnums)[0]?.stringRepresentation ?? "";
    expect(out).toContain("bio: Type.Optional(__nullable__(");
  });

  test("respects the @prismatype.create.input.hide field annotation", () => {
    const m = model("User", [
      field({ name: "name" }),
      field({ name: "internal", documentation: "@prismatype.create.input.hide" }),
    ]);
    const out = processPlainInputCreate([m], noEnums)[0]?.stringRepresentation ?? "";
    expect(out).toContain("name:");
    expect(out).not.toContain("internal:");
  });

  test("omits the id field by default (ignoreIdOnInputModel)", () => {
    const m = model("User", [
      field({ name: "id", type: "Int", isId: true }),
      field({ name: "name" }),
    ]);
    const out = processPlainInputCreate([m], noEnums)[0]?.stringRepresentation ?? "";
    expect(out).not.toContain("id:");
    expect(out).toContain("name:");
  });

  test("keeps the id field when ignoreIdOnInputModel is disabled", () => {
    // The field is named "id", which also matches ignoreForeignOnInputModel
    // (ends with "id"); disable both to isolate the id filter.
    resetConfig({ ignoreIdOnInputModel: false, ignoreForeignOnInputModel: false });
    const m = model("User", [
      field({ name: "id", type: "Int", isId: true }),
      field({ name: "name" }),
    ]);
    const out = processPlainInputCreate([m], noEnums)[0]?.stringRepresentation ?? "";
    expect(out).toContain("id:");
  });

  test("still drops an id field via the foreign-key filter when only ignoreIdOnInputModel is off", () => {
    // ignoreForeignOnInputModel (default true) also matches names ending in "id".
    resetConfig({ ignoreIdOnInputModel: false });
    const m = model("User", [
      field({ name: "id", type: "Int", isId: true }),
      field({ name: "name" }),
    ]);
    const out = processPlainInputCreate([m], noEnums)[0]?.stringRepresentation ?? "";
    expect(out).not.toContain("id:");
  });

  test("excludes additionalFieldsPlain (input models are not the plain model)", () => {
    resetConfig({ additionalFieldsPlain: ["extra: Type.String()"] });
    const m = model("User", [field({ name: "name" })]);
    const out = processPlainInputCreate([m], noEnums)[0]?.stringRepresentation ?? "";
    expect(out).not.toContain("extra:");
  });
});
