import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Filesystem fixtures for the `prismatype migrate` codemod tests.
 *
 * The codemod is the one part of PrismaType that writes into a user's
 * repository, so its orchestration is exercised against a real temporary
 * project rather than mocked `fs` calls: a mocked walk would not catch an
 * ignored-directory or path-resolution bug, which is exactly the class of
 * mistake that would corrupt someone's source tree.
 */

/** A disposable project directory on disk. */
export type TempProject = {
  /** Absolute path to the project root. */
  dir: string;
  /** Writes a file, creating parent directories as needed. */
  write(relativePath: string, content: string): Promise<void>;
  /** Reads a file back as UTF-8. */
  read(relativePath: string): Promise<string>;
  /** Initialises a git repo and commits everything currently written. */
  git(commit?: boolean): void;
  /** Removes the directory. */
  cleanup(): Promise<void>;
};

/**
 * Creates a temp directory seeded with `files` (keys are project-relative
 * paths). Callers are responsible for `cleanup()`, normally from `afterEach`.
 */
export async function createTempProject(files: Record<string, string> = {}): Promise<TempProject> {
  const dir = await mkdtemp(join(tmpdir(), "prismatype-migrate-"));

  const project: TempProject = {
    dir,
    async write(relativePath, content) {
      const full = join(dir, relativePath);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, content, "utf8");
    },
    async read(relativePath) {
      return readFile(join(dir, relativePath), "utf8");
    },
    git(commit = true) {
      const run = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
      run("init");
      // Identity must be set locally; CI runners have no global git config.
      run("config", "user.email", "test@example.com");
      run("config", "user.name", "Test");
      run("config", "commit.gpgsign", "false");
      if (commit) {
        run("add", "-A");
        run("commit", "-m", "initial", "--no-verify");
      }
    },
    async cleanup() {
      await rm(dir, { recursive: true, force: true });
    },
  };

  for (const [path, content] of Object.entries(files)) {
    await project.write(path, content);
  }

  return project;
}

/** A minimal prismabox schema, used as the starting point for most fixtures. */
export const PRISMABOX_SCHEMA = `datasource db {
  provider = "postgresql"
}

generator prismabox {
  provider = "prismabox"
  output   = "./generated/schema"
}

enum Role {
  ADMIN
  USER
}

model Post {
  id     String @id
  /// @prismabox.hide
  secret String
  role   Role
}`;
