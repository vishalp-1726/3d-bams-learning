/**
 * Group/mesh name -> tissue-layer mapping. Plain JS so the build scripts and the
 * app share ONE implementation — a mismatch between what the verifier checks and
 * what the viewer does would defeat the point of the verifier.
 *
 * Open3DModel GLBs organise every mesh under a top-level group node, authored by
 * the anatomists who built the models. Across the 36 published models there are
 * 111 distinct group names using at least six conventions:
 *
 *   plain tissue        "Bones", "Muscles", "Nerves"
 *   region - tissue     "Hand and wrist - bones", "Arm - capsules, ligaments, fasciae"
 *   tissue - qualifier  "Veins - Superficial", "Arteries - Brachial"
 *   tissue + region     "Muscles of back", "Arteries inguinal region"
 *   organ system        "Genital system", "Urinary system", "Intestines"
 *   mixed region        "Posterior trunk part"  (ligaments + vessels + cartilage together)
 *
 * So a single group name cannot always determine the layer. The resolution order
 * is: unambiguous group -> per-mesh name -> best guess from the group -> "other".
 * Nothing is allowed to silently vanish, because a structure in a hidden layer is
 * a structure the student can never find.
 */

/**
 * Tissue keywords, in priority order (earlier wins ties).
 * Each entry is [pattern, layer].
 */
const TISSUE_PATTERNS = [
  [/synovi|bursae|bursa/i, "bursa"],
  [/attachment|insertion|origin/i, "attachment"],
  [/capsules?|ligaments?|ligg?\b|retinacul/i, "ligament"],
  [/tendons?|tendin|sheaths?|aponeuros/i, "tendon"],
  [/muscles?|musculus/i, "muscle"],
  [/arter/i, "artery"],
  [/veins?|venous/i, "vein"],
  [/nerves?|plexus/i, "nerve"],
  [/bones?|osseous/i, "bone"],
  // "cart" is the source files' abbreviation: "Costal cart of 8th rib.r".
  // Without it those meshes fall back to the group, which in the
  // insertions-and-origins model is the ambiguous "Bones and cartilages",
  // and ten costal cartilages get labelled as bones.
  [/cartilages?|\bcart\b/i, "cartilage"],
  [/joints?|articular/i, "joint"],
  [/genital|urinary|urogenital|intestin|viscera|prostate|bladder|urethra/i, "organ"],
  [/regions?|canals?|openings?|triangles?|hiatus|foramen|fossae?/i, "landmark"],
  [/fasciae?|overlays?/i, "other"],
];

/**
 * Only positively-identified decoration is hidden on first load.
 *
 * "other" means we recognised the mesh as fascia or an overlay. "unclassified"
 * means we simply could not tell — and those stay VISIBLE, because hiding a
 * structure we merely failed to label would make it undiscoverable. Muscle names
 * are the common case: "Adductor magnus" and "Biceps femoris, long head" contain
 * no tissue keyword at all.
 */
export const DEFAULT_HIDDEN_LAYERS = ["other"];

/** All distinct layers a group name matches, in priority order. */
function matchLayers(text) {
  const seen = [];
  for (const [pattern, layer] of TISSUE_PATTERNS) {
    if (pattern.test(text) && !seen.includes(layer)) seen.push(layer);
  }
  return seen;
}

/**
 * Split a group name into its tissue part and its anatomical sub-region.
 *
 * Handles both "Hand and wrist - bones" (region first) and "Veins - Superficial"
 * (tissue first) by testing which side actually names a tissue. The right-hand
 * side is preferred when both match, so "Muscles - Attachments" resolves to
 * attachments rather than muscle bellies.
 */
function splitGroup(group) {
  const separator = group.indexOf(" - ");
  if (separator === -1) return { region: null, tissueText: group };

  const left = group.slice(0, separator).trim();
  const right = group.slice(separator + 3).trim();

  if (matchLayers(right).length > 0) return { region: left, tissueText: right };
  if (matchLayers(left).length > 0) return { region: right, tissueText: left };
  return { region: left, tissueText: right };
}

/**
 * @returns {{region: string|null, layer: string, ambiguous: boolean}}
 *   `layer` is the group's best single guess; `ambiguous` is true when the group
 *   name names more than one tissue (or none), meaning per-mesh resolution should
 *   be preferred.
 */
export function parseGroup(group) {
  const { region, tissueText } = splitGroup(group);
  const layers = matchLayers(tissueText);
  return {
    region,
    layer: layers[0] ?? "unclassified",
    ambiguous: layers.length !== 1,
  };
}

/**
 * Infer a layer from a mesh name, using the LEFTMOST keyword.
 *
 * Position beats priority here because anatomical names are head-first:
 * "Articular cartilage of sacroiliac joint on hip bone" is a cartilage, and the
 * word "cartilage" comes before both "joint" and "bone".
 */
export function inferLayerFromName(meshName) {
  let best = null;
  let bestIndex = Infinity;
  for (const [pattern, layer] of TISSUE_PATTERNS) {
    const match = meshName.match(pattern);
    if (match && match.index < bestIndex) {
      bestIndex = match.index;
      best = layer;
    }
  }
  return best;
}

/**
 * The layer actually used for a mesh. This is the single entry point — the
 * viewer and the verifier both call it, so what is checked is what is rendered.
 */
export function layerForMesh(meshName, group) {
  const { layer, ambiguous } = parseGroup(group);
  const decorationGroup = layer === "other";

  /*
   * A group that unambiguously names a real tissue is authoritative, even when
   * the individual meshes are drawn as painted overlays. The inguinal model's
   * "Regions, canals, openings" holds meshes literally named
   * "Inguinal canal overlay.r" and "Femoral triangle overlay.r" — those regions
   * are the entire point of that model, not decoration.
   */
  if (!ambiguous && !decorationGroup) return layer;

  /*
   * Otherwise the mesh name decides. "Overlays" and "Fascia" are containers of
   * convenience in the source files, not statements about tissue: the knee model
   * files its medial collateral ligament, patellar retinacula, and the oblique
   * popliteal and arcuate ligaments under "Overlays" — core exam structures that
   * would otherwise be hidden by default.
   */
  if (/overlay/i.test(meshName)) return "other";
  return inferLayerFromName(meshName) ?? layer;
}
