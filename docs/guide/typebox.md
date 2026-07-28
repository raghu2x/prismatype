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

The generated `__nullable__` helper file is written into your output directory alongside
the model files. You can rename it with the
[`nullableName`](/guide/configuration#nullablename) option.
