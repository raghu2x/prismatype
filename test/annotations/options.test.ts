import { beforeEach, describe, expect, test } from "bun:test";
import { extractAnnotations } from "../../src/annotations/annotations";
import { generateTypeboxOptions } from "../../src/annotations/options";
import { resetConfig } from "../helpers";

describe("generateTypeboxOptions", () => {
  beforeEach(() => resetConfig());

  test("returns empty string when there is nothing to emit", () => {
    // additionalProperties defaults to false, so exclusion is on by default;
    // pass excludeAdditionalProperties: false to suppress that too.
    expect(generateTypeboxOptions({ excludeAdditionalProperties: false })).toBe("");
  });

  test("emits additionalProperties by default (config additionalProperties=false)", () => {
    expect(generateTypeboxOptions()).toBe("{additionalProperties: false}");
  });

  test("does not emit additionalProperties when explicitly excluded", () => {
    expect(generateTypeboxOptions({ excludeAdditionalProperties: false })).toBe("");
  });

  test("passes through user options from annotations", () => {
    const input = extractAnnotations("@prismatype.options{ minLength: 3 }");
    const out = generateTypeboxOptions({ input, excludeAdditionalProperties: false });
    expect(out).toBe("{ minLength: 3 }");
  });

  test("emits description", () => {
    const input = extractAnnotations("a comment");
    const out = generateTypeboxOptions({ input, excludeAdditionalProperties: false });
    expect(out).toBe("{description: `a comment`}");
  });

  test("combines user options, additionalProperties and description", () => {
    resetConfig({ additionalProperties: false });
    const input = extractAnnotations("@prismatype.options{ minLength: 3 }\na comment");
    const out = generateTypeboxOptions({ input });
    expect(out).toBe("{ minLength: 3 ,additionalProperties: false,description: `a comment`}");
  });

  test("respects additionalProperties: true config", () => {
    resetConfig({ additionalProperties: true });
    // When additionalProperties is true, exclusion defaults to false -> nothing emitted.
    expect(generateTypeboxOptions()).toBe("");
  });
});
