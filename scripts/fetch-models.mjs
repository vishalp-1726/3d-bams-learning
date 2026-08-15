/**
 * Download every model listed in data/models.json into public/models/.
 *
 * These files are CC BY-SA 4.0 by the Open3DModel consortium (Leiden UMC,
 * UMC Utrecht, Maastricht UMC, KU Leuven). See models/LICENSE.md — that file is
 * the licence compliance record, and data/model-sources.json records the exact
 * source page for each asset.
 *
 * The assets are deliberately NOT committed to git (see .gitignore); run
 * `npm run models:fetch` after cloning. Use --force to re-download.
 */

import { mkdir, writeFile, stat, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "models");
const ASSET_BASE = "https://caskanatomy.info/open3dviewer/3dmodels";

/** Be a good citizen: this is a university server, not a CDN we pay for. */
const CONCURRENCY = 4;

const mb = (bytes) => (bytes / 1048576).toFixed(2);

async function sizeOf(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return null;
  }
}

async function fetchModel(model, force) {
  const dest = join(OUT_DIR, model.file);
  const existing = await sizeOf(dest);

  if (!force && existing !== null) {
    return { id: model.id, skipped: true, bytes: existing };
  }

  const url = `${ASSET_BASE}/${model.id}/${model.id}.glb`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);

  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return { id: model.id, bytes: buf.byteLength };
}

async function main() {
  const force = process.argv.includes("--force");
  const models = JSON.parse(await readFile(join(ROOT, "data", "models.json"), "utf8"));
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Fetching ${models.length} Open3DModel assets into public/models/`);
  console.log("Licence: CC BY-SA 4.0 — see models/LICENSE.md\n");

  const failures = [];
  let downloaded = 0;
  let totalBytes = 0;

  for (let i = 0; i < models.length; i += CONCURRENCY) {
    const batch = models.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (model) => {
        try {
          return await fetchModel(model, force);
        } catch (err) {
          failures.push(`${model.id}: ${err.message}`);
          return { id: model.id, failed: true, message: err.message };
        }
      })
    );

    for (const r of results) {
      if (r.failed) {
        console.error(`  !  ${r.id.padEnd(46)} FAILED — ${r.message}`);
      } else if (r.skipped) {
        totalBytes += r.bytes;
        console.log(`  =  ${r.id.padEnd(46)} ${mb(r.bytes).padStart(6)} MB (already present)`);
      } else {
        downloaded++;
        totalBytes += r.bytes;
        console.log(`  +  ${r.id.padEnd(46)} ${mb(r.bytes).padStart(6)} MB`);
      }
    }
  }

  console.log(
    `\n${downloaded} downloaded, ${models.length - downloaded - failures.length} already present, ` +
      `${mb(totalBytes)} MB total on disk.`
  );

  if (failures.length) {
    console.error(`\n${failures.length} download(s) failed.`);
    process.exit(1);
  }
  console.log("Next: npm run models:names");
}

main();
