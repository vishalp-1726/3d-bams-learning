/**
 * Minimal GLB scene-graph reader — no dependencies.
 *
 * We only ever need the JSON chunk of a .glb: the node tree, mesh names and the
 * group each mesh sits under. Open3DModel files already organise meshes under
 * top-level groups ("Bones", "Muscles", "Ligaments", "Nerves", "Arteries",
 * "Veins", "Cartilages", "Bursae", "Fascia", "Overlays"), which is where our
 * layer assignment comes from — we never hand-tag structures.
 */

import { readFile } from "node:fs/promises";

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"

/** Read and parse the JSON chunk of a GLB file. */
export async function readGlbJson(path) {
  const buf = await readFile(path);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  if (dv.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error(`${path} is not a GLB file (bad magic number)`);
  }

  // Walk the chunk table rather than assuming JSON is first at offset 20.
  let offset = 12;
  while (offset < dv.byteLength) {
    const chunkLength = dv.getUint32(offset, true);
    const chunkType = dv.getUint32(offset + 4, true);
    if (chunkType === CHUNK_JSON) {
      const bytes = new Uint8Array(buf.buffer, buf.byteOffset + offset + 8, chunkLength);
      return JSON.parse(new TextDecoder().decode(bytes));
    }
    offset += 8 + chunkLength;
    if (chunkLength % 4 !== 0) offset += 4 - (chunkLength % 4); // padding
  }
  throw new Error(`${path} contains no JSON chunk`);
}

/**
 * Map every mesh-bearing node to the top-level group it descends from.
 * Returns { groupName: [meshName, ...] } preserving file order.
 */
export function groupMeshNames(gltf) {
  const nodes = gltf.nodes ?? [];

  const parentOf = new Map();
  nodes.forEach((node, i) => {
    for (const child of node.children ?? []) parentOf.set(child, i);
  });

  /** Walk to the outermost ancestor — that is the layer group. */
  const topGroupOf = (index) => {
    let current = parentOf.get(index);
    let name = "Ungrouped";
    let guard = 0;
    while (current !== undefined && guard++ < 64) {
      name = nodes[current].name ?? name;
      current = parentOf.get(current);
    }
    return name;
  };

  const groups = {};
  nodes.forEach((node, i) => {
    if (node.mesh === undefined) return;
    const group = topGroupOf(i);
    (groups[group] ??= []).push(node.name ?? `unnamed_${i}`);
  });
  return groups;
}

/** Flat, sorted list of every mesh name — the integrity fingerprint. */
export function allMeshNames(gltf) {
  return (gltf.nodes ?? [])
    .filter((n) => n.mesh !== undefined)
    .map((n, i) => n.name ?? `unnamed_${i}`)
    .sort();
}
