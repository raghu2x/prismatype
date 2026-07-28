import { getConfig } from "../config";
import { type extractAnnotations, isOptionsVariant } from "./annotations";

export function generateTypeboxOptions({
  input,
  excludeAdditionalProperties,
}: {
  input?: ReturnType<typeof extractAnnotations>;
  excludeAdditionalProperties?: boolean;
} = {}): string {
  if (excludeAdditionalProperties === undefined) {
    excludeAdditionalProperties = !getConfig().additionalProperties;
  }

  const stringifiedOptions: string[] = [];
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
