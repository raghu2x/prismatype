import { describe, expect, test } from "bun:test";
import {
  type Annotation,
  extractAnnotations,
  isHiddenInputCreateVariant,
  isHiddenInputUpdateVariant,
  isHiddenInputVariant,
  isHiddenVariant,
  isOptionsVariant,
  isTypeOverwriteVariant,
} from "../../src/annotations/annotations";

describe("extractAnnotations", () => {
  test("returns empty result for undefined documentation", () => {
    const r = extractAnnotations(undefined);
    expect(r.annotations).toEqual([]);
    expect(r.description).toBeUndefined();
    expect(r.isHidden).toBe(false);
  });

  test("extracts plain description without annotations", () => {
    const r = extractAnnotations("A human readable comment");
    expect(r.description).toBe("A human readable comment");
    expect(r.annotations).toEqual([]);
  });

  test("parses @prismatype.hide", () => {
    const r = extractAnnotations("@prismatype.hidden");
    expect(r.isHidden).toBe(true);
    expect(r.annotations).toContainEqual({ type: "HIDDEN" });
  });

  test("distinguishes input.hide from hide (ordering matters)", () => {
    const r = extractAnnotations("@prismatype.input.hide");
    // Must be HIDDEN_INPUT, not the shorter HIDDEN match.
    expect(r.isHiddenInput).toBe(true);
    expect(r.isHidden).toBe(false);
    expect(r.annotations).toContainEqual({ type: "HIDDEN_INPUT" });
  });

  test("parses create/update input hide variants", () => {
    expect(extractAnnotations("@prismatype.create.input.hide").isHiddenInputCreate).toBe(true);
    expect(extractAnnotations("@prismatype.update.input.hide").isHiddenInputUpdate).toBe(true);
  });

  test("parses options block", () => {
    const r = extractAnnotations("@prismatype.options{ minLength: 3 }");
    expect(r.annotations).toContainEqual({ type: "OPTIONS", value: " minLength: 3 " });
  });

  test("throws on options without opening brace", () => {
    expect(() => extractAnnotations("@prismatype.options minLength: 3")).toThrow();
  });

  test("throws on options without closing brace", () => {
    expect(() => extractAnnotations("@prismatype.options{ minLength: 3")).toThrow();
  });

  test("parses typeOverwrite", () => {
    const r = extractAnnotations("@prismatype.typeOverwrite=Type.String()");
    expect(r.annotations).toContainEqual({ type: "TYPE_OVERWRITE", value: "Type.String()" });
  });

  test("escapes backticks in description", () => {
    const r = extractAnnotations("uses `code` here");
    expect(r.description).toBe("uses \\`code\\` here");
  });

  test("separates annotations from surrounding description lines", () => {
    const r = extractAnnotations("first line\n@prismatype.hidden\nsecond line");
    expect(r.isHidden).toBe(true);
    expect(r.description).toBe("first line\nsecond line");
  });
});

describe("annotation type guards", () => {
  const guards: [Annotation["type"], (a: Annotation) => boolean][] = [
    ["HIDDEN", isHiddenVariant],
    ["HIDDEN_INPUT", isHiddenInputVariant],
    ["HIDDEN_INPUT_CREATE", isHiddenInputCreateVariant],
    ["HIDDEN_INPUT_UPDATE", isHiddenInputUpdateVariant],
    ["OPTIONS", isOptionsVariant],
    ["TYPE_OVERWRITE", isTypeOverwriteVariant],
  ];

  for (const [type, guard] of guards) {
    test(`${guard.name} matches only its own variant`, () => {
      expect(guard({ type } as Annotation)).toBe(true);
      const other: Annotation["type"] = type === "HIDDEN" ? "OPTIONS" : "HIDDEN";
      expect(guard({ type: other } as Annotation)).toBe(false);
    });
  }
});
