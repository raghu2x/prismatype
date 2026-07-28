import type { DMMF } from "@prisma/generator-helper";
import { datamodelEnum, field, model } from "./dmmf";

/**
 * A deliberately maximal schema whose only job is to touch every branch the
 * generators can take, so the full-output snapshots pin the emitted code for
 * each of them. Where `pipeline.ts` keeps a small readable fixture for the
 * behaviour tests, this one trades readability for coverage:
 *
 *  - every Prisma scalar (Int, BigInt, Float, Decimal, String, Boolean,
 *    DateTime, Json, Bytes) so `primitiveField.ts` is fully exercised — and,
 *    combined with the `useJsonTypes` config variants, so DateTime's three
 *    branches (Refine / formatted string / __transformDate__ codec) are all
 *    snapshotted;
 *  - a list scalar and a nullable scalar (array + __nullable__ wrappers);
 *  - `@default`/`@updatedAt`/id/foreign-key fields so the input-model
 *    ignore-* filtering is visible;
 *  - the three annotation kinds that change output — `@prismatype.hide`,
 *    `@prismatype.options{...}`, `@prismatype.typeOverwrite=` — plus a plain
 *    `///` description;
 *  - two visible enums and one hidden enum (dropped from the enums file);
 *  - a one-to-many relation, its back-reference, and a self-relation so the
 *    relations / where-recursion output is captured.
 */
export const richEnums: DMMF.DatamodelEnum[] = [
  datamodelEnum("Role", ["USER", "ADMIN"]),
  datamodelEnum("Status", ["ACTIVE", "SUSPENDED", "DELETED"]),
  {
    ...datamodelEnum("Secret", ["A", "B"]),
    documentation: "@prismatype.hidden",
  } as DMMF.DatamodelEnum,
];

export const richModels: DMMF.Model[] = [
  model("Account", [
    field({ name: "id", type: "Int", isId: true, hasDefaultValue: true }),
    field({ name: "big", type: "BigInt" }),
    field({ name: "ratio", type: "Float" }),
    field({ name: "balance", type: "Decimal" }),
    field({ name: "email", type: "String", isUnique: true }),
    field({ name: "active", type: "Boolean", hasDefaultValue: true }),
    field({ name: "payload", type: "Json" }),
    field({ name: "avatar", type: "Bytes" }),
    field({ name: "role", type: "Role", kind: "enum" }),
    field({ name: "status", type: "Status", kind: "enum", isRequired: false }),
    field({ name: "tags", type: "String", isList: true }),
    field({ name: "bio", type: "String", isRequired: false }),
    field({
      name: "nickname",
      type: "String",
      isRequired: false,
      documentation: "The display name.\n@prismatype.options{maxLength:32}",
    }),
    field({
      name: "external",
      type: "String",
      documentation: "@prismatype.typeOverwrite=Type.String({ format: 'uuid' })",
    }),
    field({
      name: "internalToken",
      type: "String",
      documentation: "@prismatype.hide",
    }),
    field({ name: "createdAt", type: "DateTime", hasDefaultValue: true }),
    field({ name: "updatedAt", type: "DateTime", isUpdatedAt: true }),
    field({ name: "profiles", type: "Profile", kind: "object", isList: true }),
  ]),
  model(
    "Profile",
    [
      field({ name: "id", type: "Int", isId: true, hasDefaultValue: true }),
      field({ name: "headline", type: "String" }),
      field({ name: "accountId", type: "Int" }),
      field({ name: "account", type: "Account", kind: "object" }),
      // Self-relation: a profile can have a parent profile.
      field({ name: "parentId", type: "Int", isRequired: false }),
      field({
        name: "parent",
        type: "Profile",
        kind: "object",
        isRequired: false,
      }),
      field({ name: "children", type: "Profile", kind: "object", isList: true }),
    ],
    { uniqueFields: [["accountId"]] },
  ),
];
