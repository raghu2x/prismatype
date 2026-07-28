import { beforeEach, describe, expect, test } from "bun:test";
import { wrapWithArray } from "../../src/generators/wrappers/array";
import { makeComposite } from "../../src/generators/wrappers/composite";
import { makeEnum } from "../../src/generators/wrappers/enum";
import { makeIntersection } from "../../src/generators/wrappers/intersect";
import { nullableType, wrapWithNullable } from "../../src/generators/wrappers/nullable";
import { wrapWithOptional } from "../../src/generators/wrappers/optional";
import { wrapWithPartial } from "../../src/generators/wrappers/partial";
import { makeUnion } from "../../src/generators/wrappers/union";
import { resetConfig } from "../helpers";

describe("wrappers", () => {
  beforeEach(() => resetConfig());

  test("wrapWithArray wraps in Type.Array with additionalProperties option", () => {
    expect(wrapWithArray("Type.String()")).toBe(
      "Type.Array(Type.String(), {additionalProperties: false})",
    );
  });

  test("wrapWithNullable calls the nullable helper", () => {
    expect(wrapWithNullable("Type.String()")).toBe("__nullable__(Type.String())");
  });

  test("wrapWithOptional wraps in Type.Optional", () => {
    expect(wrapWithOptional("Type.String()")).toBe("Type.Optional(Type.String())");
  });

  test("wrapWithPartial wraps in Type.Partial, omitting additionalProperties by default", () => {
    expect(wrapWithPartial("Type.Object({})")).toBe("Type.Partial(Type.Object({}), )");
  });

  test("wrapWithPartial with true emits the additionalProperties option", () => {
    expect(wrapWithPartial("Type.Object({})", true)).toBe(
      "Type.Partial(Type.Object({}), {additionalProperties: false})",
    );
  });

  test("makeComposite emits Evaluate(Intersect([...])) with the type prefix", () => {
    const out = makeComposite(["UserPlain", "UserRelations"]);
    expect(out).toContain("Type.Evaluate(Type.Intersect([UserPlain,UserRelations])");
  });

  test("makeEnum quotes the variants", () => {
    expect(makeEnum(["asc", "desc"])).toBe("Type.Enum(['asc','desc'], )\n");
  });

  test("makeUnion joins members", () => {
    expect(makeUnion(["A", "B"])).toContain("Type.Union([A,B]");
  });

  test("makeIntersection joins members", () => {
    expect(makeIntersection(["A", "B"])).toContain("Type.Intersect([A,B]");
  });

  test("respects a renamed typebox import variable", () => {
    resetConfig({ typeboxImportVariableName: "T" });
    expect(wrapWithOptional("T.String()")).toBe("T.Optional(T.String())");
  });

  test("nullableType emits the helper with configured names", () => {
    const out = nullableType();
    expect(out).toContain('import { Type, type TSchema } from "typebox"');
    expect(out).toContain("export const __nullable__");
    expect(out).toContain("Type.Union([Type.Null(), schema])");
  });
});
