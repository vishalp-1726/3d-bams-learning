import type { Layer } from "./types";

export interface ParsedGroup {
  /** Anatomical sub-region, e.g. "Hand and wrist" or "Superficial". */
  region: string | null;
  /** The group's best single guess at a tissue layer. */
  layer: Layer;
  /** True when the group names several tissues, or none — prefer per-mesh resolution. */
  ambiguous: boolean;
}

export declare function parseGroup(group: string): ParsedGroup;
export declare function inferLayerFromName(meshName: string): Layer | null;
export declare function layerForMesh(meshName: string, group: string): Layer;
export declare const DEFAULT_HIDDEN_LAYERS: Layer[];
