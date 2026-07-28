import { beforeEach, describe, expect, test } from "bun:test";
import {
  processWhere,
  processWhereUnique,
  stringifyWhere,
  stringifyWhereUnique,
} from "../../src/generators/where";
import type { ProcessedModel } from "../../src/model";
import { field, model } from "../fixtures/dmmf";
import { resetConfig } from "../helpers";

const noEnums: ProcessedModel[] = [];

describe("stringifyWhere", () => {
  beforeEach(() => resetConfig());

  test("emits a partial recursive object with scalar fields and AND/OR/NOT", () => {
    const m = model("User", [field({ name: "id", type: "Int" }), field({ name: "name" })]);
    const out = stringifyWhere(m, noEnums);

    expect(out).toContain("Type.Partial(");
    expect(out).toContain("Type.Recursive(");
    expect(out).toContain("AND:");
    expect(out).toContain("OR:");
    expect(out).toContain("NOT:");
    expect(out).toContain("id: Type.Integer(");
    expect(out).toContain('{ $id: "User"}');
  });

  test("omits relation fields", () => {
    const m = model("Post", [
      field({ name: "id", type: "Int" }),
      field({ name: "author", type: "User", kind: "object" }),
    ]);
    const out = stringifyWhere(m, noEnums);
    expect(out).toContain("id:");
    expect(out).not.toContain("author:");
  });

  test("without recursion emits a plain partial object", () => {
    resetConfig({ allowRecursion: false });
    const m = model("User", [field({ name: "id", type: "Int" })]);
    const out = stringifyWhere(m, noEnums);
    expect(out).not.toContain("Type.Recursive(");
    expect(out).toContain("id: Type.Integer(");
  });

  test("wraps a list scalar field in Type.Array", () => {
    const m = model("User", [field({ name: "tags", type: "String", isList: true })]);
    expect(stringifyWhere(m, noEnums)).toContain("tags: Type.Array(");
  });

  test("resolves an enum field via its exported name", () => {
    const enums: ProcessedModel[] = [{ name: "Role", stringRepresentation: "" }];
    const m = model("User", [field({ name: "role", type: "Role" })]);
    expect(stringifyWhere(m, enums)).toContain("role: Role");
  });

  test("returns undefined for a hidden model", () => {
    const m = model("Secret", [field({ name: "id" })], {
      documentation: "@prismatype.hidden",
    } as never);
    expect(stringifyWhere(m, noEnums)).toBeUndefined();
  });
});

describe("processWhere / processWhereUnique", () => {
  beforeEach(() => resetConfig());

  test("processWhere returns one entry per non-hidden model", () => {
    const models = [model("A", [field({ name: "id", type: "Int" })])];
    expect(processWhere(models, noEnums).map((m) => m.name)).toEqual(["A"]);
  });

  test("processWhereUnique returns one entry per non-hidden model", () => {
    const models = [model("A", [field({ name: "id", type: "Int", isId: true })])];
    expect(processWhereUnique(models, noEnums).map((m) => m.name)).toEqual(["A"]);
  });
});

describe("stringifyWhereUnique", () => {
  beforeEach(() => resetConfig());

  test("includes unique and id fields in the unique base object", () => {
    const m = model("User", [
      field({ name: "id", type: "Int", isId: true }),
      field({ name: "email", isUnique: true }),
      field({ name: "name" }),
    ]);
    const out = stringifyWhereUnique(m, noEnums);

    expect(out).toContain("Type.Intersect(");
    expect(out).toContain("id:");
    expect(out).toContain("email:");
    // non-unique scalar still appears in the allFields partial branch
    expect(out).toContain("name:");
  });

  test("emits a nested composite key from a compound unique constraint", () => {
    const m = model(
      "Membership",
      [field({ name: "userId", type: "Int" }), field({ name: "teamId", type: "Int" })],
      { uniqueFields: [["userId", "teamId"]] },
    );
    const out = stringifyWhereUnique(m, noEnums);
    expect(out).toContain("userId_teamId:");
  });

  test("wraps a list field in Type.Array in the allFields branch", () => {
    const m = model("User", [
      field({ name: "id", type: "Int", isId: true }),
      field({ name: "tags", type: "String", isList: true }),
    ]);
    expect(stringifyWhereUnique(m, noEnums)).toContain("tags: Type.Array(");
  });

  test("without recursion emits a plain intersection", () => {
    resetConfig({ allowRecursion: false });
    const m = model("User", [field({ name: "id", type: "Int", isId: true })]);
    const out = stringifyWhereUnique(m, noEnums);
    expect(out).not.toContain("Type.Recursive(");
    expect(out).toContain("Type.Intersect(");
  });

  test("throws when a compound-unique field is a relation type", () => {
    const m = model(
      "Membership",
      [
        field({ name: "userId", type: "Int" }),
        field({ name: "team", type: "Team", kind: "object" }),
      ],
      { uniqueFields: [["userId", "team"]] },
    );
    expect(() => stringifyWhereUnique(m, noEnums)).toThrow("Invalid type for unique composite");
  });

  test("returns undefined for a hidden model", () => {
    const m = model("Secret", [field({ name: "id", isId: true })], {
      documentation: "@prismatype.hidden",
    } as never);
    expect(stringifyWhereUnique(m, noEnums)).toBeUndefined();
  });
});
