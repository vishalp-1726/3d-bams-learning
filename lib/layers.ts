import type { Layer } from "./types";
import {
  parseGroup,
  layerForMesh,
  inferLayerFromName,
  DEFAULT_HIDDEN_LAYERS,
} from "./tissue-map.mjs";
export type { ParsedGroup } from "./tissue-map.mjs";

/**
 * Tissue-layer derivation lives in ./tissue-map.mjs as plain JS, so the app and
 * the build-time verifier share one implementation. See that file for the six
 * different group-naming conventions the source models use.
 */
export { parseGroup, layerForMesh, inferLayerFromName, DEFAULT_HIDDEN_LAYERS };

export function layerForGroup(group: string): Layer {
  return parseGroup(group).layer;
}

/** True for meshes that are decoration rather than a named structure. */
export function isOverlay(group: string): boolean {
  return /overlay/i.test(group);
}

/**
 * Highlight colours. Deliberately a single accent rather than per-layer colours —
 * the models already carry anatomically meaningful colours (bone ivory, artery
 * red, vein blue, nerve yellow) and recolouring them would fight the source.
 * Defined in lib/theme.mjs so the verification scripts use the same values.
 */
export {
  SELECTION_COLOR,
  HOVER_COLOR,
  CANVAS_BG,
  SELECTION_INTENSITY,
  HOVER_INTENSITY,
} from "./theme.mjs";
