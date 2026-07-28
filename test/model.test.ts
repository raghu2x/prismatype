import { beforeEach, describe, expect, test } from "bun:test";
import { type Collections, mapAllModelsForWrite } from "../src/model";
import { resetConfig } from "./helpers";

function emptyCollections(overrides: Partial<Collections> = {}): Collections {
  return {
    enums: [],
    plain: [],
    relations: [],
    plainInputCreate: [],
    plainInputUpdate: [],
    relationsInputCreate: [],
    relationsInputUpdate: [],
    where: [],
    whereUnique: [],
    select: [],
    include: [],
    orderBy: [],
    ...overrides,
  };
}

describe("mapAllModelsForWrite", () => {
  beforeEach(() => resetConfig());

  test("emits suffixed exports and a composite Model from Plain + Relations", () => {
    const collections = emptyCollections({
      plain: [{ name: "User", stringRepresentation: "Type.Object({})" }],
      relations: [{ name: "User", stringRepresentation: "Type.Object({})" }],
    });

    const file = mapAllModelsForWrite(collections).get("User");
    expect(file).toBeDefined();
    expect(file).toContain("export const UserPlain =");
    expect(file).toContain("export const UserRelations =");
    // composite Model = Evaluate(Intersect([UserPlain, UserRelations]))
    expect(file).toContain("export const User =");
    expect(file).toContain("Type.Evaluate(Type.Intersect([UserPlain,UserRelations])");
  });

  test("uses Plain alone as the composite when there are no relations", () => {
    const collections = emptyCollections({
      plain: [{ name: "User", stringRepresentation: "Type.Object({})" }],
    });

    const file = mapAllModelsForWrite(collections).get("User");
    expect(file).toContain("export const User = UserPlain");
  });

  test("prepends the typebox, nullable and transformDate imports per model file", () => {
    const collections = emptyCollections({
      plain: [{ name: "User", stringRepresentation: "Type.Object({})" }],
    });

    const file = mapAllModelsForWrite(collections).get("User")!;
    expect(file).toContain('import { Type } from "typebox"');
    expect(file).toContain("import { __nullable__ }");
    expect(file).toContain("import { __transformDate__ }");
  });

  test("adds an enum import only when the model references an enum", () => {
    const collections = emptyCollections({
      enums: [{ name: "Role", stringRepresentation: "Type.Enum(['A'])" }],
      plain: [{ name: "User", stringRepresentation: "Type.Object({ role: Role })" }],
    });

    const map = mapAllModelsForWrite(collections);
    expect(map.get("User")).toContain('import { Role } from "./enums"');
  });

  test("emits an enums file when enums are present", () => {
    const collections = emptyCollections({
      enums: [{ name: "Role", stringRepresentation: "Type.Enum(['A'])" }],
    });

    const map = mapAllModelsForWrite(collections);
    expect(map.has("enums")).toBe(true);
    expect(map.get("enums")).toContain("export const Role =");
  });

  test("always emits the nullable and transformDate helper files", () => {
    const map = mapAllModelsForWrite(emptyCollections());
    expect(map.has("__nullable__")).toBe(true);
    expect(map.has("__transformDate__")).toBe(true);
  });

  test("synthesizes InputCreate and InputUpdate composites", () => {
    const collections = emptyCollections({
      plainInputCreate: [{ name: "User", stringRepresentation: "Type.Object({})" }],
      relationsInputCreate: [{ name: "User", stringRepresentation: "Type.Object({})" }],
      plainInputUpdate: [{ name: "User", stringRepresentation: "Type.Object({})" }],
      relationsInputUpdate: [{ name: "User", stringRepresentation: "Type.Object({})" }],
    });

    const file = mapAllModelsForWrite(collections).get("User")!;
    expect(file).toContain("export const UserInputCreate =");
    expect(file).toContain("export const UserInputUpdate =");
  });
});
