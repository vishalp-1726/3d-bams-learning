import hand from "@/data/structures/hand.json";
import knee from "@/data/structures/knee.json";
import brachialPlexus from "@/data/structures/brachial-plexus.json";
import skeleton from "@/data/structures/skeleton.json";
import head from "@/data/structures/head.json";
import shoulder from "@/data/structures/shoulder.json";
import lowerLimb from "@/data/structures/lower-limb.json";
import muscles from "@/data/structures/muscles.json";
import upperLimb from "@/data/structures/upper-limb.json";
import pelvis from "@/data/structures/pelvis.json";
// Formulaic families — phalanges, articular cartilages, interossei and the like.
// Produced by `npm run generate`; see scripts/generate-structures.mjs.
import generated from "@/data/structures/generated.json";
import type { Structure } from "./types";
import {
  canonicalMeshName,
  sidelessMeshName,
  normalisedMeshName,
} from "./canonical-name.mjs";
export { describeLayer } from "./describe.mjs";

/**
 * Teaching content, one file per region.
 *
 * Add a region by dropping a JSON file in data/structures/ and adding it here.
 * `npm run models:verify` reads that directory directly, so a file that is not
 * imported here still gets its mesh names checked — the failure mode is a region
 * that silently never loads, and the verifier will not catch that, so keep this
 * list in step with the directory.
 */
export const STRUCTURES = [
  ...hand,
  ...knee,
  ...brachialPlexus,
  ...skeleton,
  ...head,
  ...shoulder,
  ...lowerLimb,
  ...muscles,
  ...upperLimb,
  ...pelvis,
  // Last, so a hand-written entry always wins the first-writer-takes-the-key
  // rule in the lookup index below.
  ...generated,
] as Structure[];

/**
 * meshName -> Structure. Built once at module load.
 *
 * Keyed by the CANONICAL name, because three.js rewrites node names when it
 * loads a GLB ("Anterior cruciate ligament.r" arrives as
 * "Anterior_cruciate_ligamentr"). Content is authored verbatim so it stays
 * checkable against the file; the canonical form is what the scene actually
 * carries. See lib/canonical-name.mjs.
 *
 * A structure may claim several meshes (a muscle split into heads, a nerve and
 * its named branches), so this is many-to-one.
 */
/**
 * Lookup keys for one authored mesh name.
 *
 * The same bone is named differently across models depending on whether the file
 * is hemi-body: the hand model says "Scaphoid", the whole-skeleton model says
 * "Scaphoid.r". Indexing the side-stripped form as well means teaching content is
 * written once and resolves in every model that contains the structure.
 *
 * Both forms are canonicalised, because three.js mangles names on load.
 */
function lookupKeys(rawName: string): string[] {
  // Most specific first: an exact match must always beat a normalised alias.
  const keys = [canonicalMeshName(rawName)];
  const push = (value: string) => {
    const key = canonicalMeshName(value);
    if (value && !keys.includes(key)) keys.push(key);
  };
  push(rawName.trim());
  push(sidelessMeshName(rawName));
  push(normalisedMeshName(rawName));
  return keys;
}

const BY_MESH = new Map<string, Structure>();
for (const structure of STRUCTURES) {
  for (const meshName of structure.meshNames) {
    for (const key of lookupKeys(meshName)) {
      // First writer wins: a specific entry must not be replaced by a
      // side-stripped alias from some other structure.
      if (!BY_MESH.has(key)) BY_MESH.set(key, structure);
    }
  }
}

const BY_ID = new Map(STRUCTURES.map((s) => [s.id, s]));

/**
 * Searchable index of every structure by the words in its name.
 *
 * Used to resolve a named PART to its parent: the upper limb model contains
 * "Sternocostal head of pectoralis major muscle.r", which is not the same string
 * as "Pectoralis major.r" and so matched nothing — even though pectoralis major
 * is written up, and is exactly what the reader wants when they click that head.
 *
 * Sorted longest-name-first so the most specific parent wins: a mesh mentioning
 * "flexor digitorum profundus" must not resolve to "flexor digitorum
 * superficialis" merely because both contain "flexor digitorum".
 */
const SEARCH_TERMS: Array<{ term: string; structure: Structure }> = [];
for (const structure of STRUCTURES) {
  const candidates = new Set<string>([structure.en, ...(structure.synonyms ?? [])]);
  for (const raw of structure.meshNames) candidates.add(normalisedMeshName(raw));

  for (const candidate of candidates) {
    const term = candidate
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    // Short terms match too loosely to be trusted as a parent.
    if (term.length < 8) continue;
    SEARCH_TERMS.push({ term, structure });
  }
}
SEARCH_TERMS.sort((a, b) => b.term.length - a.term.length);

/** The written-up structure this mesh is a named part of, if any. */
function parentStructureFor(rawName: string): Structure | undefined {
  const haystack = normalisedMeshName(rawName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (haystack.length < 8) return undefined;

  for (const { term, structure } of SEARCH_TERMS) {
    if (term.length >= haystack.length) continue; // identical, not a part
    if (haystack.includes(term)) return structure;
  }
  return undefined;
}

export interface Resolution {
  structure?: Structure;
  /** How confident the match is — drives what the panel tells the reader. */
  tier: "specific" | "parent" | "general";
}

/**
 * Resolve a mesh to its teaching content.
 *
 * `labels` is the viewer's canonical -> original lookup. It is needed because the
 * side marker (".r") is destroyed by three's name mangling, so the original name
 * is the only way to recognise "Scaphoid.r" as the scaphoid.
 */
export function resolveMesh(
  meshName: string | null,
  labels: Record<string, string> = {}
): Resolution {
  if (!meshName) return { tier: "general" };
  const raw = labels[meshName] ?? meshName;

  for (const key of lookupKeys(raw)) {
    const hit = BY_MESH.get(key);
    if (hit) return { structure: hit, tier: "specific" };
  }

  const parent = parentStructureFor(raw);
  if (parent) return { structure: parent, tier: "parent" };

  return { tier: "general" };
}

/** Convenience wrapper for callers that only want the entry. */
export function structureForMesh(
  meshName: string | null,
  labels: Record<string, string> = {}
): Structure | undefined {
  return resolveMesh(meshName, labels).structure;
}

export function structureById(id: string): Structure | undefined {
  return BY_ID.get(id);
}

/**
 * Number of structures with a written explanation, per region.
 *
 * Shown on the catalogue so coverage is visible rather than implied: every model
 * is fully clickable and correctly named, but only some have teaching text yet.
 */
export const EXPLAINED_BY_REGION: Record<string, number> = {};
for (const structure of STRUCTURES) {
  if (structure.plain) {
    EXPLAINED_BY_REGION[structure.region] = (EXPLAINED_BY_REGION[structure.region] ?? 0) + 1;
  }
}

/** How much of a region has teaching content written — drives the progress badge. */
export function coverageFor(region: string, meshNames: string[]) {
  const withContent = meshNames.filter((name) => {
    const s = BY_MESH.get(canonicalMeshName(name));
    return s?.region === region && Boolean(s.plain);
  }).length;
  return { withContent, total: meshNames.length };
}

/**
 * Search across every name a student might type: English, Latin (TA2),
 * synonyms, and the raw mesh name itself.
 */
export function searchStructures(query: string, limit = 20): Structure[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const scored: Array<{ structure: Structure; score: number }> = [];
  for (const s of STRUCTURES) {
    const haystacks = [s.en, s.ta2 ?? "", ...(s.synonyms ?? []), ...s.meshNames];
    let best = Infinity;
    for (const h of haystacks) {
      const index = h.toLowerCase().indexOf(q);
      if (index !== -1) best = Math.min(best, index);
    }
    if (best !== Infinity) scored.push({ structure: s, score: best });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.structure.en.localeCompare(b.structure.en))
    .slice(0, limit)
    .map((x) => x.structure);
}
