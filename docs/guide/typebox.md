# TypeBox & Nullability

## TypeBox version

prismatype targets the **TypeBox >= 1.0** API from the unscoped
[`typebox`](https://www.npmjs.com/package/typebox) package. The generated code uses:

- `Type.Evaluate(Type.Intersect([...]))` for composites,
- `Type.Codec` for transforms, and
- `Type.Refine`-based schemas for `Date` / `Bytes`.

The legacy 0.x `@sinclair/typebox` API is no longer supported.

## `__nullable__` vs `Type.Optional`

prismatype wraps nullable fields in a custom `__nullable__` helper, which allows `null` in
addition to `undefined`. This is distinct from `Type.Optional`, which only allows
`undefined`.

From the relevant
[issue comment](https://github.com/raghu2x/prismatype/issues/33#issuecomment-2708755442):

> prisma in some scenarios allows null OR undefined as types where optional only allows
> for undefined / is reflected as undefined in TS types

The generated `__nullable__` helper file is written into your output directory alongside
the model files. You can rename it with the
[`nullableName`](/guide/configuration#nullablename) option.
