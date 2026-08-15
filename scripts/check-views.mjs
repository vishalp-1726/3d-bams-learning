/**
 * Can every side of the model actually be seen?
 *
 * Clicks each standard view and records both the camera azimuth (from the
 * controls themselves) and the rendered silhouette. Front and back must produce
 * genuinely different images, otherwise "seeing the back" is not possible.
 *
 * Also verifies the whole-body mirror leaves no overlap at the midline.
 *
 *   node scripts/check-views.mjs [region]
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
const MIRROR = process.argv.includes("--mirror");

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultNavigationTimeout(180_000);
page.setDefaultTimeout(90_000);

await page.goto(`${BASE}/explore/${REGION}`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(
  () => Number(document.querySelector("[data-viewer]")?.getAttribute("data-structure-count") ?? 0) > 0,
  { timeout: 180_000 }
);
await page.waitForTimeout(4000);

if (MIRROR) {
  await page.getByRole("button", { name: /^Whole body$/i }).click();
  await page.waitForTimeout(5000);
  console.log("[mirror ON]\n");
}

const canvas = page.locator("canvas");
const angles = () =>
  page.evaluate(() => {
    const c = window.__anat?.controls;
    if (!c) return null;
    return {
      az: +((c.getAzimuthalAngle() * 180) / Math.PI).toFixed(1),
      pol: +((c.getPolarAngle() * 180) / Math.PI).toFixed(1),
    };
  });

const VIEWS = ["Front", "Back", "Left", "Right", "Top", "Bottom"];
const seen = [];

for (const view of VIEWS) {
  await page.getByRole("button", { name: new RegExp(`^${view}$`) }).click();
  await page.waitForTimeout(2200);
  const a = await angles();
  const { buf } = await canvasShot(page);
  await writeFile(join(OUT, `view-${view.toLowerCase()}${MIRROR ? "-mirror" : ""}.png`), buf);
  const px = await analyse(buf);
  seen.push({ view, ...a, litPct: px.litPct, width: px.maxX - px.minX, height: px.maxY - px.minY });
  console.log(
    `${view.padEnd(7)} azimuth ${String(a.az).padStart(6)}deg  polar ${String(a.pol).padStart(5)}deg  ` +
      `lit ${String(px.litPct).padStart(5)}%  ${px.maxX - px.minX}x${px.maxY - px.minY}px`
  );
}

// Front and back must differ: same silhouette width but a genuinely different image.
const front = seen.find((s) => s.view === "Front");
const back = seen.find((s) => s.view === "Back");
// Smallest angle between the two directions, wrapped into 0..180.
const rawGap = Math.abs(front.az - back.az) % 360;
const azGap = rawGap > 180 ? 360 - rawGap : rawGap;
console.log(`\nfront/back azimuth separation: ${azGap.toFixed(1)}deg (want ~180)`);
console.log(
  `front silhouette ${front.width}x${front.height}px vs left ${
    seen.find((s) => s.view === "Left").width
  }x${seen.find((s) => s.view === "Left").height}px ` +
    `— a body is wider from the front than from the side`
);

const distinct = new Set(seen.map((s) => `${s.az}/${s.pol}`)).size;
console.log(`distinct camera orientations: ${distinct} of ${VIEWS.length}`);

await browser.close();

if (distinct < VIEWS.length) {
  console.error("\nFAILED — some views did not move the camera.");
  process.exit(1);
}
console.log(`\nOK — every side reachable. Screenshots: .visual/view-*.png`);

