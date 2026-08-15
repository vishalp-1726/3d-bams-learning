/**
 * Read every GLB in public/models/ and write data/mesh-index.json:
 *
 *   { "hand": { "Bones": ["Capitate", ...], "Muscles": [...] }, ... }
 *
 * This file is the ground truth the content layer is written against, and the
 * baseline that verify-mesh-names.mjs checks against so a model pipeline change
 * can never silently destroy the anatomical names.
 *
 * It also writes the measured structure count back into data/models.json, so the
 * catalogue never shows a hand-typed number that has drifted from reality.
 */

import { readdir, writeFile, readFile, mkdir } from "node:fs/promises";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { readGlbJson, groupMeshNames } from "./glb-nodes.mjs";
import { layerForMesh } from "../lib/tissue-map.mjs";
import { canonicalMeshName } from "../lib/canonical-name.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_DIR = join(ROOT, "public", "models");
const INDEX_OUT = join(ROOT, "data", "mesh-index.json");
const CATALOGUE = join(ROOT, "data", "models.json");
/**
 * Per-region canonical -> original name lookup, served next to the models.
 *
 * three.js rewrites node names on load, so the scene only ever carries the
 * canonical form. Without this the viewer would show "Anterior_cruciate_ligamentr"
 * for every structure that has no written content — which is most of them.
 */
const LABELS_DIR = join(ROOT, "public", "mesh-labels");

async function main() {
  let files;
  try {
    files = (await readdir(MODEL_DIR)).filter((f) => extname(f) === ".glb");
  } catch {
    console.error("public/models/ not found. Run `npm run models:fetch` first.");
    process.exit(1);
  }

  if (files.length === 0) {
    console.error("No .glb files in public/models/. Run `npm run models:fetch` first.");
    process.exit(1);
  }

  await mkdir(LABELS_DIR, { recursive: true });

  const index = {};
  const counts = {};
  let grandTotal = 0;
  let collisions = 0;

  for (const file of files.sort()) {
    const id = basename(file, ".glb");
    const gltf = await readGlbJson(join(MODEL_DIR, file));
    const groups = groupMeshNames(gltf);

    // Sort names within each group for stable diffs.
    index[id] = Object.fromEntries(
      Object.entries(groups)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, names]) => [group, names.slice().sort()])
    );

    // Count only structures a student can actually learn — overlays and fascia
    // are decoration, and inflating the headline number with them would be a lie.
    const teachable = Object.entries(groups).reduce(
      (sum, [group, names]) =>
        sum + names.filter((name) => layerForMesh(name, group) !== "other").length,
      0
    );
    const total = Object.values(groups).reduce((sum, n) => sum + n.length, 0);

    counts[id] = teachable;
    grandTotal += teachable;

    // canonical -> original, for display.
    const labels = {};
    for (const names of Object.values(groups)) {
      for (const name of names) {
        const key = canonicalMeshName(name);
        if (labels[key] && labels[key] !== name) collisions++;
        labels[key] = name;
      }
    }
    await writeFile(join(LABELS_DIR, `${id}.json`), JSON.stringify(labels) + "\n");

    const decoration = total - teachable;
    console.log(
      `${id.padEnd(46)} ${String(teachable).padStart(4)} structures` +
        (decoration ? `  (+${decoration} overlay/fascia)` : "")
    );
  }

  await mkdir(dirname(INDEX_OUT), { recursive: true });
  await writeFile(INDEX_OUT, JSON.stringify(index, null, 2) + "\n");

  // Write measured counts back into the catalogue.
  const catalogue = JSON.parse(await readFile(CATALOGUE, "utf8"));
  let updated = 0;
  for (const model of catalogue) {
    const measured = counts[model.id];
    if (measured !== undefined && model.meshCount !== measured) {
      model.meshCount = measured;
      updated++;
    }
  }
  await writeFile(CATALOGUE, JSON.stringify(catalogue, null, 2) + "\n");

  const missing = catalogue.filter((m) => counts[m.id] === undefined);
  if (missing.length) {
    console.warn(`\n${missing.length} catalogue entries have no downloaded model: ${missing.map((m) => m.id).join(", ")}`);
  }

  console.log(
    `\n${grandTotal} teachable structures across ${files.length} models -> data/mesh-index.json` +
      `\nlabel lookups -> public/mesh-labels/` +
      (updated ? `\n${updated} count(s) updated in data/models.json` : "")
  );
  if (collisions) {
    console.warn(
      `\n${collisions} name(s) collide once canonicalised — two different structures ` +
        `share a canonical key, so one will be unreachable. Inspect public/mesh-labels/.`
    );
  }
}

main();
