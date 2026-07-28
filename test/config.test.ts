import { describe, expect, test } from "bun:test";
import { getConfig, setConfig } from "../src/config";

describe("config", () => {
  test("applies documented defaults", () => {
    setConfig({ output: "./out" });
    const c = getConfig();

    expect(c.output).toBe("./out");
    expect(c.typeboxImportVariableName).toBe("Type");
    expect(c.typeboxImportDependencyName).toBe("typebox");
    expect(c.additionalProperties).toBe(false);
    expect(c.inputModel).toBe(false);
    expect(c.nullableName).toBe("__nullable__");
    expect(c.transformDateName).toBe("__transformDate__");
    expect(c.enumsFileName).toBe("enums");
  });

  test("coerces string booleans from the generator block", () => {
    // Prisma passes every generator option through as a string.
    setConfig({ output: "./out", inputModel: "true", additionalProperties: "false" });
    const c = getConfig();

    expect(c.inputModel).toBe(true);
    expect(c.additionalProperties).toBe(false);
  });

  test('coerces the "transformer" literal for useJsonTypes', () => {
    setConfig({ output: "./out", useJsonTypes: "transformer" });
    expect(getConfig().useJsonTypes).toBe("transformer");
  });

  test("coerces string boolean for useJsonTypes union", () => {
    setConfig({ output: "./out", useJsonTypes: "true" });
    expect(getConfig().useJsonTypes).toBe(true);
  });

  test("strips unknown keys via Value.Clean", () => {
    // additionalProperties: false on the schema means Value.Clean removes
    // unrecognized keys rather than throwing.
    setConfig({ output: "./out", bogusOption: "x" });
    expect("bogusOption" in getConfig()).toBe(false);
  });

  test("freezes the config singleton", () => {
    setConfig({ output: "./out" });
    expect(Object.isFrozen(getConfig())).toBe(true);
  });

  test("logs and rethrows when the input cannot be decoded", () => {
    const original = console.error;
    console.error = () => {};
    try {
      // useJsonTypes is a Boolean | "transformer" union; an arbitrary string
      // cannot be converted/decoded to it, so setConfig throws.
      expect(() => setConfig({ output: "./out", useJsonTypes: "definitely-not-valid" })).toThrow();
    } finally {
      console.error = original;
    }
  });
});
