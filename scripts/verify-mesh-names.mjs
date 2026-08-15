/**
 * ASSET INTEGRITY GUARD — run this in CI and after any model pipeline change.
 *
 * The entire value of these models is that each mesh carries its correct
 * anatomical name. Optimisation steps that merge geometry (`gltf-transform join`,
 * `prune`, `dedup --meshes`, or gltfpack's node collapsing) silently delete those
 * names and leave a file that still renders perfectly — so the damage is invisible
 * until someone clicks a structure and gets nothing.
 *
 * This script re-reads the GLBs and fails if any name recorded in
 * data/mesh-index.json has disappeared, or if any structure in the content layer
 * points at a mesh that no longer exists.
 *
 * Exit code 1 = the build must not ship.
 */

import { readFile, readdir } from "node:fs/promises";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { readGlbJson, groupMeshNames } from "./glb-nodes.mjs";
import { layerForMesh } from "../lib/tissue-map.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_DIR = join(ROOT, "public", "models");

const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));

async function main() {
  const baseline = await readJson(join(ROOT, "data", "mesh-index.json")).catch(() => {
    console.error("data/mesh-index.json missing. Run `npm run models:names` to create the baseline.");
    process.exit(1);
  });

  const files = (await readdir(MODEL_DIR)).filter((f) => extname(f) === ".glb");
  const problems = [];

  // 1. Every baseline name must still exist in the actual GLB.
  const liveNames = {};
  for (const file of files) {
    const id = basename(file, ".glb");
    const groups = groupMeshNames(await readGlbJson(join(MODEL_DIR, file)));
    const live = new Set(Object.values(groups).flat());
    liveNames[id] = live;

    const expected = Object.values(baseline[id] ?? {}).flat();
    if (expected.length === 0) {
      problems.push(`${id}: no baseline recorded — run models:names`);
      continue;
    }

    const missing = expected.filter((name) => !live.has(name));
    if (missing.length) {
      problems.push(
        `${id}: ${missing.length}/${expected.length} mesh names LOST — ` +
          `the model pipeline destroyed the scene graph. First few: ${missing.slice(0, 5).join(", ")}`
      );
    } else {
      console.log(`  ok  ${id.padEnd(12)} ${expected.length} names intact`);
    }
  }

  // 2. Every group must map to a real tissue layer.
  //
  //    This catches a whole class of silent breakage: the source files use two
  //    different group-naming conventions ("Bones" vs "Hand and wrist - bones"),
  //    and a mapping that only understands one of them dumps hundreds of
  //    structures into "other", where they are hidden by default. The model looks
  //    fine; half the anatomy is just invisible.
  const warnings = [];
  for (const file of files) {
    const id = basename(file, ".glb");
    const groups = groupMeshNames(await readGlbJson(join(MODEL_DIR, file)));

    for (const [group, names] of Object.entries(groups)) {
      const decorative = /fascia|overlay/i.test(group);
      if (decorative) continue;

      // Hard failure: a whole group classified as decoration, so every one of its
      // structures is hidden by default and effectively unreachable.
      const hidden = names.filter((name) => layerForMesh(name, group) === "other");
      if (hidden.length === names.length) {
        problems.push(
          `${id}: group "${group}" (${names.length} structures) resolves entirely to ` +
            `"Fascia & overlays" and would be hidden by default. ` +
            `Add a keyword to lib/tissue-map.mjs.`
        );
        continue;
      }

      // Soft signal: still visible, just not labelled with a tissue.
      const unclassified = names.filter((name) => layerForMesh(name, group) === "unclassified");
      if (unclassified.length > 0) {
        warnings.push(
          `${id}: "${group}" — ${unclassified.length}/${names.length} unclassified ` +
            `(e.g. ${unclassified.slice(0, 2).join(", ")})`
        );
      }
    }
  }

  // 3. Every structure in the content layer must resolve to real geometry.
  //    A typo here means a structure that can never be clicked.
  // Content lives one file per region in data/structures/.
  let structures = [];
  try {
    const dir = join(ROOT, "data", "structures");
    const contentFiles = (await readdir(dir)).filter((f) => extname(f) === ".json");
    for (const file of contentFiles.sort()) {
      const entries = await readJson(join(dir, file));
      if (!Array.isArray(entries)) {
        problems.push(`data/structures/${file} is not a JSON array`);
        continue;
      }
      structures.push(...entries);
    }
    console.log(`\n  ${structures.length} structures across ${contentFiles.length} content file(s)`);
  } catch {
    console.log("  --  data/structures/ not present yet, skipping content check");
  }

  // A duplicate id would make one entry unreachable via structureById.
  const seenIds = new Map();
  for (const s of structures) {
    if (seenIds.has(s.id)) problems.push(`duplicate structure id "${s.id}"`);
    seenIds.set(s.id, true);
  }

  // A mesh name must exist in at least one model. It need not be in the declared
  // region: the same bone appears in many models, and content resolves globally
  // by name (side-insensitively), so one entry serves all of them. Not being in
  // the declared region is a smell worth reporting, but not a failure.
  const everywhere = new Set(Object.values(liveNames).flatMap((s) => [...s]));

  for (const s of structures) {
    if (!liveNames[s.region]) {
      problems.push(`structure "${s.id}": region "${s.region}" has no model file`);
    }
    for (const name of s.meshNames) {
      if (!everywhere.has(name)) {
        problems.push(`structure "${s.id}": mesh name "${name}" is in no model at all`);
      } else if (liveNames[s.region] && !liveNames[s.region].has(name)) {
        warnings.push(`structure "${s.id}": "${name}" is not in ${s.region}.glb (found in another model)`);
      }
    }
  }

  if (warnings.length) {
    console.log(`\n${warnings.length} group(s) with unclassified meshes (still visible, grouped as "Other structures"):`);
    for (const w of warnings.slice(0, 12)) console.log(`  ~ ${w}`);
    if (warnings.length > 12) console.log(`  ~ ...and ${warnings.length - 12} more`);
  }

  if (problems.length) {
    console.error(`\nFAILED — ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  x ${p}`);
    process.exit(1);
  }

  console.log(`\nAll mesh names intact across ${files.length} models; ${structures.length} structures resolve.`);
}

main();
