import { getConfig } from "../config";
import { type extractAnnotations, isOptionsVariant } from "./annotations";

export function generateTypeboxOptions({
  input,
  excludeAdditionalProperties,
  derivedOptions,
}: {
  input?: ReturnType<typeof extractAnnotations>;
  excludeAdditionalProperties?: boolean;
  /**
   * Options derived by prismatype itself (e.g. a `maxLength` from a native
   * column type). Emitted *before* the user's `@prismatype.options` so that an
   * explicit annotation with the same key wins: in a TypeBox object literal the
   * later key overrides the earlier one.
   */
  derivedOptions?: string[];
} = {}): string {
  if (excludeAdditionalProperties === undefined) {
    excludeAdditionalProperties = !getConfig().additionalProperties;
  }

  const stringifiedOptions: string[] = [];
  for (const derived of derivedOptions ?? []) {
    stringifiedOptions.push(derived);
  }
  for (const annotation of input?.annotations ?? []) {
    if (isOptionsVariant(annotation)) {
      stringifiedOptions.push(annotation.value);
    }
  }

  if (excludeAdditionalProperties) {
    stringifiedOptions.push(`additionalProperties: ${getConfig().additionalProperties}`);
  }

  if (input?.description) {
    stringifiedOptions.push(`description: \`${input.description}\``);
  }

  return stringifiedOptions.length > 0 ? `{${stringifiedOptions.join(",")}}` : "";
}
