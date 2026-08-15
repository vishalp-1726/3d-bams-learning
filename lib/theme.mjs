/**
 * Visual constants shared between the app and the verification scripts.
 *
 * The canvas background lives here rather than being typed into both the R3F
 * scene and scripts/pixels.mjs — the coverage check works by counting pixels that
 * differ from the background, so if the two ever drifted apart the check would
 * silently report 100% coverage on an empty canvas.
 */

/**
 * Viewer background. A soft blue-grey rather than white: the models' bones are
 * ivory, and on a pure white page they lose their edges entirely.
 */
export const CANVAS_BG = "#dbe3ec";

/**
 * Highlight for the selected structure.
 *
 * Emissive light ADDS to the surface colour, so on ivory bone a pale accent just
 * washes out. A saturated cyan is the one hue that stays distinct against all
 * three dominant model colours — ivory bone, red muscle and blue vein.
 */
export const SELECTION_COLOR = "#00b3d7";
/** Softer tint for hover. */
export const HOVER_COLOR = "#7fdcee";

/** Emissive strengths, tuned against a light background. */
export const SELECTION_INTENSITY = 0.95;
export const HOVER_INTENSITY = 0.45;
