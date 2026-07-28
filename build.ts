import { exists, rm } from "node:fs/promises";

if (await exists("./dist")) {
  await rm("./dist", { force: true, recursive: true });
}

const output = await Bun.build({
  entrypoints: ["./src/cli.ts"],
  outdir: "./dist",
  target: "node",
  format: "cjs",
  sourcemap: "external",
  minify: true,
  external: ["oxfmt", "typebox"],
});

if (!output.success) {
  console.error(output.logs);
} else {
  console.info("Built successfully!");
}
