import { beforeEach, describe, expect, test } from "bun:test";
import {
  processRelations,
  processRelationsInputCreate,
  processRelationsInputUpdate,
  stringifyRelations,
  stringifyRelationsInputCreate,
  stringifyRelationsInputUpdate,
} from "../../src/generators/relations";
import type { ProcessedModel } from "../../src/model";
import { field, model } from "../fixtures/dmmf";
import { resetConfig } from "../helpers";

const noEnums: ProcessedModel[] = [];
// The relation generator inlines the related model's plain representation.
const plain: ProcessedModel[] = [{ name: "User", stringRepresentation: "Type.Object({})" }];

describe("stringifyRelations", () => {
  beforeEach(() => resetConfig());

  test("inlines the related model's plain schema for a relation field", () => {
    const m = model("Post", [
      field({ name: "id", type: "Int" }),
      field({ name: "author", type: "User", kind: "object" }),
    ]);
    const out = stringifyRelations(m, noEnums, plain);

    // scalar id is skipped (relations only), relation is inlined
    expect(out).not.toContain("id:");
    expect(out).toContain("author: Type.Object({})");
  });

  test("wraps a list relation in Type.Array", () => {
    const m = model("User", [field({ name: "posts", type: "Post", kind: "object", isList: true })]);
    const withPost: ProcessedModel[] = [{ name: "Post", stringRepresentation: "Type.Object({})" }];
    expect(stringifyRelations(m, noEnums, withPost)).toContain("posts: Type.Array(");
  });

  test("makes an optional relation nullable", () => {
    const m = model("Post", [
      field({ name: "author", type: "User", kind: "object", isRequired: false }),
    ]);
    expect(stringifyRelations(m, noEnums, plain)).toContain("author: __nullable__(");
  });

  test("skips a relation whose plain model is absent", () => {
    const m = model("Post", [field({ name: "ghost", type: "Missing", kind: "object" })]);
    const out = stringifyRelations(m, noEnums, plain);
    expect(out).not.toContain("ghost:");
  });

  test("returns undefined for a hidden model", () => {
    const m = model("Secret", [field({ name: "author", type: "User", kind: "object" })], {
      documentation: "@prismatype.hidden",
    } as never);
    expect(stringifyRelations(m, noEnums, plain)).toBeUndefined();
  });
});

describe("processRelations", () => {
  beforeEach(() => resetConfig());

  test("returns one entry per model with relations", () => {
    const models = [model("Post", [field({ name: "author", type: "User", kind: "object" })])];
    expect(processRelations(models, noEnums, plain).map((m) => m.name)).toEqual(["Post"]);
  });
});

describe("stringifyRelationsInputCreate", () => {
  beforeEach(() => resetConfig());

  test("emits a connect shape keyed by the related model's id", () => {
    const user = model("User", [field({ name: "id", type: "Int", isId: true })]);
    const post = model("Post", [field({ name: "author", type: "User", kind: "object" })]);

    const out = stringifyRelationsInputCreate(post, [user, post], noEnums);
    expect(out).toContain("connect:");
    expect(out).toContain("id: Type.Integer(");
  });

  test("supports a String @id", () => {
    const user = model("User", [field({ name: "id", type: "String", isId: true })]);
    const post = model("Post", [field({ name: "author", type: "User", kind: "object" })]);

    const out = stringifyRelationsInputCreate(post, [user, post], noEnums);
    expect(out).toContain("id: Type.String(");
  });

  test("wraps a list relation's connect in Type.Array and marks it Optional", () => {
    const user = model("User", [field({ name: "id", type: "Int", isId: true })]);
    const author = model("Author", [
      field({ name: "posts", type: "User", kind: "object", isList: true }),
    ]);

    const out = stringifyRelationsInputCreate(author, [user, author], noEnums);
    expect(out).toContain("connect: Type.Array(");
    expect(out).toContain("Type.Optional(");
  });

  test("builds a nested compound-key connect from a compound @@unique", () => {
    const membership = model(
      "Membership",
      [field({ name: "userId", type: "Int" }), field({ name: "teamId", type: "Int" })],
      { uniqueFields: [["userId", "teamId"]] },
    );
    const team = model("Team", [field({ name: "members", type: "Membership", kind: "object" })]);

    const out = stringifyRelationsInputCreate(team, [membership, team], noEnums);
    expect(out).toContain("userId_teamId:");
    expect(out).toContain("userId: Type.Integer(");
    expect(out).toContain("teamId: Type.Integer(");
  });

  test("throws when the related id type is unsupported", () => {
    const user = model("User", [field({ name: "id", type: "Boolean", isId: true })]);
    const post = model("Post", [field({ name: "author", type: "User", kind: "object" })]);

    expect(() => stringifyRelationsInputCreate(post, [user, post], noEnums)).toThrow();
  });

  test("throws when a compound-key member has an unsupported type", () => {
    // teamFlag is a Boolean -> prismaTypeToTypeboxType returns "" ->
    // stringifyConnectUnique bails (inner has an undefined) -> create throws.
    const membership = model(
      "Membership",
      [field({ name: "userId", type: "Int" }), field({ name: "teamFlag", type: "Boolean" })],
      { uniqueFields: [["userId", "teamFlag"]] },
    );
    const team = model("Team", [field({ name: "members", type: "Membership", kind: "object" })]);

    expect(() => stringifyRelationsInputCreate(team, [membership, team], noEnums)).toThrow();
  });

  test("throws when the related model has no usable unique identifier", () => {
    // No @id and no compound unique -> stringifyConnectUnique returns undefined.
    const tag = model("Tag", [field({ name: "label", type: "String" })]);
    const post = model("Post", [field({ name: "tag", type: "Tag", kind: "object" })]);

    expect(() => stringifyRelationsInputCreate(post, [tag, post], noEnums)).toThrow();
  });

  test("returns undefined for a hidden model", () => {
    const m = model("Secret", [field({ name: "author", type: "User", kind: "object" })], {
      documentation: "@prismatype.hidden",
    } as never);
    expect(stringifyRelationsInputCreate(m, [m], noEnums)).toBeUndefined();
  });
});

describe("stringifyRelationsInputUpdate", () => {
  beforeEach(() => resetConfig());

  test("emits connect/disconnect for an optional relation", () => {
    const user = model("User", [field({ name: "id", type: "Int", isId: true })]);
    const post = model("Post", [
      field({ name: "author", type: "User", kind: "object", isRequired: false }),
    ]);

    const out = stringifyRelationsInputUpdate(post, [user, post], noEnums);
    expect(out).toContain("connect:");
    expect(out).toContain("disconnect:");
  });

  test("a required relation gets only connect", () => {
    const user = model("User", [field({ name: "id", type: "Int", isId: true })]);
    const post = model("Post", [field({ name: "author", type: "User", kind: "object" })]);

    const out = stringifyRelationsInputUpdate(post, [user, post], noEnums);
    expect(out).toContain("connect:");
    expect(out).not.toContain("disconnect:");
  });

  test("a list relation gets array connect and disconnect", () => {
    const user = model("User", [field({ name: "id", type: "Int", isId: true })]);
    const author = model("Author", [
      field({ name: "posts", type: "User", kind: "object", isList: true }),
    ]);

    const out = stringifyRelationsInputUpdate(author, [user, author], noEnums);
    expect(out).toContain("connect: Type.Array(");
    expect(out).toContain("disconnect: Type.Array(");
  });

  test("throws when the related id type is unsupported", () => {
    const user = model("User", [field({ name: "id", type: "Boolean", isId: true })]);
    const post = model("Post", [field({ name: "author", type: "User", kind: "object" })]);
    expect(() => stringifyRelationsInputUpdate(post, [user, post], noEnums)).toThrow();
  });

  test("returns undefined for a hidden model", () => {
    const m = model("Secret", [field({ name: "author", type: "User", kind: "object" })], {
      documentation: "@prismatype.hidden",
    } as never);
    expect(stringifyRelationsInputUpdate(m, [m], noEnums)).toBeUndefined();
  });
});

describe("process wrappers for relation input models", () => {
  beforeEach(() => resetConfig());

  test("processRelationsInputCreate returns entries", () => {
    const user = model("User", [field({ name: "id", type: "Int", isId: true })]);
    const post = model("Post", [field({ name: "author", type: "User", kind: "object" })]);
    expect(processRelationsInputCreate([user, post], noEnums).map((m) => m.name)).toContain("Post");
  });

  test("processRelationsInputUpdate returns entries", () => {
    const user = model("User", [field({ name: "id", type: "Int", isId: true })]);
    const post = model("Post", [field({ name: "author", type: "User", kind: "object" })]);
    expect(processRelationsInputUpdate([user, post], noEnums).map((m) => m.name)).toContain("Post");
  });
});
