import { beforeEach, describe, expect, test } from "bun:test";
import {
  enumNameToExportedName,
  getUsedEnumImports,
  processEnums,
  stringifyEnum,
} from "../../src/generators/enum";
import type { ProcessedModel } from "../../src/model";
import { datamodelEnum } from "../fixtures/dmmf";
import { resetConfig } from "../helpers";

describe("stringifyEnum", () => {
  beforeEach(() => resetConfig());

  test("emits a Type.Enum of the quoted values", () => {
    const out = stringifyEnum(datamodelEnum("Role", ["USER", "ADMIN"]));
    expect(out).toBe("Type.Enum(['USER','ADMIN'], )\n");
  });

  test("returns undefined for a hidden enum", () => {
    const e = datamodelEnum("Role", ["USER"]);
    (e as { documentation?: string }).documentation = "@prismatype.hidden";
    expect(stringifyEnum(e)).toBeUndefined();
  });
});

describe("enumNameToExportedName", () => {
  beforeEach(() => resetConfig());

  test("returns the bare name by default", () => {
    expect(enumNameToExportedName("Role")).toBe("Role");
  });

  test("applies the exported type prefix", () => {
    resetConfig({ exportedTypePrefix: "Db" });
    expect(enumNameToExportedName("Role")).toBe("DbRole");
  });
});

describe("getUsedEnumImports", () => {
  beforeEach(() => resetConfig());

  const enums: ProcessedModel[] = [
    { name: "Role", stringRepresentation: "" },
    { name: "Status", stringRepresentation: "" },
  ];

  test("returns only enums referenced in the content", () => {
    expect(getUsedEnumImports("something Role something", enums)).toEqual(["Role"]);
  });

  test("uses word boundaries (does not match a substring)", () => {
    // "Roles" should not match the "Role" enum name.
    expect(getUsedEnumImports("Roles", enums)).toEqual([]);
  });

  test("returns empty when nothing is referenced", () => {
    expect(getUsedEnumImports("no enums here", enums)).toEqual([]);
  });
});

describe("processEnums", () => {
  beforeEach(() => resetConfig());

  test("returns one entry per non-hidden enum", () => {
    const out = processEnums([datamodelEnum("Role", ["A"]), datamodelEnum("Status", ["B"])]);
    expect(out.map((e) => e.name)).toEqual(["Role", "Status"]);
  });
});
