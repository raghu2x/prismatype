import { beforeEach, describe, expect, test } from "bun:test";
import { processInclude, stringifyInclude } from "../../src/generators/include";
import { field, model } from "../fixtures/dmmf";
import { resetConfig } from "../helpers";

describe("stringifyInclude", () => {
  beforeEach(() => resetConfig());

  test("includes only relation fields (scalars are omitted) plus _count", () => {
    const m = model("Post", [
      field({ name: "id", type: "Int" }),
      field({ name: "author", type: "User", kind: "object" }),
    ]);
    const out = stringifyInclude(m);

    expect(out).toContain("Type.Partial(");
    expect(out).not.toContain("id:");
    expect(out).toContain("author: Type.Boolean()");
    expect(out).toContain("_count: Type.Boolean()");
  });

  test("skips hidden relation fields", () => {
    const m = model("Post", [
      field({ name: "author", type: "User", kind: "object", documentation: "@prismatype.hidden" }),
    ]);
    const out = stringifyInclude(m);
    expect(out).not.toContain("author:");
  });

  test("returns undefined for a hidden model", () => {
    const m = model("Secret", [field({ name: "rel", type: "Other", kind: "object" })], {
      documentation: "@prismatype.hidden",
    } as never);
    expect(stringifyInclude(m)).toBeUndefined();
  });
});

describe("processInclude", () => {
  beforeEach(() => resetConfig());

  test("returns one entry per non-hidden model", () => {
    const models = [model("A", [field({ name: "id" })])];
    expect(processInclude(models).map((m) => m.name)).toEqual(["A"]);
  });
});
