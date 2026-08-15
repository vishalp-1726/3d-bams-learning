/**
 * Guarantee ./out exists on a CI build machine.
 *
 * WHY THIS EXISTS
 *
 * ./out is generated, not committed, so something must build it before
 * `wrangler` uploads it. Three separate deploys failed because nothing did:
 *
 *   1. OpenNext built the project, but deployed a server Worker instead of the
 *      static site, and died on a worker-name mismatch.
 *   2. Removing OpenNext removed the only build step.
 *   3. `build.command` in wrangler.jsonc runs locally but is suppressed by
 *      Cloudflare Workers Builds.
 *
 * And the deploy command itself cannot be relied on either: Cloudflare runs a
 * DIFFERENT command for non-production branches — `wrangler versions upload`
 * rather than the configured deploy command — so setting one field fixes only
 * half the cases.
 *
 * `npm clean-install` runs the `prepare` script and is the one step that happens
 * on every Cloudflare build, whatever the branch. Building from there makes the
 * deploy work regardless of which command follows and without depending on any
 * dashboard setting.
 *
 * Local installs are untouched: this is a no-op unless CI is detected.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");

/** Cloudflare, GitHub Actions and most CI providers set CI=true. */
const onCI =
  process.env.CI === "true" ||
  process.env.CI === "1" ||
  Boolean(process.env.CF_PAGES) ||
  Boolean(process.env.WORKERS_CI) ||
  // Cloudflare's build machines check out to this path.
  ROOT.startsWith("/opt/buildhome");

if (!onCI) {
  // Local `npm install` should not trigger a full production build.
  process.exit(0);
}

if (existsSync(OUT)) {
  console.log("ensure-build: ./out already present, nothing to do.");
  process.exit(0);
}

console.log("ensure-build: CI detected and ./out is missing — building now.");

/*
 * Invoke Next's CLI directly with the current Node binary.
 *
 * Spawning through a shell (needed to resolve `npx` on Windows) triggers
 * DEP0190, because shell arguments are concatenated rather than escaped. Calling
 * the bin script avoids the shell, the warning and the escaping question
 * entirely, and works the same on every platform.
 */
const nextBin = join(ROOT, "node_modules", "next", "dist", "bin", "next");
const result = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: ROOT,
  stdio: "inherit",
});

if (result.status !== 0) {
  console.error("ensure-build: `next build` failed.");
  process.exit(result.status ?? 1);
}

if (!existsSync(OUT)) {
  console.error(
    "ensure-build: the build finished but ./out was not created. " +
      'Check that next.config.mjs still sets output: "export".'
  );
  process.exit(1);
}

console.log("ensure-build: ./out is ready.");
