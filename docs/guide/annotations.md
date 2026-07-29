# Annotations

PrismaType reads directives from Prisma's triple-slash doc comments (`///`) to adjust the
output of individual models and fields.

| Annotation                      | Example                                     | Description                                                                                             |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `@prismatype.hide`              | (none)                                      | Hides the field or model from the output.                                                               |
| `@prismatype.hidden`            | (none)                                      | Alias for `@prismatype.hide`.                                                                           |
| `@prismatype.input.hide`        | (none)                                      | Hides the field or model from the output only in the input model.                                       |
| `@prismatype.create.input.hide` | (none)                                      | Hides the field or model only in the input **create** model.                                            |
| `@prismatype.update.input.hide` | (none)                                      | Hides the field or model only in the input **update** model.                                            |
| `@prismatype.options`           | `@prismatype.options{ min: 10, max: 20 }`   | Applies the provided options to the field or model in the generated schema. Must be valid JS/TS syntax. |
| `@prismatype.typeOverwrite`     | `@prismatype.typeOverwrite=Type.CustomName` | Overwrites the type PrismaType outputs for a field with a custom string.                                |

Each `hide` directive also has a `hidden` alias (e.g. `@prismatype.input.hidden`).

::: warning One annotation per line
You **cannot** use multiple annotations on one line; each must be on its own `///` line.
:::

## Example

```prisma
/// The post model
model Post {
  id        Int      @id @default(autoincrement())
  /// @prismatype.hidden
  createdAt DateTime @default(now())
  title     String   @unique

  User   User? @relation(fields: [userId], references: [id])
  /// @prismatype.options{max: 10}
  /// this is the user id
  userId Int?
}

/// @prismatype.hidden
enum Account {
  PASSKEY
  PASSWORD
}
```

In this example:

- `createdAt` is removed from every generated schema for `Post`.
- `userId` gets a `max: 10` option, and the trailing comment becomes the field's
  `description`.
- The `Account` enum is hidden entirely.

## Descriptions

Any line in a `///` comment that isn't a recognized annotation becomes the schema's
`description` option. This is why the comment above `userId` shows up as its description.

## Type overwrites

`@prismatype.typeOverwrite=...` replaces the type PrismaType would emit for a field with a
literal string. This is useful when you want a custom TypeBox type for a specific field.
