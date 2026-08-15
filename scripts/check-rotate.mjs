/**
 * Does dragging actually rotate the model, and can it be turned all the way round?
 *
 * Measured from screenshots: rotate by a known amount, and compare the rendered
 * silhouette. If drag is being swallowed (by a pointer handler, a CSS layer, or
 * controls that never attached) the image is byte-identical and the numbers below
 * do not move at all.
 *
 *   node scripts/check-rotate.mjs [region]
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

  await page.goto(`${BASE}/explore/${REGION}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => Number(document.querySelector("[data-viewer]")?.getAttribute("data-structure-count") ?? 0) > 0,
    { timeout: 180_000 }
  );
  await page.waitForTimeout(3500);

  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  const shot = async (label) => {
    const { buf } = await canvasShot(page);
    await writeFile(join(OUT, `rotate-${label}.png`), buf);
    return analyse(buf);
  };

  const drag = async (dx, dy) => {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    // Several small steps: OrbitControls tracks pointermove deltas, so one jump
    // can be ignored entirely.
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(cx + (dx * i) / 12, cy + (dy * i) / 12);
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
    await page.waitForTimeout(2500);
  };

  const start = await shot("0");
  console.log(`start      lit ${String(start.litPct).padStart(5)}%  centroid ${start.cx},${start.cy}  width ${start.maxX - start.minX}`);

  const angles = [];
  for (let step = 1; step <= 4; step++) {
    // ~90 degrees per drag at default rotateSpeed on a canvas this wide.
    await drag(box.width * 0.45, 0);
    const m = await shot(String(step));
    angles.push(m);
    console.log(
      `after ${step * 90}deg lit ${String(m.litPct).padStart(5)}%  centroid ${m.cx},${m.cy}  width ${m.maxX - m.minX}`
    );
  }

  // Vertical drag: can the student look from above and below?
  await drag(0, -box.height * 0.35);
  const up = await shot("up");
  console.log(`tilt up    lit ${String(up.litPct).padStart(5)}%  centroid ${up.cx},${up.cy}`);

  await browser.close();

  const changed = angles.filter(
    (m) => Math.abs(m.litPct - start.litPct) > 0.5 || Math.abs(m.cx - start.cx) > 4
  ).length;

  console.log("");
  if (changed === 0) {
    console.error("FAIL — the render never changed. Drag is not reaching OrbitControls.");
    process.exit(1);
  }
  console.log(`Rotation works: ${changed} of ${angles.length} drags changed the view.`);
  console.log(`Screenshots: .visual/rotate-0.png … rotate-4.png, rotate-up.png`);
}

main();

