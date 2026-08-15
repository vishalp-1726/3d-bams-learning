/**
 * No structure anywhere may be a dead end.
 *
 * The requirement is simple: click any named structure in any model and get
 * something useful. This walks the full mesh index — all 4,453 teachable
 * instances across 36 models — and resolves each one the way the app does.
 *
 * It fails if any structure would produce no explanation at all, and reports the
 * split between specific entries, parent structures and general tissue
 * descriptions so the quality of that coverage stays visible rather than hidden
 * behind a single pass/fail.
 *
 *   npm run check:content
 */

import { readdir, readFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalMeshName,
  sidelessMeshName,
  normalisedMeshName,
} from "../lib/canonical-name.mjs";
import { layerForMesh } from "../lib/tissue-map.mjs";
import { describeLayer } from "../lib/describe.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));

const dir = join(ROOT, "data", "structures");
const files = (await readdir(dir)).filter((f) => extname(f) === ".json");
const structures = [];
for (const f of files.sort()) structures.push(...(await readJson(join(dir, f))));

const byKey = new Map();
for (const s of structures) {
  for (const raw of s.meshNames) {
    for (const key of [
      canonicalMeshName(raw),
      canonicalMeshName(String(raw).trim()),
      canonicalMeshName(sidelessMeshName(raw)),
      canonicalMeshName(normalisedMeshName(raw)),
    ]) {
      if (!byKey.has(key)) byKey.set(key, s);
    }
  }
}

const terms = [];
for (const s of structures) {
  const candidates = new Set([s.en, ...(s.synonyms ?? [])]);
  for (const raw of s.meshNames) candidates.add(normalisedMeshName(raw));
  for (const c of candidates) {
    const term = String(c).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (term.length >= 8) terms.push({ term, s });
  }
}
terms.sort((a, b) => b.term.length - a.term.length);

const resolve = (raw) => {
  for (const key of [
    canonicalMeshName(raw),
    canonicalMeshName(String(raw).trim()),
    canonicalMeshName(sidelessMeshName(raw)),
    canonicalMeshName(normalisedMeshName(raw)),
  ]) {
    const hit = byKey.get(key);
    if (hit) return { tier: "specific", s: hit };
  }
  const hay = normalisedMeshName(raw).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (hay.length >= 8) {
    for (const { term, s } of terms) {
      if (term.length >= hay.length) continue;
      if (hay.includes(term)) return { tier: "parent", s };
    }
  }
  return { tier: "general" };
};

const meshIndex = await readJson(join(ROOT, "data", "mesh-index.json"));

const tally = { specific: 0, parent: 0, general: 0 };
const deadEnds = [];
let checked = 0;

for (const [, groups] of Object.entries(meshIndex)) {
  for (const [group, names] of Object.entries(groups)) {
    for (const name of names) {
      const layer = layerForMesh(name, group);
      if (layer === "other") continue; // decoration, deliberately hidden
      checked++;

      const { tier, s } = resolve(name);
      tally[tier]++;

      // What would the panel actually render?
      const text = s?.plain ?? describeLayer(layer).plain;
      if (!text || text.trim().length < 20) deadEnds.push(`${name} (${layer})`);
    }
  }
}

console.log(`Checked ${checked} teachable structure instances across 36 models.\n`);
console.log(`  specific entry : ${String(tally.specific).padStart(5)}  ${((tally.specific / checked) * 100).toFixed(1)}%`);
console.log(`  via parent     : ${String(tally.parent).padStart(5)}  ${((tally.parent / checked) * 100).toFixed(1)}%`);
console.log(`  general tissue : ${String(tally.general).padStart(5)}  ${((tally.general / checked) * 100).toFixed(1)}%`);

if (deadEnds.length) {
  console.error(`\nFAILED — ${deadEnds.length} structure(s) would show nothing:`);
  for (const d of deadEnds.slice(0, 20)) console.error(`  x ${d}`);
  process.exit(1);
}

console.log(`\nNo dead ends: every structure resolves to an explanation.`);
