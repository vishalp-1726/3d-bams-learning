/**
 * Display formatting for raw mesh names.
 *
 * Source mesh names are authored for a 3D outliner, not for reading. They use
 * anatomical abbreviations and a "Parent Child" nesting convention:
 *
 *   "Median nerve Recurrent br"        -> "Recurrent branch of the median nerve"
 *   "Ulnar nerve Superficial br Common palmar digital n"
 *                                      -> "Common palmar digital nerve of the
 *                                          superficial branch of the ulnar nerve"
 *   "Distal phalanx of 2d finger"      -> "Distal phalanx of 2nd finger"
 *
 * We never mutate the mesh name itself — that is the join key to the geometry.
 * This is presentation only.
 */

/** Abbreviations used in the source models, longest-first to avoid partial hits. */
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bbrr\b/gi, "branches"],
  [/\bbr\b/gi, "branch"],
  [/\bnn\b/g, "nerves"],
  [/\bn\b/g, "nerve"],
  [/\baa\b/g, "arteries"],
  [/\ba\b(?![-\w])/g, "artery"],
  [/\bvv\b/g, "veins"],
  [/\bv\b/g, "vein"],
  [/\bmm\b/g, "muscles"],
  [/\bm\b/g, "muscle"],
  [/\blig\b/gi, "ligament"],
  [/\bligg\b/gi, "ligaments"],
];

/** The source files write ordinals inconsistently: "2d finger", "3d finger". */
const ORDINALS: Array<[RegExp, string]> = [
  [/\b1st\b/g, "1st"],
  [/\b2d\b/g, "2nd"],
  [/\b3d\b/g, "3rd"],
];

function expand(text: string): string {
  let out = text;
  for (const [pattern, replacement] of ORDINALS) out = out.replace(pattern, replacement);
  for (const [pattern, replacement] of ABBREVIATIONS) out = out.replace(pattern, replacement);
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Turn a raw mesh name into a readable label.
 *
 * Only nerve/vessel names use the "Parent Child" nesting convention, and only
 * when a known trunk prefix is present — so we rebuild those as
 * "<child> of the <parent>" and leave everything else alone.
 */
const TRUNK_PREFIXES = [
  "Median nerve",
  "Ulnar nerve",
  "Radial nerve",
  "Musculocutaneous nerve",
  "Axillary nerve",
  "Sciatic nerve",
  "Femoral nerve",
  "Tibial nerve",
  "Common fibular nerve",
  "Obturator nerve",
];

/**
 * Undo three.js's node-name mangling well enough to read.
 *
 * Used only as a fallback when the per-region label lookup hasn't loaded — the
 * lookup restores the true original name, this just makes the canonical form
 * legible. The trailing "r"/"l" comes from a stripped ".r"/".l" side marker.
 */
function unmangle(meshName: string): string {
  let text = meshName.includes("_") ? meshName.replace(/_/g, " ") : meshName;

  // Zero-width spaces appear in several source names and would otherwise show as
  // invisible gaps that break the side-marker match below.
  text = text.replace(/[​-‍﻿]/g, "");

  /*
   * Drop the side marker. Every model is right-sided, so ".r" on the end of every
   * heading is noise — and left as-is it reads as part of the name, which is how
   * "Sternocostal head of pectoralis major muscle.r" ended up on screen.
   */
  text = text.replace(/\.\s*[rl]\d*\.?\s*$/i, "");

  // "…major muscle" reads better as "…major"; the layer already says it is one.
  text = text.replace(/\s+muscles?$/i, "");

  return text.trim();
}

export function displayName(rawName: string): string {
  const meshName = unmangle(rawName);

  const trunk = TRUNK_PREFIXES.find(
    (t) => meshName.startsWith(t + " ") && meshName.length > t.length + 1
  );

  if (!trunk) return capitalise(expand(meshName));

  const remainder = expand(meshName.slice(trunk.length).trim());
  if (!remainder) return trunk;
  return capitalise(`${remainder} of the ${trunk.toLowerCase()}`);
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Label for a mesh, preferring the original name from the GLB when available.
 * `labels` is the per-region canonical -> original lookup from the viewer store.
 */
export function labelForMesh(
  meshName: string,
  labels: Record<string, string>
): string {
  return displayName(labels[meshName] ?? meshName);
}

/** Stable slug for URLs and progress keys. */
export function slugify(meshName: string): string {
  return meshName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
