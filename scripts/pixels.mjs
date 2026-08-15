/**
 * Pixel analysis of a screenshot buffer.
 *
 * Deliberately NOT done by reading the WebGL canvas in-page. A WebGL context
 * without preserveDrawingBuffer is cleared once composited, so
 * `ctx2d.drawImage(webglCanvas)` yields fully transparent pixels — which then
 * read as "different from the background" and report 100% coverage no matter
 * what is on screen. Screenshotting the composited page and decoding it here is
 * the only measurement that actually reflects what a user sees.
 */

import sharp from "sharp";
import { CANVAS_BG } from "../lib/theme.mjs";

/** Background of the viewer, taken from the same constant the scene uses. */
const BG = [
  parseInt(CANVAS_BG.slice(1, 3), 16),
  parseInt(CANVAS_BG.slice(3, 5), 16),
  parseInt(CANVAS_BG.slice(5, 7), 16),
];
const TOLERANCE = 14;

/**
 * @returns {{litPct:number, cx:number|null, cy:number|null, width:number, height:number,
 *            minX:number, maxX:number, minY:number, maxY:number}}
 */
export async function analyse(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let lit = 0, sx = 0, sy = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (let i = 0; i < data.length; i += channels) {
    const isBg =
      Math.abs(data[i] - BG[0]) <= TOLERANCE &&
      Math.abs(data[i + 1] - BG[1]) <= TOLERANCE &&
      Math.abs(data[i + 2] - BG[2]) <= TOLERANCE;
    if (isBg) continue;

    const p = i / channels;
    const x = p % width;
    const y = (p - x) / width;
    lit++; sx += x; sy += y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const total = width * height;
  return {
    litPct: +((lit / total) * 100).toFixed(1),
    cx: lit ? Math.round(sx / lit) : null,
    cy: lit ? Math.round(sy / lit) : null,
    width,
    height,
    minX: lit ? minX : null,
    maxX: lit ? maxX : null,
    minY: lit ? minY : null,
    maxY: lit ? maxY : null,
  };
}
