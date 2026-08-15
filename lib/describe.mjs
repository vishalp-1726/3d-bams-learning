/**
 * A guaranteed description for every structure.
 *
 * Three tiers, best first:
 *
 *   specific  the structure has its own written entry
 *   parent    it is a named PART of a structure that does — "Sternocostal head of
 *             pectoralis major" resolves to pectoralis major, which is genuinely
 *             the right answer for that mesh
 *   general   nothing more specific exists, so describe what this kind of
 *             structure is, using its tissue layer
 *
 * The third tier exists because "a written explanation hasn't been added yet" is
 * a dead end for the reader. A short, accurate statement of what an artery or a
 * bursa is, attached to a correctly-named structure, is more use than nothing —
 * provided the interface is honest that it is general rather than specific, which
 * it is.
 */

/** What each tissue layer IS, in plain words. Accurate for every member. */
const LAYER_DESCRIPTIONS = {
  bone: {
    plain:
      "A bone — the rigid framework of the body. Bones carry weight, protect the organs behind them, and give muscles something to pull against.",
    detail:
      "Living tissue with its own blood supply and nerves, covered by periosteum except at the joint surfaces, and remodelled continuously throughout life.",
  },
  cartilage: {
    plain:
      "Cartilage — firm but flexible tissue. Where it caps a joint surface it lets bones glide almost without friction.",
    detail:
      "Avascular and without nerves, fed by diffusion. That is why cartilage heals poorly and why its loss is permanent.",
  },
  joint: {
    plain: "A joint — where two bones meet and movement happens.",
    detail:
      "A synovial joint has articular cartilage, a capsule lined with synovial membrane, and lubricating synovial fluid. Its stability comes from the shape of the bones, its ligaments, and the muscles crossing it.",
  },
  ligament: {
    plain:
      "A ligament — a tough band joining bone to bone. Ligaments hold joints together and stop them moving too far.",
    detail:
      "Dense fibrous tissue with a poor blood supply, which is why sprains are slow to heal. Ligaments also carry position sense, so injury affects joint proprioception as well as stability.",
  },
  muscle: {
    plain:
      "A muscle — it shortens to pull the bones it attaches to, producing movement.",
    detail:
      "Attached at an origin and an insertion, and supplied by a named nerve. A muscle can only pull, never push, which is why muscles work in opposing pairs.",
  },
  tendon: {
    plain: "A tendon — the cord that carries a muscle's pull onto the bone.",
    detail:
      "Dense collagen, very strong in tension. Where a tendon turns a corner or crosses a joint it usually runs in a synovial sheath to reduce friction.",
  },
  attachment: {
    plain:
      "A muscle attachment site — the patch of bone where a muscle takes origin or inserts.",
    detail:
      "Roughened where a strong tendon pulls, and smooth where the attachment is fleshy. These markings are how a bone's muscles can be identified from the dry specimen.",
  },
  nerve: {
    plain:
      "A nerve — it carries signals between the brain and spinal cord and the body, both instructions to muscles and sensation coming back.",
    detail:
      "A bundle of axons in connective tissue sheaths. Most named nerves are mixed, carrying motor, sensory and autonomic fibres together.",
  },
  artery: {
    plain:
      "An artery — it carries blood away from the heart to supply this region with oxygen.",
    detail:
      "Thick muscular walls that withstand pulse pressure. Arteries usually anastomose with their neighbours, so tissue often survives the loss of one of them.",
  },
  vein: {
    plain: "A vein — it carries blood back towards the heart.",
    detail:
      "Thinner-walled than arteries and often valved, which keeps blood moving one way. In the limbs, contracting muscles squeeze the deep veins and drive that return.",
  },
  bursa: {
    plain:
      "A bursa — a small fluid-filled sac that lets tendons and skin slide over bone without wearing.",
    detail:
      "Lined by synovial membrane. Bursae sit wherever tissues rub, and become painful when repeated pressure or friction inflames them.",
  },
  organ: {
    plain: "An organ — a structure of several tissues working together for one job.",
    detail: "",
  },
  landmark: {
    plain:
      "An anatomical region, canal or opening — a named space rather than a solid structure, defined by what bounds it and what passes through it.",
    detail: "",
  },
  unclassified: {
    plain: "A named anatomical structure in this region.",
    detail: "",
  },
  other: {
    plain:
      "Fascia or a surface overlay — connective tissue wrapping and separating the structures around it.",
    detail: "",
  },
};

export function describeLayer(layer) {
  return LAYER_DESCRIPTIONS[layer] ?? LAYER_DESCRIPTIONS.unclassified;
}
