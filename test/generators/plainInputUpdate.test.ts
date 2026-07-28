import { beforeEach, describe, expect, test } from "bun:test";
import { processPlainInputUpdate } from "../../src/generators/plainInputUpdate";
import type { ProcessedModel } from "../../src/model";
import { field, model } from "../fixtures/dmmf";
import { resetConfig } from "../helpers";

const noEnums: ProcessedModel[] = [];

describe("processPlainInputUpdate", () => {
  beforeEach(() => resetConfig());

  test("returns one ProcessedModel per non-hidden model", () => {
    const models = [model("A", [field({ name: "name" })]), model("B", [field({ name: "name" })])];
    const out = processPlainInputUpdate(models, noEnums);
    expect(out.map((m) => m.name)).toEqual(["A", "B"]);
    expect(out[0]?.stringRepresentation).toContain("Type.Object({");
  });

  test("is pure: a second call yields an equal, fresh array", () => {
    const models = [model("A", [field({ name: "name" })])];
    const first = processPlainInputUpdate(models, noEnums);
    const second = processPlainInputUpdate(models, noEnums);
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
    const out = processPlainInputUpdate(models, noEnums);
    expect(out.map((m) => m.name)).toEqual(["Visible"]);
  });

  test("makes an otherwise-required field optional (update patches partially)", () => {
    const m = model("User", [field({ name: "email", isRequired: true, hasDefaultValue: false })]);
    const out = processPlainInputUpdate([m], noEnums)[0]?.stringRepresentation ?? "";
    expect(out).toContain("email: Type.Optional(");
  });

  test("makes an optional field optional and nullable", () => {
    const m = model("User", [field({ name: "bio", isRequired: false })]);
    const out = processPlainInputUpdate([m], noEnums)[0]?.stringRepresentation ?? "";
    expect(out).toContain("bio: Type.Optional(__nullable__(");
  });

  test("respects the @prismatype.update.input.hide field annotation", () => {
    const m = model("User", [
      field({ name: "name" }),
      field({ name: "internal", documentation: "@prismatype.update.input.hide" }),
    ]);
    const out = processPlainInputUpdate([m], noEnums)[0]?.stringRepresentation ?? "";
    expect(out).toContain("name:");
    expect(out).not.toContain("internal:");
  });

  test("respects the shared @prismatype.input.hide field annotation", () => {
    const m = model("User", [
      field({ name: "name" }),
      field({ name: "internal", documentation: "@prismatype.input.hide" }),
    ]);
    const out = processPlainInputUpdate([m], noEnums)[0]?.stringRepresentation ?? "";
    expect(out).toContain("name:");
    expect(out).not.toContain("internal:");
  });

  test("omits updatedAt by default (ignoreUpdatedAtOnInputModel)", () => {
    const m = model("User", [
      field({ name: "updatedAt", type: "DateTime", isUpdatedAt: true }),
      field({ name: "name" }),
    ]);
    const out = processPlainInputUpdate([m], noEnums)[0]?.stringRepresentation ?? "";
    expect(out).not.toContain("updatedAt:");
    expect(out).toContain("name:");
  });

  test("excludes additionalFieldsPlain (input models are not the plain model)", () => {
    resetConfig({ additionalFieldsPlain: ["extra: Type.String()"] });
    const m = model("User", [field({ name: "name" })]);
    const out = processPlainInputUpdate([m], noEnums)[0]?.stringRepresentation ?? "";
    expect(out).not.toContain("extra:");
  });
});
