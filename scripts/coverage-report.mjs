/**
 * The real content gap, across every model.
 *
 * 4,453 is the count of mesh instances, not of distinct structures — the same
 * femur appears in a dozen models. What matters for writing content is the number
 * of DISTINCT structures once names are normalised, and which of those still have
 * no explanation.
 *
 * Output is a worklist ordered by impact: a structure appearing in ten models is
 * worth writing before one that appears in a single model.
 *
 *   npm run coverage            summary + top gaps
 *   npm run coverage -- --all   every uncovered structure
 *   npm run coverage -- --model zone-elbow
 */

import { readdir, readFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalMeshName, sidelessMeshName, normalisedMeshName } from "../lib/canonical-name.mjs";
import { layerForMesh } from "../lib/tissue-map.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));

const argv = process.argv.slice(2);
const SHOW_ALL = argv.includes("--all");
const ONLY_MODEL = argv.includes("--model") ? argv[argv.indexOf("--model") + 1] : null;

// ---- content ---------------------------------------------------------------
const dir = join(ROOT, "data", "structures");
const files = (await readdir(dir)).filter((f) => extname(f) === ".json");
const structures = [];
for (const f of files.sort()) structures.push(...(await readJson(join(dir, f))));

// Same key set the app uses, so this report matches what a student actually sees.
const covered = new Set();
for (const s of structures) {
  for (const raw of s.meshNames) {
    covered.add(canonicalMeshName(raw));
    covered.add(canonicalMeshName(raw.trim()));
    covered.add(canonicalMeshName(sidelessMeshName(raw)));
    covered.add(canonicalMeshName(normalisedMeshName(raw)));
  }
}
const resolvesExactly = (raw) =>
  covered.has(canonicalMeshName(raw)) ||
  covered.has(canonicalMeshName(raw.trim())) ||
  covered.has(canonicalMeshName(sidelessMeshName(raw))) ||
  covered.has(canonicalMeshName(normalisedMeshName(raw)));

/*
 * Parent resolution, mirroring lib/structures.ts.
 *
 * "Sternocostal head of pectoralis major muscle.r" is a named PART of a structure
 * that is written up. Longest term first, so the most specific parent wins.
 */
const searchTerms = [];
for (const s of structures) {
  const candidates = new Set([s.en, ...(s.synonyms ?? [])]);
  for (const raw of s.meshNames) candidates.add(normalisedMeshName(raw));
  for (const candidate of candidates) {
    const term = String(candidate).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (term.length < 8) continue;
    searchTerms.push({ term, id: s.id });
  }
}
searchTerms.sort((a, b) => b.term.length - a.term.length);

const parentOf = (raw) => {
  const hay = normalisedMeshName(raw).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (hay.length < 8) return null;
  for (const { term, id } of searchTerms) {
    if (term.length >= hay.length) continue;
    if (hay.includes(term)) return id;
  }
  return null;
};

const resolves = (raw) => resolvesExactly(raw) || Boolean(parentOf(raw));

// ---- models ----------------------------------------------------------------
const meshIndex = await readJson(join(ROOT, "data", "mesh-index.json"));

/** normalised name -> { models:Set, layer, example, instances } */
const distinct = new Map();
let instances = 0;

for (const [model, groups] of Object.entries(meshIndex)) {
  if (ONLY_MODEL && model !== ONLY_MODEL) continue;
  for (const [group, names] of Object.entries(groups)) {
    for (const name of names) {
      const layer = layerForMesh(name, group);
      if (layer === "other") continue; // decoration, not a structure to learn
      instances++;
      const key = normalisedMeshName(name).toLowerCase();
      const entry = distinct.get(key) ?? {
        models: new Set(),
        layer,
        example: name,
        instances: 0,
      };
      entry.models.add(model);
      entry.instances++;
      distinct.set(key, entry);
    }
  }
}

const rows = [...distinct.entries()].map(([key, v]) => {
  const exact = resolvesExactly(v.example);
  const parent = exact ? null : parentOf(v.example);
  return {
    key,
    ...v,
    modelCount: v.models.size,
    tier: exact ? "specific" : parent ? "parent" : "general",
    covered: exact || Boolean(parent),
  };
});

const done = rows.filter((r) => r.covered);
const todo = rows.filter((r) => !r.covered);
const weight = (list) => list.reduce((n, r) => n + r.instances, 0);

const specific = rows.filter((r) => r.tier === "specific");
const viaParent = rows.filter((r) => r.tier === "parent");

console.log(`Teachable mesh instances : ${instances}`);
console.log(`Distinct structures      : ${rows.length}\n`);
console.log(`By tier (distinct / clicks):`);
console.log(
  `  specific entry  ${String(specific.length).padStart(5)}  ` +
    `${((specific.length / rows.length) * 100).toFixed(1)}%   ` +
    `${String(weight(specific)).padStart(5)} clicks  ${((weight(specific) / instances) * 100).toFixed(1)}%`
);
console.log(
  `  via parent      ${String(viaParent.length).padStart(5)}  ` +
    `${((viaParent.length / rows.length) * 100).toFixed(1)}%   ` +
    `${String(weight(viaParent)).padStart(5)} clicks  ${((weight(viaParent) / instances) * 100).toFixed(1)}%`
);
console.log(
  `  general only    ${String(todo.length).padStart(5)}  ` +
    `${((todo.length / rows.length) * 100).toFixed(1)}%   ` +
    `${String(weight(todo)).padStart(5)} clicks  ${((weight(todo) / instances) * 100).toFixed(1)}%`
);
console.log(
  `\nEvery structure shows something; ${((weight(done) / instances) * 100).toFixed(1)}% of clicks ` +
    `get anatomy specific to that structure or its parent.`
);

const byLayer = {};
for (const r of todo) byLayer[r.layer] = (byLayer[r.layer] ?? 0) + 1;
console.log(`\nMissing by layer:`);
for (const [layer, n] of Object.entries(byLayer).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${layer.padEnd(12)} ${n}`);
}

todo.sort((a, b) => b.instances - a.instances || a.example.localeCompare(b.example));
const show = SHOW_ALL ? todo : todo.slice(0, 40);
console.log(`\nUncovered structures${SHOW_ALL ? "" : " (top 40 by impact)"}:`);
for (const r of show) {
  console.log(
    `  ${String(r.instances).padStart(3)}x  ${r.layer.padEnd(10)} ${r.example}` +
      (r.modelCount > 1 ? `   [${r.modelCount} models]` : "")
  );
}
if (!SHOW_ALL && todo.length > show.length) {
  console.log(`  ...and ${todo.length - show.length} more — run with --all`);
}
