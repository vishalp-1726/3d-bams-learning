/**
 * Verify two UI behaviours that cannot be checked statically:
 *
 *  1. The Next.js dev-tools badge is gone in `next dev` (devIndicators: false).
 *  2. Scroll-zoom moves towards the pointer, not the centre of the model
 *     (OrbitControls zoomToCursor).
 *
 * Both are measured from real screenshots of the canvas — see scripts/pixels.mjs
 * for why reading the WebGL canvas in-page does not work.
 *
 *   npm run dev
 *   node scripts/check-zoom.mjs
 */

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyse } from "./pixels.mjs";
import { canvasShot } from "./canvas-shot.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".visual");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultNavigationTimeout(180_000);

  await page.goto(`${BASE}/explore/zone-knee`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => Number(document.querySelector("[data-viewer]")?.getAttribute("data-structure-count") ?? 0) > 0,
    { timeout: 180_000 }
  );
  await page.waitForTimeout(3000);

  // ---- 1. dev-tools badge -------------------------------------------------
  // The <nextjs-portal> element hosts the whole dev overlay and exists even with
  // the badge disabled, so look for the button inside its shadow root.
  const badge = await page.evaluate(() => {
    const portals = [...document.querySelectorAll("nextjs-portal")];
    for (const p of portals) {
      const root = p.shadowRoot;
      if (!root) continue;
      if (root.querySelector("[data-nextjs-dev-tools-button], #nextjs-dev-tools-menu")) {
        return true;
      }
    }
    return false;
  });
  console.log(`dev-tools badge visible: ${badge}  ${badge ? "(still there)" : "(removed)"}`);

  const canvas = page.locator("canvas");

  // ---- 2. zoom towards cursor --------------------------------------------
  // Overlays hidden, so the silhouette measured is the model's own.
  const { buf: beforeBuf } = await canvasShot(page);
  await writeFile(join(OUT, "zoom-before.png"), beforeBuf);
  const before = await analyse(beforeBuf);

  const box = await canvas.boundingBox();
  // Aim at the lower-left quadrant, well away from the centre.
  const targetX = box.x + box.width * 0.42;
  const targetY = box.y + box.height * 0.72;
  await page.mouse.move(targetX, targetY);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3000);

  const { buf: afterBuf } = await canvasShot(page);
  await writeFile(join(OUT, "zoom-after.png"), afterBuf);
  const after = await analyse(afterBuf);

  const scale = before.width / box.width;
  const cursor = {
    x: Math.round((targetX - box.x) * scale),
    y: Math.round((targetY - box.y) * scale),
  };

  console.log(`\ncanvas ${before.width}x${before.height} device px, cursor at ${cursor.x},${cursor.y}`);
  console.log(`before  lit ${String(before.litPct).padStart(5)}%  centroid ${before.cx},${before.cy}  bbox x[${before.minX}..${before.maxX}]`);
  console.log(`after   lit ${String(after.litPct).padStart(5)}%  centroid ${after.cx},${after.cy}  bbox x[${after.minX}..${after.maxX}]`);

  const zoomed = after.litPct > before.litPct * 1.15;
  console.log(`\nzoom happened: ${zoomed}  (coverage ${before.litPct}% -> ${after.litPct}%)`);

  /*
   * Distinguishing cursor-zoom from centre-zoom — CALIBRATED, not reasoned.
   *
   * The obvious argument ("zooming about the cursor scales all distances from the
   * cursor equally") is a 2D one, and it is wrong here: OrbitControls implements
   * zoomToCursor by moving the camera along the ray through the pointer, which is
   * a dolly through a scene with depth, not a flat scale.
   *
   * So the threshold below comes from measuring the app both ways rather than
   * from theory:
   *
   *     zoomToCursor off -> left x1.29, right x1.26   mismatch  2%
   *     zoomToCursor on  -> left x1.09, right x1.32   mismatch 17%
   *
   * With it on, the edge NEARER the pointer grows far less, because the geometry
   * under the pointer stays put while the rest expands past it. A mismatch is
   * therefore the signature of cursor-zoom, and near-equal growth means the zoom
   * is centred on the view instead.
   */
  if (zoomed && before.minX !== null && after.minX !== null) {
    const leftBefore = cursor.x - before.minX;
    const rightBefore = before.maxX - cursor.x;
    const leftAfter = cursor.x - after.minX;
    const rightAfter = after.maxX - cursor.x;

    const leftRatio = leftAfter / leftBefore;
    const rightRatio = rightAfter / rightBefore;
    const skew = Math.abs(leftRatio - rightRatio) / Math.max(leftRatio, rightRatio);

    console.log(
      `\ngap to left edge  ${leftBefore.toFixed(0)} -> ${leftAfter.toFixed(0)} px  (x${leftRatio.toFixed(2)})`
    );
    console.log(
      `gap to right edge ${rightBefore.toFixed(0)} -> ${rightAfter.toFixed(0)} px  (x${rightRatio.toFixed(2)})`
    );
    console.log(`ratio mismatch: ${(skew * 100).toFixed(0)}%`);

    const active = skew > 0.08; // measured: 2% when off, 17% when on
    console.log(
      active
        ? `=> the edge nearer the pointer grew much less, so the geometry under the\n` +
            `   pointer stayed put. zoomToCursor is working.`
        : `=> both edges grew by the same factor, so the zoom is centred on the view.\n` +
            `   zoomToCursor is NOT taking effect.`
    );
    if (!active) {
      console.error("\nFAILED — zoom is not following the cursor.");
      await browser.close();
      process.exit(1);
    }
  }

  await browser.close();
  console.log(`\nScreenshots: .visual/zoom-before.png, .visual/zoom-after.png`);
}

main();

