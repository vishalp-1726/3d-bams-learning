/**
 * Where is the midline in a given model, and do the lateral structures really sit
 * on one side of it?
 *
 * glTF stores min/max on every POSITION accessor, so per-mesh bounding boxes can
 * be read straight from the JSON chunk without decoding any geometry.
 *
 *   node scripts/diagnose-mirror.mjs [model]
 */

import { readGlbJson } from "./glb-nodes.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = process.argv[2] ?? "insertions-and-origins";

const SIDE_RE = /\.\s*[rl]\d*\.?$/i;

const gltf = await readGlbJson(join(ROOT, "public", "models", `${MODEL}.glb`));

const meshBounds = (meshIndex) => {
  const mesh = gltf.meshes[meshIndex];
  let min = Infinity;
  let max = -Infinity;
  for (const prim of mesh.primitives ?? []) {
    const acc = gltf.accessors?.[prim.attributes?.POSITION];
    if (!acc?.min || !acc?.max) continue;
    min = Math.min(min, acc.min[0]);
    max = Math.max(max, acc.max[0]);
  }
  return Number.isFinite(min) ? { min, max } : null;
};

const lateral = [];
const midline = [];

for (const node of gltf.nodes ?? []) {
  if (node.mesh === undefined) continue;
  const b = meshBounds(node.mesh);
  if (!b) continue;
  const name = (node.name ?? "").trim();
  (SIDE_RE.test(name) ? lateral : midline).push({ name, ...b });
};

const span = (list) =>
  list.length
    ? {
        n: list.length,
        min: Math.min(...list.map((o) => o.min)).toFixed(4),
        max: Math.max(...list.map((o) => o.max)).toFixed(4),
      }
    : { n: 0 };

console.log(`model: ${MODEL}`);
console.log(`lateral (side-marked): ${JSON.stringify(span(lateral))}`);
console.log(`midline (unmarked)   : ${JSON.stringify(span(midline))}`);

if (midline.length) {
  const lo = Math.min(...midline.map((o) => o.min));
  const hi = Math.max(...midline.map((o) => o.max));
  console.log(`\nmidline bbox centre x = ${((lo + hi) / 2).toFixed(4)}   (this is the plane the viewer uses)`);

  // Midline structures should straddle the true plane roughly evenly.
  const straddling = midline.filter((o) => o.min < 0 && o.max > 0).length;
  console.log(`midline meshes straddling x=0: ${straddling}/${midline.length}`);
}

if (lateral.length) {
  const negatives = lateral.filter((o) => o.max <= 0).length;
  const positives = lateral.filter((o) => o.min >= 0).length;
  const crossing = lateral.length - negatives - positives;
  console.log(
    `\nlateral entirely x<0: ${negatives}   entirely x>0: ${positives}   crossing x=0: ${crossing}`
  );
  if (crossing) {
    console.log("crossing examples:");
    for (const o of lateral.filter((x) => x.min < 0 && x.max > 0).slice(0, 8)) {
      console.log(`   ${o.name}  x ${o.min.toFixed(3)}..${o.max.toFixed(3)}`);
    }
  }
}
