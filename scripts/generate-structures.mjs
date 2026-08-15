/**
 * Generate teaching content for the formulaic structure families.
 *
 * Of the 1,218 structures without an explanation, several hundred belong to
 * families where the name fully determines the anatomy: articular cartilages,
 * phalanges, metacarpals and metatarsals, interossei, lumbricals, numbered
 * vertebrae and the costovertebral joints. Writing 46 phalanges by hand would be
 * 46 near-identical paragraphs; a handler that understands the pattern produces
 * the same text more consistently and cannot drift.
 *
 * This is NOT filler. Each handler states the real anatomy of that structure —
 * which joint a cartilage belongs to, what a given phalanx carries, what a
 * numbered interosseous does — because a placeholder would be worse than the
 * honest "not written yet" notice it replaces.
 *
 * Anything the handlers do not recognise is left alone, so it shows up in
 * `npm run coverage` and gets written by hand.
 *
 *   npm run generate
 */

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { layerForMesh } from "../lib/tissue-map.mjs";
import {
  canonicalMeshName,
  sidelessMeshName,
  normalisedMeshName,
} from "../lib/canonical-name.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "structures", "generated.json");

/** Strip zero-width spaces, which several source names contain. */
const clean = (s) => s.replace(/[​-‍﻿]/g, "").trim();
const side = (s) => clean(s).replace(/\.\s*[rl]\d*\.?$/i, "").trim();

const slug = (s) =>
  clean(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const ORDINAL_DIGIT = {
  "1st": 1, first: 1, "2d": 2, "2nd": 2, second: 2, "3rd": 3, "3d": 3, third: 3,
  "4th": 4, fourth: 4, "5th": 5, fifth: 5,
};

const HAND_DIGIT = {
  1: { name: "thumb", latin: "pollicis" },
  2: { name: "index finger", latin: "indicis" },
  3: { name: "middle finger", latin: "medii" },
  4: { name: "ring finger", latin: "anularis" },
  5: { name: "little finger", latin: "minimi" },
};

const FOOT_DIGIT = {
  1: { name: "great toe", latin: "hallucis" },
  2: { name: "2nd toe", latin: "" },
  3: { name: "3rd toe", latin: "" },
  4: { name: "4th toe", latin: "" },
  5: { name: "little toe", latin: "minimi" },
};

const MSK = { ncism: ["AyUG-RS-P1-M04", "AyUG-RS-P1-M10"] };
const JOINT_CURRICULUM = { ncism: ["AyUG-RS-P1-M05", "AyUG-RS-P1-M11"] };
const MUSCLE_CURRICULUM = { ncism: ["AyUG-RS-P1-M07", "AyUG-RS-P1-M12"] };

// ---------------------------------------------------------------------------
// Handlers. Each returns content, or null if the name is not its business.
// ---------------------------------------------------------------------------

/** "Distal phalanx of 2d finger.r", "Proximal phalanx of first finger of foot.r" */
function phalanx(name) {
  const n = side(name);
  const m = n.match(
    /^(distal|middle|proximal)\s+phalanx\s+of\s+([\w]+)\s+(finger|toe)(\s+of\s+foot)?$/i
  );
  if (!m) return null;
  const [, position, ordinal, , footSuffix] = m;
  const digit = ORDINAL_DIGIT[ordinal.toLowerCase()];
  if (!digit) return null;

  const isFoot = Boolean(footSuffix) || /toe/i.test(m[3]);
  const table = isFoot ? FOOT_DIGIT : HAND_DIGIT;
  const d = table[digit];
  const part = isFoot ? "toe" : "finger";
  const region = isFoot ? "foot" : "hand";
  const pos = position.toLowerCase();

  // The thumb and great toe have only two phalanges.
  if (pos === "middle" && digit === 1) return null;

  const plainByPosition = {
    proximal: `The first and longest bone of the ${d.name}, meeting the ${
      isFoot ? "metatarsal" : "metacarpal"
    } behind it at the knuckle joint.`,
    middle: `The middle of the three bones of the ${d.name}, between the proximal and distal phalanges.`,
    distal: `The bone of the ${isFoot ? "tip of the " + d.name : d.name + " tip"}, carrying the nail bed on its upper surface.`,
  };

  const detailByPosition = {
    proximal: `Its base articulates with the head of the ${
      isFoot ? "metatarsal" : "metacarpal"
    } at the ${isFoot ? "metatarso" : "metacarpo"}phalangeal joint, and its head with the ${
      digit === 1 ? "distal" : "middle"
    } phalanx.`,
    middle: `Receives the insertion of flexor digitorum superficialis on its palmar surface, and part of the extensor expansion on its dorsal surface.`,
    distal: `Flattened and expanded at its tip into the distal tuberosity, which supports the pulp. ${
      isFoot
        ? "Receives flexor digitorum longus on its plantar surface."
        : "Receives flexor digitorum profundus on its palmar surface and the extensor expansion on its dorsal surface."
    }`,
  };

  return {
    id: slug(`${pos}-phalanx-${region}-${digit}`),
    en: `${position[0].toUpperCase()}${pos.slice(1)} phalanx of the ${d.name}`,
    ta2: `Phalanx ${pos === "proximal" ? "proximalis" : pos === "middle" ? "media" : "distalis"}`,
    layer: "bone",
    plain: plainByPosition[pos],
    detail: detailByPosition[pos],
    clinical:
      pos === "distal"
        ? `A crush injury here is the commonest ${part} fracture, and bleeding under the nail (a subungual haematoma) is what makes it so painful.`
        : undefined,
    curriculum: MSK,
  };
}

/** "2nd metacarpal bone.r", "First metatarsal bone.r" */
function metaBone(name) {
  const n = side(name);
  const m = n.match(/^([\w]+)\s+(metacarpal|metatarsal)\s+bone$/i);
  if (!m) return null;
  const digit = ORDINAL_DIGIT[m[1].toLowerCase()];
  if (!digit) return null;
  const isFoot = /metatarsal/i.test(m[2]);
  const d = (isFoot ? FOOT_DIGIT : HAND_DIGIT)[digit];

  const notes = isFoot
    ? {
        1: "The shortest and thickest metatarsal. It carries the most weight of the forefoot, and two sesamoid bones sit beneath its head.",
        2: "The longest metatarsal, wedged firmly between the cuneiforms — the keystone of the transverse arch and the commonest site of a march (stress) fracture.",
        3: "A slender middle metatarsal contributing to the transverse arch.",
        4: "Articulates with the cuboid, giving it more mobility than the medial three.",
        5: "Carries the prominent tuberosity on its base for fibularis brevis — the classic avulsion fracture site in an inversion injury.",
      }
    : {
        1: "Short and stout, and rotated about 90 degrees relative to the others, which is what allows the thumb to oppose.",
        2: "The longest metacarpal, firmly fixed to the trapezoid so the index finger has a stable base.",
        3: "Carries a styloid process on its base; also fixed, forming the stable central pillar of the hand with the 2nd.",
        4: "More mobile than the 2nd and 3rd, allowing the palm to cup.",
        5: "The most mobile metacarpal, and the one fractured by punching — a boxer's fracture of its neck.",
      };

  return {
    id: slug(`${isFoot ? "metatarsal" : "metacarpal"}-${digit}`),
    en: `${digit === 1 ? "1st" : digit === 2 ? "2nd" : digit === 3 ? "3rd" : digit + "th"} ${
      isFoot ? "metatarsal" : "metacarpal"
    }`,
    ta2: `Os ${isFoot ? "metatarsi" : "metacarpi"} ${["I", "II", "III", "IV", "V"][digit - 1]}`,
    layer: "bone",
    plain: `The long bone of the ${isFoot ? "foot" : "palm"} leading to the ${d.name}.`,
    detail: notes[digit],
    curriculum: MSK,
  };
}

/**
 * "Art cart of humerus head.r", "Art cart of glenohumeral joint on scapula.r",
 * "Art cart of capitate bone", "Vertebra T1 art cart"
 */
function articularCartilage(name) {
  const n = side(name);
  if (!/art\s*cart|articular cartilage/i.test(n)) return null;

  // "... joint on <bone>" — one side of a named joint.
  const onJoint = n.match(/art(?:icular)?\.?\s*cart(?:ilage)?\s+of\s+(.+?)\s+joint\s+on\s+(.+)$/i);
  // "Art cart of <thing>"
  const plain = n.match(/art(?:icular)?\.?\s*cart(?:ilage)?s?\s+of\s+(.+)$/i);
  // "Vertebra T1 art cart"
  const vertebra = n.match(/^vertebra\s+(\w+)\s+art\s*cart$/i);

  let subject;
  let joint = null;
  if (onJoint) {
    joint = clean(onJoint[1]);
    subject = clean(onJoint[2]);
  } else if (vertebra) {
    subject = `vertebra ${vertebra[1]}`;
  } else if (plain) {
    subject = clean(plain[1]);
  } else {
    return null;
  }

  subject = subject.replace(/\s+bone$/i, "").replace(/\s+/g, " ").trim();
  const readable = subject.toLowerCase();

  return {
    id: slug(`art-cart-${joint ? joint + "-" : ""}${subject}`),
    en: joint
      ? `Articular cartilage — ${joint} joint, ${readable} surface`
      : `Articular cartilage of the ${readable}`,
    ta2: "Cartilago articularis",
    layer: "cartilage",
    plain: joint
      ? `The smooth glassy layer capping the ${readable} where it forms the ${joint.toLowerCase()} joint. It lets the two bones slide against each other almost without friction.`
      : `The smooth glassy layer capping the joint surface of the ${readable}, letting it glide against the neighbouring bone almost without friction.`,
    detail:
      "Hyaline cartilage, typically 2–4 mm thick. It has no blood supply, no nerves and no lymphatics, and is fed by diffusion from the synovial fluid — which is why joint movement is what keeps it nourished.",
    clinical:
      "Because it is avascular and has no cell reserve, damaged articular cartilage does not regenerate; it is replaced at best by weaker fibrocartilage. Its progressive loss, with the joint-space narrowing seen on X-ray, is osteoarthritis.",
    curriculum: JOINT_CURRICULUM,
  };
}

/** "1st dorsal interosseus of hand", "Plantar interossei (2nd)" */
function interosseous(name) {
  const n = side(name);
  const m = n.match(
    /^(?:([\w]+)\s+)?(dorsal|palmar|plantar)\s+inteross(?:eus|ei)(?:\s+of\s+(hand|foot))?(?:\s*\((\w+)\))?$/i
  );
  if (!m) return null;
  const digit = ORDINAL_DIGIT[(m[1] ?? m[4] ?? "").toLowerCase()];
  const plane = m[2].toLowerCase();
  const region = m[3]?.toLowerCase() ?? (plane === "plantar" ? "foot" : "hand");
  const isFoot = region === "foot";

  const action =
    plane === "dorsal"
      ? `abducts the ${isFoot ? "toe" : "finger"} away from the midline`
      : `adducts the ${isFoot ? "toe" : "finger"} towards the midline`;
  const axis = isFoot ? "the second toe" : "the middle finger";

  return {
    id: slug(`${plane}-interosseous-${region}${digit ? "-" + digit : ""}`),
    en: `${digit ? `${digit === 1 ? "1st" : digit === 2 ? "2nd" : digit === 3 ? "3rd" : digit + "th"} ` : ""}${
      plane[0].toUpperCase() + plane.slice(1)
    } interosseous of the ${region}`,
    ta2: `Musculi interossei ${plane === "dorsal" ? "dorsales" : plane === "palmar" ? "palmares" : "plantares"}`,
    layer: "muscle",
    plain: `A small muscle lying between the ${
      isFoot ? "metatarsals" : "metacarpals"
    } that ${action}, measured from ${axis}.`,
    detail: `${
      plane === "dorsal" ? "Bipennate, arising from both adjacent shafts" : "Unipennate, arising from a single shaft"
    }, inserting into the base of the proximal phalanx and the extensor expansion. Supplied by the ${
      isFoot ? "lateral plantar nerve" : "deep branch of the ulnar nerve"
    }.`,
    clinical:
      "Remember DAB and PAD: Dorsal ABduct, Palmar ADduct. Wasting of the first web space is the earliest visible sign of an ulnar nerve lesion in the hand.",
    curriculum: MUSCLE_CURRICULUM,
  };
}

/** "1st lumbrical of hand", "Lumbricals of foot" */
function lumbrical(name) {
  const n = side(name);
  const m = n.match(/^(?:([\w]+)\s+)?lumbricals?(?:\s+of\s+(hand|foot))?$/i);
  if (!m) return null;
  const digit = ORDINAL_DIGIT[(m[1] ?? "").toLowerCase()];
  const region = m[2]?.toLowerCase() ?? "hand";
  const isFoot = region === "foot";

  return {
    id: slug(`lumbrical-${region}${digit ? "-" + digit : ""}`),
    en: `${digit ? `${digit === 1 ? "1st" : digit === 2 ? "2nd" : digit === 3 ? "3rd" : digit + "th"} ` : ""}Lumbrical of the ${region}`,
    ta2: `Musculi lumbricales ${isFoot ? "pedis" : "manus"}`,
    layer: "muscle",
    plain: `A small worm-shaped muscle running from a deep flexor tendon to the back of the ${
      isFoot ? "toe" : "finger"
    }. It bends the knuckle while keeping the rest of the digit straight.`,
    detail: `Arises from the tendon of flexor digitorum ${
      isFoot ? "longus" : "profundus"
    } and inserts into the extensor expansion — unusual in taking origin from a tendon rather than from bone.`,
    clinical: isFoot
      ? undefined
      : "The 1st and 2nd lumbricals are supplied by the median nerve and the 3rd and 4th by the ulnar nerve. That split is why an ulnar lesion claws only the ring and little fingers.",
    curriculum: MUSCLE_CURRICULUM,
  };
}

/** "Rib (8th) art cart of head.r", "3rd rib art cart of tubercle.r" */
function costalJoint(name) {
  const n = side(name);
  const m = n.match(/^(?:rib\s*\((\w+)\)|(\w+)\s+rib)\s+art\s*cart\s+of\s+(head|tubercle)$/i);
  if (!m) return null;
  const ordinal = (m[1] ?? m[2] ?? "").toLowerCase();
  const digit = ORDINAL_DIGIT[ordinal] ?? parseInt(ordinal, 10);
  const part = m[3].toLowerCase();

  return {
    id: slug(`rib-${digit}-art-cart-${part}`),
    en: `Articular cartilage — ${digit}${
      digit === 1 ? "st" : digit === 2 ? "nd" : digit === 3 ? "rd" : "th"
    } rib, ${part}`,
    ta2: part === "head" ? "Articulatio capitis costae" : "Articulatio costotransversaria",
    layer: "joint",
    plain:
      part === "head"
        ? `The joint surface where the head of this rib meets the bodies of the vertebrae, letting the rib swing as you breathe.`
        : `The joint surface where the tubercle of this rib meets the transverse process of its vertebra.`,
    detail:
      part === "head"
        ? "A typical rib head carries two facets and articulates with its own vertebra and the one above, across the intervertebral disc."
        : "The costotransverse joint. In the upper ribs its surface is curved, producing a pump-handle movement; lower down it is flatter, giving a bucket-handle movement.",
    clinical:
      "Together these two joints fix the axis about which the rib rotates — pump-handle above, raising the sternum, and bucket-handle below, widening the chest.",
    curriculum: JOINT_CURRICULUM,
  };
}

/** "Anulus fibrosus_L3_L40", "Annulus fibrosus T1 T2" */
function anulusFibrosus(name) {
  const n = side(name);
  const m = n.match(/^an+ulus\s*fibrosus[_\s]+([CTLS]?\d+)[_\s]+([CTLS]?\d+)/i);
  if (!m) return null;
  const upper = m[1].toUpperCase();
  const lower = m[2].toUpperCase().replace(/0$/, "");

  return {
    id: slug(`anulus-fibrosus-${upper}-${lower}`),
    en: `Anulus fibrosus, ${upper}–${lower}`,
    ta2: "Anulus fibrosus",
    layer: "cartilage",
    plain: `The tough outer ring of the disc between the ${upper} and ${lower} vertebrae. It holds the soft centre of the disc in place.`,
    detail:
      "Concentric lamellae of fibrocartilage whose fibres run obliquely, in opposite directions in adjacent layers — an arrangement that resists twisting and shearing while allowing the disc to compress.",
    clinical:
      "A tear lets the nucleus pulposus herniate, most often posterolaterally where the posterior longitudinal ligament is narrowest, compressing the nerve root as it leaves.",
    curriculum: JOINT_CURRICULUM,
  };
}

/** "Cervical vertebrae (C3)", "Thoracic vertebra (T1)", "Lumbar vertebrae (L4)" */
function namedVertebra(name) {
  const n = side(name);
  const m = n.match(/^(cervical|thoracic|lumbar)\s+vertebrae?\s*\(([CTL]\d+)\)$/i);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const label = m[2].toUpperCase();

  const byKind = {
    cervical: {
      plain: `A neck vertebra. Every cervical vertebra has a hole in each side process that no other vertebra has — the artery to the brain passes up through them.`,
      detail:
        "Small body, triangular vertebral foramen, and a foramen transversarium in each transverse process. C3 to C6 have bifid spines; C7 has a long single spine you can feel.",
      clinical:
        "The vertebral artery ascends through the foramina transversaria of C6 up to C1. C7's prominent spine is the landmark for counting vertebral levels.",
    },
    thoracic: {
      plain: `A chest vertebra. These are the only vertebrae with ribs attached, and their spines slope steeply downwards like roof tiles.`,
      detail:
        "Costal facets on the body for the rib head and on the transverse process for the rib tubercle, a circular vertebral foramen, and a long downward-sloping spine.",
      clinical:
        "The spines overlap so steeply that the tip of a mid-thoracic spine lies level with the body of the vertebra below — which matters when localising a level from the surface.",
    },
    lumbar: {
      plain: `A lower back vertebra. These carry the most weight, so their bodies are the largest of all.`,
      detail:
        "Massive kidney-shaped body, no costal facets and no foramen transversarium, a short blunt spine, and sagittally set facet joints that allow flexion and extension but little rotation.",
      clinical:
        "The highest points of the iliac crests lie at L4, guiding lumbar puncture at L3/L4 or L4/L5 — safely below the conus medullaris, which ends around L1/L2 in adults.",
    },
  };

  return {
    id: slug(`vertebra-${label}`),
    en: `${kind[0].toUpperCase()}${kind.slice(1)} vertebra ${label}`,
    ta2: `Vertebra ${kind === "cervical" ? "cervicalis" : kind === "thoracic" ? "thoracica" : "lumbalis"}`,
    layer: "bone",
    ...byKind[kind],
    curriculum: MSK,
  };
}

/** "Costal cart of 8th.rib.r", "Costal cart of 3rd rib.r" */
function costalCartilage(name) {
  const n = side(name);
  const m = n.match(/^costal\s*cart(?:ilage)?\s+of\s+(\w+)[.\s]+rib$/i);
  if (!m) return null;
  const ordinal = m[1].toLowerCase();
  const digit = ORDINAL_DIGIT[ordinal] ?? parseInt(ordinal, 10);
  if (!digit) return null;

  const kind =
    digit <= 7
      ? "reaches the sternum directly, making this a true (vertebrosternal) rib"
      : digit <= 10
        ? "joins the cartilage of the rib above rather than the sternum, making this a false (vertebrochondral) rib and part of the costal margin"
        : "ends free in the abdominal wall, making this a floating rib";

  return {
    id: slug(`costal-cartilage-${digit}`),
    en: `Costal cartilage of the ${digit}${
      digit === 1 ? "st" : digit === 2 ? "nd" : digit === 3 ? "rd" : "th"
    } rib`,
    ta2: "Cartilago costalis",
    layer: "cartilage",
    plain: `The springy bar of cartilage on the front end of this rib. Costal cartilages are what let the chest expand when you breathe in.`,
    detail: `Hyaline cartilage. This one ${kind}.`,
    clinical:
      "Costal cartilages calcify and ossify with age, stiffening the chest wall and reducing the elasticity of breathing in older people.",
    curriculum: MSK,
  };
}

/** "Medial cuneiform bone.r", "Lunate.r", "Trapezoid.r" */
const SMALL_BONES = {
  "medial cuneiform": "The largest of the three wedge-shaped tarsal bones, taking the tendon of tibialis anterior and articulating with the 1st metatarsal.",
  "intermediate cuneiform": "The smallest cuneiform, set back between its neighbours so the 2nd metatarsal is locked in — the keystone of the transverse arch.",
  "lateral cuneiform": "The middle-sized cuneiform, articulating with the cuboid laterally and the 3rd metatarsal in front.",
  lunate: "The moon-shaped carpal bone of the proximal row, sitting directly under the radius. The most commonly dislocated carpal bone.",
  scaphoid: "The boat-shaped carpal bone on the thumb side, bridging both carpal rows. The most commonly fractured carpal bone.",
  triquetrum: "The three-cornered carpal bone on the little-finger side of the proximal row.",
  pisiform: "A pea-sized sesamoid bone sitting on the front of the triquetrum, within the tendon of flexor carpi ulnaris.",
  trapezium: "The distal-row carpal bone at the thumb base, whose saddle joint allows opposition.",
  trapezoid: "The smallest bone of the distal carpal row, wedged at the base of the index finger.",
  capitate: "The largest carpal bone, at the centre of the wrist, and the first to ossify.",
  hamate: "The wedge-shaped carpal bone on the little-finger side, carrying a hook on its palmar surface.",
  talus: "The bone linking leg to foot. No muscle attaches to it, and its blood supply enters distally.",
  calcaneus: "The heel bone and largest bone of the foot, receiving the calcaneal tendon.",
  navicular: "The boat-shaped tarsal bone on the inner foot, whose tuberosity takes tibialis posterior.",
  cuboid: "The cube-shaped tarsal bone on the outer foot, grooved beneath for the fibularis longus tendon.",
};

function smallBone(name) {
  const n = side(name).replace(/\s+bone$/i, "").toLowerCase();
  const detail = SMALL_BONES[n];
  if (!detail) return null;
  return {
    id: slug(`bone-${n}`),
    en: n.replace(/^\w/, (c) => c.toUpperCase()),
    layer: "bone",
    plain: `A small bone of the ${/cuneiform|talus|calcaneus|navicular|cuboid/.test(n) ? "foot" : "wrist"}.`,
    detail,
    curriculum: MSK,
  };
}

/**
 * Carpal, tarsal and metacarpal ligaments: "Dorsal cuneonavicular ligaments",
 * "Palmar lunotriquetral ligament", "Deep transverse metacarpal ligament".
 */
function regionalLigament(name) {
  const n = side(name);
  const m = n.match(
    /^(dorsal|palmar|plantar|deep transverse|superficial transverse)\s+(.+?)\s+ligaments?$/i
  );
  if (!m) return null;
  const plane = m[1].toLowerCase();
  const between = m[2].toLowerCase().replace(/\s+interosseus|\s+interosseous/i, "");
  const isFoot = /tarso|cuneo|cuboid|navicul|metatarsal|calcaneo|talo/.test(between);
  const surface =
    plane === "dorsal"
      ? isFoot
        ? "the top of the foot"
        : "the back of the hand"
      : plane === "plantar"
        ? "the sole"
        : plane === "palmar"
          ? "the palm"
          : isFoot
            ? "the forefoot"
            : "the palm";

  return {
    id: slug(`ligament-${plane}-${between}`),
    en: `${plane[0].toUpperCase()}${plane.slice(1)} ${between} ligament`,
    // No TA2 stub: a bare "Ligamentum" under the title is noise, not a Latin term.
    layer: "ligament",
    plain: `A short strong band on ${surface}, tying neighbouring bones directly to one another.`,
    detail:
      "One of the short intrinsic ligaments binding neighbouring bones of the hand or foot. Individually small, but together they make the row behave as a single unit and hold the arches in shape.",
    clinical:
      plane === "deep transverse"
        ? "The deep transverse ligaments hold the metacarpal or metatarsal heads together — which is why the digits cannot be spread apart at that level."
        : "These short ligaments are what stop the small bones splaying under load; their failure produces the collapse seen in arch and carpal instability.",
    curriculum: { ncism: ["AyUG-RS-P1-M06", "AyUG-RS-P1-M11"] },
  };
}

/** "Nucleus pulposus", "Nucleus pulposus T1-L1" */
function nucleusPulposus(name) {
  const n = side(name);
  if (!/^nucleus\s+pulposus/i.test(n)) return null;
  const levels = n.replace(/^nucleus\s+pulposus\s*/i, "").trim();

  return {
    id: slug(`nucleus-pulposus${levels ? "-" + levels : ""}`),
    en: `Nucleus pulposus${levels ? ` (${levels})` : ""}`,
    ta2: "Nucleus pulposus",
    layer: "cartilage",
    plain:
      "The soft gel at the centre of an intervertebral disc. It behaves like a water cushion, spreading load evenly across the vertebra below.",
    detail:
      "A remnant of the embryonic notochord, about 80 per cent water in youth. It is held under pressure by the anulus fibrosus around it, and dries out with age, which is why we lose height through the day and over a lifetime.",
    clinical:
      "If the anulus tears, the nucleus can herniate — usually posterolaterally, where the posterior longitudinal ligament is narrowest — and press on the nerve root, causing sciatica.",
    curriculum: { ncism: ["AyUG-RS-P1-M05", "AyUG-RS-P1-M11"] },
  };
}

/**
 * Named muscles, as data.
 *
 * A muscle cannot be described from its name alone — origin, insertion, nerve and
 * action are facts, not patterns. So they are recorded here as facts, and the
 * handler only does the formatting. Compact enough to review at a glance, which
 * is exactly what makes it checkable.
 *
 * [plain-language action, origin, insertion, nerve, clinical note?]
 */
const MUSCLE_FACTS = {
  "extensor digitorum": [
    "straightens the four fingers",
    "the common extensor origin on the lateral epicondyle",
    "the extensor expansions of the four fingers",
    "posterior interosseous nerve",
    "Its tendons are connected on the back of the hand by intertendinous bands, which is why the ring finger cannot be extended fully on its own.",
  ],
  "extensor digitorum longus": [
    "lifts the four lesser toes and helps turn the foot up",
    "the lateral condyle of the tibia and the upper fibula",
    "the extensor expansions of the lateral four toes",
    "deep fibular nerve",
  ],
  "flexor digitorum longus": [
    "curls the four lesser toes and helps point the foot down",
    "the posterior surface of the tibia below the soleal line",
    "the bases of the distal phalanges of the lateral four toes",
    "tibial nerve",
    "Its tendon crosses that of flexor hallucis longus in the sole at the 'knot of Henry'.",
  ],
  "flexor pollicis longus": [
    "bends the last joint of the thumb",
    "the anterior surface of the radius and the interosseous membrane",
    "the base of the distal phalanx of the thumb",
    "anterior interosseous branch of the median nerve",
    "The only muscle that can flex the thumb's interphalangeal joint — which is why that joint flexes to compensate in Froment's sign.",
  ],
  "fibularis longus": [
    "turns the sole outwards and points the foot down",
    "the head and upper lateral shaft of the fibula",
    "the base of the 1st metatarsal and the medial cuneiform, crossing the sole",
    "superficial fibular nerve",
    "Because its tendon crosses the sole, it is a key support of the transverse arch.",
  ],
  "fibularis brevis": [
    "turns the sole outwards",
    "the lower lateral shaft of the fibula",
    "the tuberosity at the base of the 5th metatarsal",
    "superficial fibular nerve",
    "A sudden inversion can avulse that tuberosity — the commonest fracture of the midfoot.",
  ],
  "palmaris longus": [
    "tenses the palmar skin and helps bend the wrist",
    "the medial epicondyle by the common flexor origin",
    "the flexor retinaculum and palmar aponeurosis",
    "median nerve",
    "Absent in about 15 per cent of people, and expendable — which makes it the standard donor tendon for grafting.",
  ],
  pectineus: [
    "pulls the thigh inwards and forwards",
    "the pecten of the pubis",
    "the pectineal line of the femur",
    "femoral nerve, sometimes with the obturator",
    "Forms part of the floor of the femoral triangle.",
  ],
  quadratus_femoris: [
    "turns the thigh outwards",
    "the lateral border of the ischial tuberosity",
    "the quadrate tubercle of the femur",
    "nerve to quadratus femoris",
  ],
  "quadratus plantae": [
    "corrects the pull of the long toe flexor so the toes bend straight",
    "the plantar surface of the calcaneus",
    "the tendon of flexor digitorum longus",
    "lateral plantar nerve",
  ],
  "abductor hallucis": [
    "pulls the great toe away from the others",
    "the medial tubercle of the calcaneus",
    "the medial base of the proximal phalanx of the great toe",
    "medial plantar nerve",
    "Forms the medial wall of the tarsal tunnel; its hypertrophy can compress the tibial nerve there.",
  ],
  "flexor digitorum brevis": [
    "curls the middle joints of the four lesser toes",
    "the medial tubercle of the calcaneus and the plantar aponeurosis",
    "the middle phalanges of the lateral four toes",
    "medial plantar nerve",
  ],
  "extensor hallucis longus": [
    "lifts the great toe and helps turn the foot up",
    "the middle fibula and interosseous membrane",
    "the base of the distal phalanx of the great toe",
    "deep fibular nerve",
    "Its power against resistance is the standard bedside test of the L5 root.",
  ],
  "extensor carpi ulnaris": [
    "cocks the wrist back and tilts it towards the little finger",
    "the lateral epicondyle and the posterior ulna",
    "the base of the 5th metacarpal",
    "posterior interosseous nerve",
  ],
  "abductor digiti minimi": [
    "spreads the little finger away from the others",
    "the pisiform and the tendon of flexor carpi ulnaris",
    "the medial base of the proximal phalanx of the little finger",
    "deep branch of the ulnar nerve",
  ],
  "opponens pollicis": [
    "swings the thumb across the palm to meet the other fingers",
    "the flexor retinaculum and the tubercle of the trapezium",
    "the whole lateral border of the 1st metacarpal",
    "recurrent branch of the median nerve",
    "Opposition is the movement lost first and most obviously in carpal tunnel syndrome.",
  ],
  "pronator quadratus": [
    "turns the palm downwards",
    "the lower quarter of the anterior ulna",
    "the lower quarter of the anterior radius",
    "anterior interosseous branch of the median nerve",
    "The deepest muscle of the front of the forearm, and the primary pronator in unresisted movement.",
  ],
  "extensor pollicis longus": [
    "straightens the last joint of the thumb and pulls it backwards",
    "the posterior ulna and interosseous membrane",
    "the base of the distal phalanx of the thumb",
    "posterior interosseous nerve",
    "Its tendon hooks round the dorsal tubercle of the radius, and can rupture there after a Colles fracture.",
  ],
  "extensor pollicis brevis": [
    "straightens the first joint of the thumb",
    "the posterior radius and interosseous membrane",
    "the base of the proximal phalanx of the thumb",
    "posterior interosseous nerve",
    "With abductor pollicis longus it forms the front border of the anatomical snuffbox, and shares the sheath inflamed in de Quervain's tenosynovitis.",
  ],
  "flexor digiti minimi brevis": [
    "bends the knuckle of the little finger",
    "the hook of the hamate and the flexor retinaculum",
    "the base of the proximal phalanx of the little finger",
    "deep branch of the ulnar nerve",
  ],
  "opponens digiti minimi": [
    "cups the palm by drawing the little finger forwards",
    "the hook of the hamate and the flexor retinaculum",
    "the medial border of the 5th metacarpal",
    "deep branch of the ulnar nerve",
  ],
  plantaris: [
    "assists the calf weakly in pointing the foot down",
    "the lateral supracondylar line of the femur",
    "the calcaneal tendon or the calcaneus",
    "tibial nerve",
    "A long thin tendon, absent in about a tenth of people, and often harvested for grafting.",
  ],
  "extensor digitorum brevis": [
    "helps lift the toes, from within the foot itself",
    "the upper lateral surface of the calcaneus",
    "the extensor expansions of the medial four toes",
    "deep fibular nerve",
    "Its fleshy belly on the outer side of the foot is often mistaken for swelling.",
  ],
  articularis_genus: [
    "pulls the knee's suprapatellar bursa upwards so it is not pinched",
    "the lower anterior femur",
    "the suprapatellar bursa",
    "femoral nerve",
  ],
};

function namedMuscle(name) {
  const key = normalisedMeshName(side(name)).toLowerCase().replace(/\s+/g, " ").trim();
  const facts = MUSCLE_FACTS[key] ?? MUSCLE_FACTS[key.replace(/\s/g, "_")];
  if (!facts) return null;
  const [action, origin, insertion, nerve, clinical] = facts;

  const title = key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return {
    id: slug(`muscle-${key}`),
    en: title,
    // Latin names are recorded only where they are actually known, not stubbed.
    layer: "muscle",
    plain: `A muscle that ${action}.`,
    detail: `From ${origin} to ${insertion}. Supplied by the ${nerve}.`,
    clinical,
    curriculum: MUSCLE_CURRICULUM,
  };
}

const HANDLERS = [
  phalanx,
  metaBone,
  costalJoint,
  costalCartilage,
  namedMuscle,
  articularCartilage,
  interosseous,
  lumbrical,
  anulusFibrosus,
  nucleusPulposus,
  namedVertebra,
  smallBone,
  regionalLigament,
];

// ---------------------------------------------------------------------------

const meshIndex = JSON.parse(await readFile(join(ROOT, "data", "mesh-index.json"), "utf8"));

/*
 * Hand-written content always wins.
 *
 * A generated entry for "1st metacarpal bone" would otherwise sit alongside the
 * hand-written one that explains Bennett's fracture — two structures claiming the
 * same mesh, and the reader getting whichever the index happened to key first.
 * Skipping anything already covered keeps the specific, better-written entry and
 * leaves the generator to fill only genuine gaps.
 */
const { readdir } = await import("node:fs/promises");
const contentDir = join(ROOT, "data", "structures");
const handWritten = (await readdir(contentDir)).filter(
  (f) => f.endsWith(".json") && f !== "generated.json"
);

const alreadyCovered = new Set();
const takenIds = new Set();
for (const file of handWritten) {
  for (const entry of JSON.parse(await readFile(join(contentDir, file), "utf8"))) {
    takenIds.add(entry.id);
    for (const raw of entry.meshNames) {
      alreadyCovered.add(canonicalMeshName(raw));
      alreadyCovered.add(canonicalMeshName(sidelessMeshName(raw)));
      alreadyCovered.add(canonicalMeshName(normalisedMeshName(raw)));
    }
  }
}

const isCovered = (raw) =>
  alreadyCovered.has(canonicalMeshName(raw)) ||
  alreadyCovered.has(canonicalMeshName(sidelessMeshName(raw))) ||
  alreadyCovered.has(canonicalMeshName(normalisedMeshName(raw)));

/** id -> entry, collecting every mesh name that maps to it. */
const generated = new Map();
const byHandler = {};

for (const [model, groups] of Object.entries(meshIndex)) {
  for (const [group, names] of Object.entries(groups)) {
    for (const name of names) {
      if (layerForMesh(name, group) === "other") continue;
      if (isCovered(name)) continue;
      for (const handler of HANDLERS) {
        const result = handler(name);
        if (!result) continue;
        // Never shadow a hand-written id either.
        if (takenIds.has(result.id)) continue;
        byHandler[handler.name] = (byHandler[handler.name] ?? 0) + 1;

        const existing = generated.get(result.id);
        if (existing) {
          if (!existing.meshNames.includes(name)) existing.meshNames.push(name);
          if (!existing.__models.includes(model)) existing.__models.push(model);
        } else {
          generated.set(result.id, {
            ...result,
            meshNames: [name],
            region: model,
            __models: [model],
          });
        }
        break;
      }
    }
  }
}

const entries = [...generated.values()]
  .map(({ __models, clinical, ...rest }) => ({
    ...rest,
    ...(clinical ? { clinical } : {}),
    meshNames: rest.meshNames.sort(),
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

await writeFile(OUT, JSON.stringify(entries, null, 2) + "\n");

console.log(`Generated ${entries.length} structures covering ${
  entries.reduce((n, e) => n + e.meshNames.length, 0)
} mesh names.\n`);
for (const [handler, n] of Object.entries(byHandler).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${handler.padEnd(20)} ${n} matches`);
}
console.log(`\n-> data/structures/generated.json`);
