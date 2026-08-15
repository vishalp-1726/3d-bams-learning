/**
 * Core domain types.
 *
 * The whole platform hangs off one idea: every mesh inside an Open3DModel GLB
 * already carries its correct anatomical name (e.g. "Capitate", "Flexor pollicis
 * longus"). We never rename or merge those meshes — we join our teaching content
 * to the geometry by exact mesh name.
 */

/** Anatomical tissue layer. Drives the layer toggles and default colouring. */
export type Layer =
  | "bone"
  | "cartilage"
  | "joint"
  | "ligament"
  | "muscle"
  | "attachment"
  | "tendon"
  | "nerve"
  | "artery"
  | "vein"
  | "bursa"
  | "organ"
  | "landmark"
  /** Recognised decoration: fascia sheets and painted overlays. Hidden by default. */
  | "other"
  /** Could not be identified. Stays visible — never hide what we merely failed to label. */
  | "unclassified";

/** Display order for the layer toggles — anatomical, not alphabetical. */
export const LAYERS: Layer[] = [
  "bone",
  "cartilage",
  "joint",
  "ligament",
  "muscle",
  "attachment",
  "tendon",
  "nerve",
  "artery",
  "vein",
  "bursa",
  "organ",
  "landmark",
  "unclassified",
  "other",
];

export const LAYER_LABELS: Record<Layer, string> = {
  bone: "Bones",
  cartilage: "Cartilages",
  joint: "Joints & capsules",
  ligament: "Ligaments",
  muscle: "Muscles",
  attachment: "Attachments",
  tendon: "Tendons",
  nerve: "Nerves",
  artery: "Arteries",
  vein: "Veins",
  bursa: "Bursae & sheaths",
  organ: "Organs",
  landmark: "Regions & canals",
  unclassified: "Other structures",
  other: "Fascia & overlays",
};

/**
 * One anatomical structure.
 *
 * `meshNames` is the join key to the 3D geometry and MUST match the names inside
 * the GLB byte-for-byte. A structure may map to several meshes (e.g. a muscle
 * split into heads, or a bilateral structure).
 */
export interface Structure {
  /** Stable slug, used in URLs and quiz progress. */
  id: string;
  /** Exact mesh names inside the GLB. The join key. Never edit to "tidy" them. */
  meshNames: string[];
  /** Terminologia Anatomica (TA2) Latin term. */
  ta2?: string;
  /** Preferred English name. */
  en: string;
  /** Foundational Model of Anatomy id, e.g. "FMA23709". */
  fma?: string;
  /** Alternative/eponymous names students may search for. */
  synonyms?: string[];
  /** Reserved for a future Sanskrit/Ayurvedic terminology layer (BAMS). */
  sanskrit?: string;
  layer: Layer;
  region: RegionId;
  /** Plain, exam-focused explanation in simple English. */
  plain?: string;
  /** Fuller detail: attachments, relations, articulations. */
  detail?: string;
  /** Clinical correlation — the bit that makes it stick. */
  clinical?: string;
  curriculum?: {
    /** NMC CBME competency codes, e.g. ["AN10.1"]. */
    nmc?: string[];
    /** NCISM AyUG-RS module ids, e.g. ["AyUG-RS-P1-M04"]. */
    ncism?: string[];
  };
  /** Where the explanation came from, for attribution and checking. */
  sources?: string[];
}

/**
 * A model's id is its Open3DModel viewer slug (e.g. "zone-knee", "hand").
 * Deliberately a plain string rather than a union: the catalogue is data, and
 * the consortium publishes new models over time — `npm run models:discover`
 * picks them up without a code change.
 */
export type RegionId = string;

/** Body region used to group the catalogue on the home page. */
export type ModelGroup =
  | "Skeleton & general"
  | "Head"
  | "Trunk"
  | "Pelvis & inguinal region"
  | "Upper limb"
  | "Lower limb";

/** Display order for the home page. */
export const MODEL_GROUPS: ModelGroup[] = [
  "Skeleton & general",
  "Head",
  "Trunk",
  "Upper limb",
  "Lower limb",
  "Pelvis & inguinal region",
];

/** A downloadable model file plus everything needed to present it. */
export interface ModelEntry {
  /** Open3DModel viewer slug; also the filename stem and the URL segment. */
  id: RegionId;
  title: string;
  group: ModelGroup;
  /** One-line description for the catalogue. */
  blurb: string;
  /** Filename relative to the model base URL. */
  file: string;
  /** Download size in MB, measured. Shown before loading. */
  sizeMB: number;
  /**
   * Number of named meshes, filled in by `npm run models:names`.
   * 0 means "not yet counted", not "empty".
   */
  meshCount: number;
}
