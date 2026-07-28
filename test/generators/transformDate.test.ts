import { beforeEach, describe, expect, test } from "bun:test";
import {
  transformDateImportStatement,
  transformDateType,
} from "../../src/generators/transformDate";
import { resetConfig } from "../helpers";

describe("transformDateType", () => {
  beforeEach(() => resetConfig());

  test("imports the typebox variable from the configured dependency", () => {
    expect(transformDateType()).toContain('import { Type } from "typebox";');
  });

  test("exports the codec under the configured transformDateName", () => {
    expect(transformDateType()).toContain("export const __transformDate__ =");
  });

  test("builds a String codec with the date-time format and spreads options", () => {
    const out = transformDateType();
    expect(out).toContain("Type.Codec(Type.String({ format: 'date-time', ...options }))");
  });

  test("decodes to a Date and encodes back to an ISO string", () => {
    const out = transformDateType();
    expect(out).toContain(".Decode((value) => new Date(value))");
    expect(out).toContain(".Encode((value) => value.toISOString())");
  });

  test("honours a custom typeboxImportVariableName", () => {
    resetConfig({ typeboxImportVariableName: "T" });
    const out = transformDateType();
    expect(out).toContain('import { T } from "typebox";');
    expect(out).toContain("T.Codec(T.String({ format: 'date-time', ...options }))");
    expect(out).not.toContain("Type.");
  });

  test("honours a custom typeboxImportDependencyName", () => {
    resetConfig({ typeboxImportDependencyName: "@sinclair/typebox" });
    expect(transformDateType()).toContain('import { Type } from "@sinclair/typebox";');
  });

  test("honours a custom transformDateName", () => {
    resetConfig({ transformDateName: "__toDate__" });
    expect(transformDateType()).toContain("export const __toDate__ =");
  });
});

describe("transformDateImportStatement", () => {
  beforeEach(() => resetConfig());

  test("imports the codec from a sibling file named after transformDateName", () => {
    expect(transformDateImportStatement()).toBe(
      'import { __transformDate__ } from "./__transformDate__"\n',
    );
  });

  test("appends the configured importFileExtension", () => {
    resetConfig({ importFileExtension: ".js" });
    expect(transformDateImportStatement()).toBe(
      'import { __transformDate__ } from "./__transformDate__.js"\n',
    );
  });

  test("honours a custom transformDateName for both the symbol and the path", () => {
    resetConfig({ transformDateName: "__toDate__" });
    expect(transformDateImportStatement()).toBe('import { __toDate__ } from "./__toDate__"\n');
  });
});
