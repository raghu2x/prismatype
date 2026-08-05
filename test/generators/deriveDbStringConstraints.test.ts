import { beforeEach, describe, expect, test } from "bun:test";
import { stringifyPlain } from "../../src/generators/plain";
import type { ProcessedModel } from "../../src/model";
import { field, model } from "../fixtures/dmmf";
import { resetConfig } from "../helpers";

const noEnums: ProcessedModel[] = [];

// stringifyPlain(model, enums, isInputModelCreate, isInputModelUpdate, composites)
const asCreate = (m: Parameters<typeof stringifyPlain>[0]) =>
  stringifyPlain(m, noEnums, true, false);
const asUpdate = (m: Parameters<typeof stringifyPlain>[0]) =>
  stringifyPlain(m, noEnums, false, true);
const asPlain = (m: Parameters<typeof stringifyPlain>[0]) => stringifyPlain(m, noEnums);

const varcharModel = () =>
  model("User", [field({ name: "name", nativeType: ["VarChar", ["255"]] })]);

describe("deriveDbStringConstraints", () => {
  describe("when disabled (default)", () => {
    beforeEach(() => resetConfig());

    test("does not inject maxLength on any model", () => {
      const m = varcharModel();
      expect(asCreate(m)).not.toContain("maxLength");
      expect(asUpdate(m)).not.toContain("maxLength");
      expect(asPlain(m)).not.toContain("maxLength");
    });
  });

  describe("when enabled", () => {
    beforeEach(() => resetConfig({ deriveDbStringConstraints: true }));

    test("injects maxLength into the create input model", () => {
      expect(asCreate(varcharModel())).toContain("maxLength: 255");
    });

    test("injects maxLength into the update input model", () => {
      expect(asUpdate(varcharModel())).toContain("maxLength: 255");
    });

    test("does NOT inject maxLength into the plain/output model", () => {
      expect(asPlain(varcharModel())).not.toContain("maxLength");
    });

    test("Char(n) is treated as maxLength only (no minLength)", () => {
      const m = model("User", [field({ name: "code", nativeType: ["Char", ["8"]] })]);
      const out = asCreate(m);
      expect(out).toContain("maxLength: 8");
      expect(out).not.toContain("minLength");
    });

    test("does not touch fields without a length-bearing native type", () => {
      const m = model("User", [field({ name: "bio", nativeType: ["Text", []] })]);
      expect(asCreate(m)).not.toContain("maxLength");
    });

    test("skips fields with a @prismatype.typeOverwrite", () => {
      const m = model("User", [
        field({
          name: "name",
          nativeType: ["VarChar", ["255"]],
          documentation: "@prismatype.typeOverwrite=Type.String({ format: 'email' })",
        }),
      ]);
      const out = asCreate(m);
      expect(out).toContain("format: 'email'");
      expect(out).not.toContain("maxLength");
    });

    test("an explicit @prismatype.options{maxLength} overrides the derived value", () => {
      const m = model("User", [
        field({
          name: "name",
          nativeType: ["VarChar", ["255"]],
          documentation: "@prismatype.options{maxLength: 10}",
        }),
      ]);
      const out = asCreate(m) ?? "";
      // Both appear in the emitted object literal, but the user's value is last
      // so the later key wins in TypeBox. Assert ordering: derived precedes user.
      const derivedIdx = out.indexOf("maxLength: 255");
      const userIdx = out.indexOf("maxLength: 10");
      expect(derivedIdx).toBeGreaterThanOrEqual(0);
      expect(userIdx).toBeGreaterThanOrEqual(0);
      expect(derivedIdx).toBeLessThan(userIdx);
    });
  });
});
