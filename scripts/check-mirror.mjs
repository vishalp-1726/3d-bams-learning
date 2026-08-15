/**
 * Verify the whole-body mirror, and that rotation stays centred after zooming.
 *
 *  1. Mirroring should widen the silhouette roughly symmetrically about the
 *     midline and increase coverage — without simply drawing the same half twice
 *     in the same place.
 *  2. After zooming at an off-centre point (which moves the orbit target), a
 *     drag must still turn the model rather than swing it out of frame.
 *
 *   npm run dev  (or npm start)
 *   node scripts/check-mirror.mjs [region]
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
const REGION = process.argv[2] ?? "overview-skeleton";

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.setDefaultNavigationTimeout(180_000);
  page.setDefaultTimeout(90_000);

  await page.goto(`${BASE}/explore/${REGION}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => Number(document.querySelector("[data-viewer]")?.getAttribute("data-structure-count") ?? 0) > 0,
    { timeout: 180_000 }
  );
  await page.waitForTimeout(4000);

  const canvas = page.locator("canvas");
  // Hides the on-canvas view controls first, so measurements are of the model
  // alone rather than of the UI drawn over it.
  const shot = async (label) => {
    const { buf } = await canvasShot(page);
    await writeFile(join(OUT, `mirror-${label}.png`), buf);
    return analyse(buf);
  };

  const before = await shot("off");
  console.log(
    `half body   lit ${String(before.litPct).padStart(5)}%  x-span ${before.minX}..${before.maxX} (${before.maxX - before.minX}px)`
  );

  const button = page.getByRole("button", { name: /^Whole body$/i });
  await button.click();
  await page.waitForTimeout(5000);

  const after = await shot("on");
  console.log(
    `whole body  lit ${String(after.litPct).padStart(5)}%  x-span ${after.minX}..${after.maxX} (${after.maxX - after.minX}px)`
  );

  const widened = after.maxX - after.minX > (before.maxX - before.minX) * 1.15;
  const denser = after.litPct > before.litPct * 1.15;
  console.log(
    `\nmirror widened silhouette: ${widened}   coverage increased: ${denser}`
  );

  // A mirrored body should be centred on the canvas: the silhouette's midpoint
  // and its centroid should nearly coincide. A large gap means the camera is
  // still framed on one half.
  const silhouetteMid = (after.minX + after.maxX) / 2;
  const offset = Math.abs(after.cx - silhouetteMid);
  const width = after.maxX - after.minX;
  console.log(
    `symmetry: centroid ${after.cx} vs silhouette midpoint ${silhouetteMid} ` +
      `(off by ${offset}px of ${width}px width)`
  );

  // --- rotation WITH the mirror on ----------------------------------------
  const box0 = await canvas.boundingBox();
  const rotateBy = async (dx) => {
    const mx = box0.x + box0.width / 2;
    const my = box0.y + box0.height / 2;
    await page.mouse.move(mx, my);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(mx + (dx * i) / 12, my);
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
    await page.waitForTimeout(2500);
  };

  await rotateBy(box0.width * 0.45);
  const turned90 = await shot("on-90");
  await rotateBy(box0.width * 0.45);
  const turned180 = await shot("on-180");

  console.log(
    `\nmirrored, turned 90deg  lit ${String(turned90.litPct).padStart(5)}%  width ${turned90.maxX - turned90.minX}px`
  );
  console.log(
    `mirrored, turned 180deg lit ${String(turned180.litPct).padStart(5)}%  width ${turned180.maxX - turned180.minX}px`
  );
  const stayedFramed = turned90.litPct > 2 && turned180.litPct > 2;
  console.log(
    stayedFramed
      ? "=> stays framed while rotating with the mirror on."
      : "=> swung out of frame while rotating with the mirror on."
  );

  // --- rotation remains usable after a cursor-zoom -------------------------
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.3);
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(2500);
  const zoomed = await shot("zoomed");

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(cx + (box.width * 0.4 * i) / 12, cy);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  await page.waitForTimeout(3000);
  const rotated = await shot("zoomed-rotated");

  console.log(
    `\nafter zoom  lit ${String(zoomed.litPct).padStart(5)}%\n` +
      `then rotate lit ${String(rotated.litPct).padStart(5)}%`
  );
  const stillOnScreen = rotated.litPct > 2;
  console.log(
    stillOnScreen
      ? "=> model still framed after rotating post-zoom (orbit centre held on the model)."
      : "=> model swung off-screen after rotating post-zoom — orbit centre drifted."
  );

  await browser.close();

  if (!widened || !stillOnScreen || !stayedFramed) {
    console.error("\nFAILED");
    process.exit(1);
  }
  console.log("\nOK. Screenshots: .visual/mirror-*.png");
}

main();

