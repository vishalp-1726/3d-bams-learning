/**
 * How expensive is a drag?
 *
 * R3F raycasts the whole scene on every pointermove to work out what is under the
 * cursor. With ~340 meshes — or ~700 once the mirror doubles them — that is a lot
 * of CPU per event, and it competes with the render. On integrated graphics the
 * result is a viewer that responds to a drag a fraction of a second late, which
 * feels exactly like "I cannot rotate it".
 *
 * This measures frames actually produced while dragging, plus draw calls.
 */

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const REGION = process.argv[2] ?? "insertions-and-origins";

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultNavigationTimeout(180_000);

await page.goto(`${BASE}/explore/${REGION}`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(
  () => Number(document.querySelector("[data-viewer]")?.getAttribute("data-structure-count") ?? 0) > 0,
  { timeout: 180_000 }
);
await page.waitForTimeout(4000);

const sceneStats = () =>
  page.evaluate(() => {
    const anat = window.__anat;
    if (!anat) return { error: "no debug handle" };
    let meshes = 0;
    let visible = 0;
    let triangles = 0;
    // Walk the whole scene, so the mirrored half is counted too.
    const scene = anat.root.parent ?? anat.root;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      if (o.visible) {
        visible++;
        const g = o.geometry;
        triangles += g?.index ? g.index.count / 3 : (g?.attributes?.position?.count ?? 0) / 3;
      }
    });
    return { meshes, visible, triangles: Math.round(triangles) };
  });

/** Frames rendered during a horizontal drag of the given duration. */
const dragFps = async (ms = 2000) => {
  const box = await page.locator("canvas").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.evaluate(() => {
    window.__frames = 0;
    const tick = () => {
      window.__frames++;
      window.__raf = requestAnimationFrame(tick);
    };
    window.__raf = requestAnimationFrame(tick);
  });

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx + (300 * i) / steps, cy + Math.sin(i / 4) * 20);
    await page.waitForTimeout(ms / steps);
  }
  await page.mouse.up();

  return page.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    return window.__frames;
  });
};

console.log(`region: ${REGION}`);
console.log(`half body : ${JSON.stringify(await sceneStats())}`);
const fpsHalf = await dragFps();
console.log(`   frames during a 2s drag: ${fpsHalf}  (~${(fpsHalf / 2).toFixed(1)} fps)`);

await page.getByRole("button", { name: /^Whole body$/i }).click();
await page.waitForTimeout(6000);

console.log(`\nwhole body: ${JSON.stringify(await sceneStats())}`);
const fpsFull = await dragFps();
console.log(`   frames during a 2s drag: ${fpsFull}  (~${(fpsFull / 2).toFixed(1)} fps)`);

console.log(
  `\nmirroring changed drag frame rate by ${(((fpsFull - fpsHalf) / fpsHalf) * 100).toFixed(0)}%`
);
console.log(
  "(software rendering here, so absolute numbers are pessimistic — the RATIO is the signal.)"
);

await browser.close();

