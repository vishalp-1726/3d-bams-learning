/**
 * Why can't the user rotate?
 *
 * Earlier checks measured the RENDERED IMAGE and concluded rotation worked. That
 * is indirect. This reads OrbitControls' own state — azimuth and polar angle —
 * and dispatches real PointerEvents, which is what a browser actually sends and
 * what OrbitControls actually listens for. Playwright's page.mouse emits mouse
 * events, so a control that only handles pointer events could look fine there and
 * be dead in a real browser.
 *
 *   node scripts/diagnose-controls.mjs [region]
 */

import { chromium } from "playwright";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const REGION = process.argv[2] ?? "overview-skeleton";

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultNavigationTimeout(180_000);

const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text().slice(0, 200)}`));
page.on("pageerror", (e) => logs.push(`PAGEERROR: ${e.message.slice(0, 300)}`));

await page.goto(`${BASE}/explore/${REGION}`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(
  () => Number(document.querySelector("[data-viewer]")?.getAttribute("data-structure-count") ?? 0) > 0,
  { timeout: 180_000 }
);
await page.waitForTimeout(4000);

// What is layered over the canvas, and does anything swallow pointer events?
const overlay = await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  const r = canvas.getBoundingClientRect();
  const cx = Math.round(r.left + r.width / 2);
  const cy = Math.round(r.top + r.height / 2);
  const stack = document.elementsFromPoint(cx, cy).slice(0, 6).map((el) => {
    const cs = getComputedStyle(el);
    return `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""} pe=${cs.pointerEvents}`;
  });
  return { cx, cy, canvasRect: { w: Math.round(r.width), h: Math.round(r.height) }, stack };
});
console.log(`canvas ${overlay.canvasRect.w}x${overlay.canvasRect.h}, centre (${overlay.cx},${overlay.cy})`);
console.log("element stack at centre (topmost first):");
for (const s of overlay.stack) console.log(`   ${s}`);

// Read OrbitControls' own angles via the R3F store attached to the canvas.
const readAngles = () =>
  page.evaluate(() => {
    const anat = window.__anat;
    if (!anat) return { error: "window.__anat missing — viewer did not mount" };
    const c = anat.controls;
    if (!c) return { error: "controls is null — OrbitControls never registered" };
    return {
      azimuth: +c.getAzimuthalAngle().toFixed(4),
      polar: +c.getPolarAngle().toFixed(4),
      distance: +anat.camera.position.distanceTo(c.target).toFixed(4),
      target: [c.target.x, c.target.y, c.target.z].map((n) => +n.toFixed(4)),
      camera: [anat.camera.position.x, anat.camera.position.y, anat.camera.position.z].map(
        (n) => +n.toFixed(4)
      ),
      enabled: c.enabled,
      enableRotate: c.enableRotate,
      domElement: c.domElement?.tagName ?? null,
    };
  });

// Reproduce the user's state: mirror ON. That is what their screenshot shows, and
// it is the case the earlier checks never exercised with real pointer events.
if (process.argv.includes("--mirror")) {
  await page.getByRole("button", { name: /^Whole body$/i }).click();
  await page.waitForTimeout(5000);
  console.log("\n[mirror switched ON]");
}

const before = await readAngles();
console.log(`\nbefore: ${JSON.stringify(before)}`);
if (before.error) {
  console.error("\nFAILED — cannot reach OrbitControls.");
  await browser.close();
  process.exit(1);
}

// Dispatch REAL PointerEvents on the element OrbitControls bound to.
await page.evaluate(({ cx, cy }) => {
  const canvas = document.querySelector("canvas");
  const opts = (x, y, extra = {}) => ({
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: x,
    clientY: y,
    ...extra,
  });
  canvas.dispatchEvent(new PointerEvent("pointerdown", opts(cx, cy)));
  for (let i = 1; i <= 20; i++) {
    const x = cx + i * 12;
    // OrbitControls listens for pointermove on the owner document once dragging.
    canvas.ownerDocument.dispatchEvent(new PointerEvent("pointermove", opts(x, cy)));
  }
  canvas.ownerDocument.dispatchEvent(
    new PointerEvent("pointerup", opts(cx + 240, cy, { buttons: 0 }))
  );
}, overlay);

await page.waitForTimeout(1500);
const after = await readAngles();
console.log(`after : ${JSON.stringify(after)}`);

const dAz = Math.abs(after.azimuth - before.azimuth);
console.log(`\nazimuth changed by ${dAz.toFixed(4)} rad (${((dAz * 180) / Math.PI).toFixed(1)}deg)`);

if (logs.length) {
  console.log("\nconsole:");
  for (const l of [...new Set(logs)].slice(0, 8)) console.log(`   ${l}`);
}

await browser.close();

if (dAz < 0.05) {
  console.error("\nFAILED — real pointer events do NOT rotate the camera.");
  process.exit(1);
}
console.log("\nOK — real pointer events rotate the camera.");

