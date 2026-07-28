import { beforeEach, describe, expect, test } from "bun:test";
import { processSelect, stringifySelect } from "../../src/generators/select";
import { field, model } from "../fixtures/dmmf";
import { resetConfig } from "../helpers";

describe("stringifySelect", () => {
  beforeEach(() => resetConfig());

  test("emits a partial object of boolean fields plus _count", () => {
    const m = model("User", [field({ name: "id", type: "Int" }), field({ name: "name" })]);
    const out = stringifySelect(m);

    expect(out).toContain("Type.Partial(");
    expect(out).toContain("id: Type.Boolean()");
    expect(out).toContain("name: Type.Boolean()");
    expect(out).toContain("_count: Type.Boolean()");
  });

  test("includes relation fields as selectable booleans", () => {
    const m = model("Post", [field({ name: "author", type: "User", kind: "object" })]);
    expect(stringifySelect(m)).toContain("author: Type.Boolean()");
  });

  test("skips hidden fields", () => {
    const m = model("User", [
      field({ name: "id", type: "Int" }),
      field({ name: "secret", documentation: "@prismatype.hidden" }),
    ]);
    const out = stringifySelect(m);
    expect(out).not.toContain("secret:");
  });

  test("returns undefined for a hidden model", () => {
    const m = model("Secret", [field({ name: "id" })], {
      documentation: "@prismatype.hidden",
    } as never);
    expect(stringifySelect(m)).toBeUndefined();
  });
});

describe("processSelect", () => {
  beforeEach(() => resetConfig());

  test("returns one entry per non-hidden model", () => {
    const models = [model("A", [field({ name: "id" })]), model("B", [field({ name: "id" })])];
    expect(processSelect(models).map((m) => m.name)).toEqual(["A", "B"]);
  });
});
