/**
 * Content accuracy audit.
 *
 * verify-mesh-names.mjs proves that every mesh name RESOLVES. This script asks
 * the harder question: is the content attached to the RIGHT structure, and is
 * anything missing, duplicated or contradictory?
 *
 * Checks:
 *   1. Required fields present.
 *   2. Duplicate structure ids.
 *   3. A mesh claimed by more than one structure.
 *   4. Side-alias collisions — "Femur.r" stripping to "Femur" and colliding with
 *      a different structure's entry.
 *   5. Declared layer vs the layer implied by the model's own grouping. The two
 *      are derived completely independently, so a disagreement means the entry is
 *      filed against the wrong tissue — the strongest signal available that
 *      content has been mixed up.
 *   6. Name plausibility: the English name should share vocabulary with the mesh
 *      name it claims. A near-zero overlap is how interchanged content shows up.
 *   7. Coverage: which entries lack explanation, clinical note, TA2 term.
 *
 *   npm run audit
 */

import { readdir, readFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { layerForMesh } from "../lib/tissue-map.mjs";
import { canonicalMeshName, sidelessMeshName } from "../lib/canonical-name.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));

/** Words too generic to prove a name matches its mesh. */
const STOPWORDS = new Set([
  "of", "the", "and", "in", "on", "to", "at", "a", "an", "left", "right",
  "bone", "bones", "muscle", "muscles", "nerve", "nerves", "artery", "arteries",
  "vein", "veins", "ligament", "ligaments", "joint", "joints", "cartilage",
  "br", "nn", "n", "r", "l", "common", "part", "parts", "st", "nd", "rd", "th",
]);

const tokens = (text) =>
  new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );

async function main() {
  const dir = join(ROOT, "data", "structures");
  const files = (await readdir(dir)).filter((f) => extname(f) === ".json");

  /**
   * mesh name -> every group it appears under, across all models.
   *
   * The same mesh is grouped differently in different files — a costal cartilage
   * sits under "Cartilages_right" in one model and the ambiguous "Bones and
   * cartilages" in another. Collecting all of them and accepting a match against
   * any one avoids failing on whichever model happened to be read first.
   */
  const meshIndex = await readJson(join(ROOT, "data", "mesh-index.json"));
  const groupsOfMesh = new Map(); // name -> Set<group>
  for (const groups of Object.values(meshIndex)) {
    for (const [group, names] of Object.entries(groups)) {
      for (const name of names) {
        const set = groupsOfMesh.get(name) ?? new Set();
        set.add(group);
        groupsOfMesh.set(name, set);
      }
    }
  }

  const structures = [];
  for (const file of files.sort()) {
    const entries = await readJson(join(dir, file));
    for (const e of entries) structures.push({ ...e, __file: file });
  }

  const errors = [];
  const warnings = [];
  const notes = [];

  // 1 + 2 + 3 + 4
  const seenIds = new Map();
  const claimedBy = new Map(); // exact mesh name -> [ids]
  const aliasOwner = new Map(); // canonical side-stripped key -> id

  for (const s of structures) {
    const where = `${s.__file} :: ${s.id ?? "(no id)"}`;

    for (const field of ["id", "en", "layer", "region"]) {
      if (!s[field]) errors.push(`${where}: missing required field "${field}"`);
    }
    if (!Array.isArray(s.meshNames) || s.meshNames.length === 0) {
      errors.push(`${where}: meshNames is empty`);
      continue;
    }

    if (seenIds.has(s.id)) {
      errors.push(`${where}: duplicate id, also in ${seenIds.get(s.id)}`);
    }
    seenIds.set(s.id, s.__file);

    for (const name of s.meshNames) {
      const list = claimedBy.get(name) ?? [];
      list.push(s.id);
      claimedBy.set(name, list);

      const sideless = sidelessMeshName(name);
      if (sideless !== name.trim()) {
        const key = canonicalMeshName(sideless);
        const owner = aliasOwner.get(key);
        if (owner && owner !== s.id) {
          errors.push(
            `${where}: side-stripped alias "${sideless}" collides with structure "${owner}" — ` +
              `one of them will show the other's content`
          );
        }
        aliasOwner.set(key, s.id);
      } else {
        aliasOwner.set(canonicalMeshName(name), s.id);
      }
    }
  }

  for (const [name, ids] of claimedBy) {
    if (ids.length > 1) {
      errors.push(`mesh "${name}" is claimed by ${ids.length} structures: ${ids.join(", ")}`);
    }
  }

  /*
   * 5. Declared layer vs the layer implied by the model's own grouping.
   *
   * Some disagreements are structural, not mistakes. The source models have no
   * separate Tendons group — tendons and aponeuroses live inside "Muscles" — so
   * a tendon correctly declared as `tendon` will always look like a `muscle` to
   * the grouping. Those pairs are recorded as expected rather than silenced.
   */
  /**
   * Per-structure allowances, each with a stated anatomical reason. Kept
   * deliberately small and specific — a blanket rule would hide real mistakes.
   */
  const ALLOWED_BY_ID = {
    "glenoid-labrum":
      "fibrocartilage, but the source files it with the capsule and ligaments",
    "xiphoid-process":
      "a bone, but filed under the articular system because it is cartilaginous until adulthood",
  };

  const EXPECTED_PAIRS = new Set([
    "tendon:muscle", // source files keep tendons inside the Muscles group
    "other:muscle", // aponeuroses and fat pads likewise
    "attachment:muscle",
    "bursa:muscle", // synovial sheaths filed with the muscles they wrap
    // Articular cartilage is a cartilage, but it exists only as part of a joint,
    // and several models file it under "Articular system" or a joint group.
    "cartilage:joint",
    "cartilage:ligament", // capsule-and-ligament groups that include labra/discs
    "joint:cartilage", // and the reverse, in models that lead with cartilage
    // The superficial transverse metacarpal ligament lies within the palmar
    // aponeurosis, so some models file it with the muscles.
    "ligament:muscle",
  ]);

  for (const s of structures) {
    if (!s.layer) continue;
    for (const name of s.meshNames) {
      const groups = groupsOfMesh.get(name);
      if (!groups) continue;

      const derivations = [...groups].map((g) => ({ group: g, layer: layerForMesh(name, g) }));
      // Accept if ANY model's grouping agrees.
      if (derivations.some((d) => d.layer === s.layer)) continue;
      // Ignore groups that yield nothing meaningful.
      const meaningful = derivations.filter(
        (d) => d.layer !== "unclassified" && d.layer !== "other"
      );
      if (meaningful.length === 0) continue;

      const d = meaningful[0];
      const msg =
        `${s.__file} :: ${s.id}: declared layer "${s.layer}" but "${name}" ` +
        `(group "${d.group}") implies "${d.layer}"`;

      if (ALLOWED_BY_ID[s.id]) notes.push(`${msg} — ${ALLOWED_BY_ID[s.id]}`);
      else if (EXPECTED_PAIRS.has(`${s.layer}:${d.layer}`)) notes.push(msg);
      else errors.push(msg);
    }
  }

  // 6. Name plausibility.
  for (const s of structures) {
    const nameTokens = tokens(s.en);
    if (nameTokens.size === 0) continue;

    const matched = s.meshNames.some((mesh) => {
      const meshTokens = tokens(mesh);
      if (meshTokens.size === 0) return true;
      for (const t of nameTokens) {
        for (const m of meshTokens) {
          // A shared five-character stem accepts English/Latin pairs such as
          // "scalene"/"scalenus" and "cruciate"/"cruciatum".
          if (t === m || t.startsWith(m) || m.startsWith(t)) return true;
          if (t.length >= 5 && m.length >= 5 && t.slice(0, 5) === m.slice(0, 5)) return true;
        }
      }
      // Synonyms and the Latin term are legitimate alternative vocabulary.
      const extra = tokens([s.ta2 ?? "", ...(s.synonyms ?? [])].join(" "));
      for (const t of extra) for (const m of meshTokens) if (t === m) return true;
      return false;
    });

    if (!matched) {
      warnings.push(
        `${s.__file} :: ${s.id}: name "${s.en}" shares no vocabulary with its mesh ` +
          `names (${s.meshNames.slice(0, 2).join(", ")}) — check it is not mismatched`
      );
    }
  }

  // 7. Coverage.
  const missingPlain = structures.filter((s) => !s.plain);
  const missingClinical = structures.filter((s) => !s.clinical);
  const missingTa2 = structures.filter((s) => !s.ta2);
  const missingCurriculum = structures.filter((s) => !s.curriculum);

  console.log(`Audited ${structures.length} structures across ${files.length} files.\n`);

  const show = (label, list, limit = 12) => {
    if (list.length === 0) return;
    console.log(`${label} (${list.length}):`);
    for (const item of list.slice(0, limit)) console.log(`  ${item}`);
    if (list.length > limit) console.log(`  ...and ${list.length - limit} more`);
    console.log("");
  };

  show("ERRORS", errors.map((e) => `x ${e}`), 30);
  show("WARNINGS", warnings.map((w) => `~ ${w}`), 20);
  show("EXPECTED DIFFERENCES", notes.map((n) => `. ${n}`), 10);

  console.log("Coverage:");
  console.log(`  plain explanation : ${structures.length - missingPlain.length}/${structures.length}`);
  console.log(`  clinical note     : ${structures.length - missingClinical.length}/${structures.length}`);
  console.log(`  TA2 Latin term    : ${structures.length - missingTa2.length}/${structures.length}`);
  console.log(`  curriculum tags   : ${structures.length - missingCurriculum.length}/${structures.length}`);
  if (missingPlain.length) {
    console.log(`  no explanation    : ${missingPlain.map((s) => s.id).join(", ")}`);
  }

  if (errors.length) {
    console.error(`\nFAILED — ${errors.length} error(s).`);
    process.exit(1);
  }
  console.log(`\nNo content errors.${warnings.length ? ` ${warnings.length} warning(s) to review.` : ""}`);
}

main();
