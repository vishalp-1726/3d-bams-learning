"use client";

import { create } from "zustand";
import { parseGroup, layerForMesh, DEFAULT_HIDDEN_LAYERS } from "./tissue-map.mjs";
import type { Layer } from "./types";

/** Standard anatomical viewing directions. */
export type StandardView = "front" | "back" | "left" | "right" | "top" | "bottom";

/**
 * Unit direction FROM the model TO the camera, per view.
 *
 * The models are built facing -Z, so "front" looks from -Z. Left and right are
 * named for the patient's side, which is the convention students are taught, not
 * the viewer's side.
 */
export const VIEW_DIRECTIONS: Record<StandardView, [number, number, number]> = {
  front: [0, 0, -1],
  back: [0, 0, 1],
  right: [-1, 0, 0],
  left: [1, 0, 0],
  top: [0, 1, 0.0001],
  bottom: [0, -1, 0.0001],
};

/**
 * Viewer state, kept outside the R3F tree so the 2D UI (panels, search, toggles)
 * and the 3D scene stay in sync without prop-drilling through <Canvas>.
 *
 * Everything is keyed by raw mesh name — the join key shared by the geometry and
 * the content layer.
 *
 * Visibility is filtered on two independent axes, because the source models carry
 * both: tissue layer (bones/muscles/nerves…) and anatomical sub-region (upper-limb
 * splits into "Pectoral girdle", "Arm", "Forearm", "Hand and wrist", …). A student
 * revising the brachial plexus wants nerves, in the arm, and nothing else.
 */
interface ViewerState {
  meshLayer: Record<string, Layer>;
  meshRegion: Record<string, string | null>;
  /** layer -> mesh names present in this model. */
  layerMeshes: Partial<Record<Layer, string[]>>;
  /** sub-region -> mesh names. Empty when the model doesn't use sub-regions. */
  regionMeshes: Record<string, string[]>;
  /**
   * Canonical mesh name -> the original name from the GLB file.
   * three.js mangles names on load, so this restores them for display.
   */
  meshLabels: Record<string, string>;

  selected: string | null;
  hovered: string | null;
  isolated: string | null;
  hiddenLayers: Set<Layer>;
  hiddenRegions: Set<string>;
  hiddenMeshes: Set<string>;
  /** 0..1 — fades everything that is not selected, to reveal deep structures. */
  contextOpacity: number;
  /**
   * Mirror the lateral structures to build a whole body from the hemi-body model.
   * Off by default: it doubles the geometry on screen, and the mirrored half is a
   * reflection rather than scanned data.
   */
  mirrored: boolean;
  /**
   * A request to frame a structure. Carries a nonce so asking twice for the same
   * structure still fires — the viewer reacts to the object identity changing.
   */
  focusRequest: { meshName: string; nonce: number } | null;
  /**
   * A request to jump to a standard anatomical view. Dragging is fine once you
   * know it works, but "show me the back" should not require a precise sweep
   * across the canvas — especially on a trackpad.
   */
  viewRequest: { view: StandardView; nonce: number } | null;

  setModel: (groups: Record<string, string[]>) => void;
  setMeshLabels: (labels: Record<string, string>) => void;
  select: (meshName: string | null) => void;
  hover: (meshName: string | null) => void;
  toggleLayer: (layer: Layer) => void;
  toggleRegion: (region: string) => void;
  hideMesh: (meshName: string) => void;
  isolate: (meshName: string | null) => void;
  setContextOpacity: (value: number) => void;
  toggleMirror: () => void;
  focusOn: (meshName: string) => void;
  setView: (view: StandardView) => void;
  reset: () => void;
}

export const useViewer = create<ViewerState>((set, get) => ({
  meshLayer: {},
  meshRegion: {},
  layerMeshes: {},
  regionMeshes: {},
  meshLabels: {},
  selected: null,
  hovered: null,
  isolated: null,
  hiddenLayers: new Set(),
  hiddenRegions: new Set(),
  hiddenMeshes: new Set(),
  contextOpacity: 1,
  mirrored: false,
  focusRequest: null,
  viewRequest: null,

  setModel: (groups) => {
    const meshLayer: Record<string, Layer> = {};
    const meshRegion: Record<string, string | null> = {};
    const layerMeshes: Partial<Record<Layer, string[]>> = {};
    const regionMeshes: Record<string, string[]> = {};

    for (const [group, names] of Object.entries(groups)) {
      const { region } = parseGroup(group);
      for (const name of names) {
        // Resolved per mesh, not per group: several source groups mix tissues
        // (e.g. "Posterior trunk part" holds ligaments, vessels and cartilage).
        const layer = layerForMesh(name, group);
        meshLayer[name] = layer;
        meshRegion[name] = region;
        (layerMeshes[layer] ??= []).push(name);
        if (region) (regionMeshes[region] ??= []).push(name);
      }
    }

    // Only hide a default-hidden layer if the model has something else to show;
    // a model made entirely of "other" would otherwise open completely blank.
    const hiddenLayers = new Set(
      DEFAULT_HIDDEN_LAYERS.filter(
        (layer) => layerMeshes[layer] && Object.keys(layerMeshes).length > 1
      )
    );

    set({
      meshLayer,
      meshRegion,
      layerMeshes,
      regionMeshes,
      hiddenLayers,
      hiddenRegions: new Set(),
      hiddenMeshes: new Set(),
      selected: null,
      hovered: null,
      isolated: null,
      contextOpacity: 1,
    });
  },

  setMeshLabels: (labels) => set({ meshLabels: labels }),

  select: (meshName) => set({ selected: meshName }),
  hover: (meshName) => set({ hovered: meshName }),

  toggleLayer: (layer) => {
    const next = new Set(get().hiddenLayers);
    next.has(layer) ? next.delete(layer) : next.add(layer);
    set({ hiddenLayers: next });
  },

  toggleRegion: (region) => {
    const next = new Set(get().hiddenRegions);
    next.has(region) ? next.delete(region) : next.add(region);
    set({ hiddenRegions: next });
  },

  hideMesh: (meshName) => {
    const next = new Set(get().hiddenMeshes);
    next.add(meshName);
    set({ hiddenMeshes: next, selected: null });
  },

  isolate: (meshName) => set({ isolated: meshName }),
  setContextOpacity: (value) => set({ contextOpacity: value }),
  toggleMirror: () => set({ mirrored: !get().mirrored }),

  focusOn: (meshName) =>
    set({ focusRequest: { meshName, nonce: (get().focusRequest?.nonce ?? 0) + 1 } }),

  setView: (view) => set({ viewRequest: { view, nonce: (get().viewRequest?.nonce ?? 0) + 1 } }),

  reset: () =>
    set({
      selected: null,
      hovered: null,
      isolated: null,
      hiddenMeshes: new Set(),
      hiddenRegions: new Set(),
      contextOpacity: 1,
    }),
}));

/**
 * Where the pointer was pressed, in client coordinates.
 *
 * Deliberately a plain mutable object rather than store state: it changes on every
 * pointer press and nothing should re-render because of it. It exists so a drag
 * (rotating the view) can be told apart from a click (selecting a structure) —
 * R3F reports both as a click otherwise.
 */
export const pointerPress = { x: 0, y: 0, pressed: false };

/** True when the pointer has travelled far enough to count as a drag, not a click. */
export function isDrag(event: { clientX: number; clientY: number }, threshold = 5) {
  if (!pointerPress.pressed) return false;
  return Math.hypot(event.clientX - pointerPress.x, event.clientY - pointerPress.y) > threshold;
}

/** Is this mesh currently rendered? */
export function isMeshVisible(state: ViewerState, meshName: string): boolean {
  if (state.isolated) return state.isolated === meshName;
  if (state.hiddenMeshes.has(meshName)) return false;

  const layer = state.meshLayer[meshName];
  if (layer && state.hiddenLayers.has(layer)) return false;

  const region = state.meshRegion[meshName];
  if (region && state.hiddenRegions.has(region)) return false;

  return true;
}
