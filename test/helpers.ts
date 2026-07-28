import { setConfig } from "../src/config";

/**
 * Resets the global config singleton to defaults, optionally with overrides.
 * Call this in `beforeEach` so each test runs against a known config.
 *
 * `setConfig` runs the same Clean/Default/Convert/Decode pipeline as a real
 * generate run, so passing only `output` yields every documented default.
 */
export function resetConfig(overrides: Record<string, unknown> = {}) {
  setConfig({ output: "./prisma/prismatype", ...overrides });
}
