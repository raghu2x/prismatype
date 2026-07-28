import { beforeEach, describe, expect, test } from "bun:test";
import { processOrderBy, stringifyOrderBy } from "../../src/generators/orderBy";
import { field, model } from "../fixtures/dmmf";
import { resetConfig } from "../helpers";

describe("stringifyOrderBy", () => {
  beforeEach(() => resetConfig());

  test("emits an asc/desc enum per scalar field", () => {
    const m = model("User", [field({ name: "id", type: "Int" }), field({ name: "name" })]);
    const out = stringifyOrderBy(m);

    expect(out).toContain("Type.Partial(");
    expect(out).toContain("id: Type.Enum(['asc','desc']");
    expect(out).toContain("name: Type.Enum(['asc','desc']");
  });

  test("omits relation fields (only scalars are orderable)", () => {
    const m = model("Post", [
      field({ name: "id", type: "Int" }),
      field({ name: "author", type: "User", kind: "object" }),
    ]);
    const out = stringifyOrderBy(m);
    expect(out).toContain("id:");
    expect(out).not.toContain("author:");
  });

  test("skips hidden fields", () => {
    const m = model("User", [
      field({ name: "id", type: "Int" }),
      field({ name: "secret", documentation: "@prismatype.hidden" }),
    ]);
    expect(stringifyOrderBy(m)).not.toContain("secret:");
  });

  test("returns undefined for a hidden model", () => {
    const m = model("Secret", [field({ name: "id" })], {
      documentation: "@prismatype.hidden",
    } as never);
    expect(stringifyOrderBy(m)).toBeUndefined();
  });
});

describe("processOrderBy", () => {
  beforeEach(() => resetConfig());

  test("returns one entry per non-hidden model", () => {
    const models = [model("A", [field({ name: "id" })])];
    expect(processOrderBy(models).map((m) => m.name)).toEqual(["A"]);
  });
});
