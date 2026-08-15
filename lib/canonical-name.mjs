/**
 * Canonical form of a mesh name — the real join key between geometry and content.
 *
 * THE PROBLEM
 *
 * We author `meshNames` in data/structures/*.json verbatim from the GLB, and
 * verify-mesh-names.mjs confirms they match the file byte-for-byte. But three.js
 * does NOT hand those names to the application unchanged. GLTFLoader passes every
 * node name through THREE.PropertyBinding.sanitizeNodeName, which exists so names
 * can be used in animation binding paths:
 *
 *     name.replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '')
 *
 * So the scene we actually raycast against contains:
 *
 *     "Anterior cruciate ligament.r"  ->  "Anterior_cruciate_ligamentr"
 *     "Superior trunk of brachial plexus.r" -> "Superior_trunk_of_brachial_plexusr"
 *     "Scaphoid"                     ->  "Scaphoid"          (unchanged)
 *
 * Nearly every name in these models contains a space or a trailing ".r", so
 * matching raw names at runtime silently fails for almost everything — while
 * still appearing to work for single-word names like "Scaphoid". That is exactly
 * the kind of bug that looks fine in a spot check.
 *
 * THE FIX
 *
 * Canonicalise both sides. Content is still authored verbatim (so it stays
 * checkable against the GLB), but every lookup goes through this function.
 *
 * This must stay identical to three's implementation. If a three upgrade changes
 * sanitizeNodeName, `npm run check:visual` is what will catch it — the Node-side
 * verifier reads raw GLB JSON and is blind to this transformation by design.
 */

const RESERVED = /[\[\]\.:\/]/g;

export function canonicalMeshName(name) {
  return String(name).replace(/\s/g, "_").replace(RESERVED, "");
}

/**
 * Strip the side marker so the same structure resolves across models.
 *
 * The marker is written inconsistently across the 36 files, and the variants all
 * appear in real data:
 *
 *   "Anterior cruciate ligament.r"   knee
 *   "Humerus.r."                     shoulder — trailing dot
 *   "Scapula.r."                     skeleton
 *   "Deltoid muscle.r2"              shoulder — numbered duplicate
 *   " Rectus abdominal muscle.r"     shoulder — leading space
 *
 * Without handling all of them, teaching content written against one model
 * silently fails to appear in another that contains the very same bone.
 */
export function sidelessMeshName(name) {
  return String(name)
    .trim()
    .replace(/\.\s*[rl]\d*\.?$/i, "")
    .trim();
}

/**
 * Reduce a mesh name to the structure it is really about.
 *
 * The muscle-attachments model names each painted patch after the muscle that
 * attaches there:
 *
 *   "Iliacus origin and insertion.r"   ->  "Iliacus"
 *   "Biceps brachii insertion.r"       ->  "Biceps brachii"
 *   "Flexor carpi ulnaris origins.r"   ->  "Flexor carpi ulnaris"
 *
 * Without this, all 341 attachment patches dead-end with a name and no
 * explanation, even when the muscle itself is fully written up elsewhere.
 *
 * The trailing "muscle" is also dropped so that "Deltoid muscle.r2" and
 * "Deltoid origin and insertion.r" reach the same entry.
 */
export function normalisedMeshName(name) {
  return sidelessMeshName(name)
    .replace(/\s+(origins?|insertions?)(\s+and\s+(origins?|insertions?))?$/i, "")
    .replace(/\s+muscles?$/i, "")
    .trim();
}
