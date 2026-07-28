import { beforeEach, describe, expect, test } from "bun:test";
import { processPlain, stringifyPlain } from "../../src/generators/plain";
import type { ProcessedModel } from "../../src/model";
import { field, model } from "../fixtures/dmmf";
import { resetConfig } from "../helpers";

const noEnums: ProcessedModel[] = [];

describe("stringifyPlain", () => {
  beforeEach(() => resetConfig());

  test("emits a Type.Object with scalar fields", () => {
    const m = model("User", [field({ name: "id", type: "Int" }), field({ name: "name" })]);
    const out = stringifyPlain(m, noEnums);
    expect(out).toContain("Type.Object({");
    expect(out).toContain("id: Type.Integer(");
    expect(out).toContain("name: Type.String(");
  });

  test("wraps list fields in Type.Array", () => {
    const m = model("User", [field({ name: "tags", isList: true })]);
    expect(stringifyPlain(m, noEnums)).toContain("tags: Type.Array(");
  });

  test("wraps optional fields in the nullable helper", () => {
    const m = model("User", [field({ name: "bio", isRequired: false })]);
    expect(stringifyPlain(m, noEnums)).toContain("bio: __nullable__(");
  });

  test("skips hidden fields", () => {
    const m = model("User", [
      field({ name: "id", type: "Int" }),
      field({ name: "secret", documentation: "@prismatype.hidden" }),
    ]);
    const out = stringifyPlain(m, noEnums);
    expect(out).toContain("id:");
    expect(out).not.toContain("secret:");
  });

  test("returns undefined for a hidden model", () => {
    const m = model("Secret", [field({ name: "id" })], {
      documentation: "@prismatype.hidden",
    } as never);
    expect(stringifyPlain(m, noEnums)).toBeUndefined();
  });

  describe("input model filters", () => {
    test("omits the id field on create input", () => {
      const m = model("User", [
        field({ name: "id", type: "Int", isId: true }),
        field({ name: "name" }),
      ]);
      const out = stringifyPlain(m, noEnums, true, false);
      expect(out).not.toContain("id:");
      expect(out).toContain("name:");
    });

    test("omits updatedAt on create input", () => {
      const m = model("User", [field({ name: "updatedAt", type: "DateTime", isUpdatedAt: true })]);
      const out = stringifyPlain(m, noEnums, true, false);
      expect(out).not.toContain("updatedAt:");
    });

    test("omits foreign key fields on input", () => {
      const m = model("Post", [field({ name: "authorId", type: "Int" }), field({ name: "title" })]);
      const out = stringifyPlain(m, noEnums, true, false);
      expect(out).not.toContain("authorId:");
      expect(out).toContain("title:");
    });

    test("makes all fields optional on update input", () => {
      const m = model("User", [field({ name: "name" })]);
      const out = stringifyPlain(m, noEnums, false, true);
      expect(out).toContain("name: Type.Optional(");
    });

    test("makes a required field with a default value optional on create input", () => {
      const m = model("User", [
        field({ name: "status", type: "String", isRequired: true, hasDefaultValue: true }),
      ]);
      const out = stringifyPlain(m, noEnums, true, false);
      expect(out).toContain("status: Type.Optional(");
    });
  });

  test("skips relation fields (fieldType returns undefined)", () => {
    const m = model("Post", [
      field({ name: "id", type: "Int" }),
      field({ name: "author", type: "User", kind: "object" }),
    ]);
    const out = stringifyPlain(m, noEnums);
    expect(out).toContain("id:");
    expect(out).not.toContain("author:");
  });
});

describe("processPlain", () => {
  beforeEach(() => resetConfig());

  test("returns one ProcessedModel per non-hidden model and is re-runnable", () => {
    const models = [model("A", [field({ name: "id" })]), model("B", [field({ name: "id" })])];

    const first = processPlain(models, noEnums);
    const second = processPlain(models, noEnums);

    expect(first.map((m) => m.name)).toEqual(["A", "B"]);
    // Post-refactor generators are pure: a second call yields an equal, fresh array.
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });
});
