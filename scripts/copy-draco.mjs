/**
 * Copy the Draco decoder from three's bundled copy into public/draco/.
 *
 * The Open3DModel GLBs are Draco-compressed, so the decoder is required to load
 * them at all. We self-host it rather than pulling from a third-party CDN — the
 * reference viewer fetches its decoder from preview.babylonjs.com, which is an
 * uptime and privacy dependency we don't control, and it would also break the
 * site offline.
 *
 * Run automatically after `npm install` via the `prepare` script.
 */

import { cp, mkdir, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "node_modules", "three", "examples", "jsm", "libs", "draco", "gltf");
const DEST = join(ROOT, "public", "draco");

async function main() {
  try {
    await readdir(SRC);
  } catch {
    console.warn(`Draco decoder not found at ${SRC} — skipping. Run npm install first.`);
    return;
  }

  await mkdir(DEST, { recursive: true });
  await cp(SRC, DEST, { recursive: true });

  const files = await readdir(DEST);
  console.log(`Draco decoder -> public/draco/ (${files.join(", ")})`);
}

main();
