/**
 * End-to-end check that the viewer actually renders and that clicking a
 * structure resolves to the right teaching content.
 *
 * Everything else in this repo is verified headlessly against the GLB files.
 * This is the one check that answers "does the 3D actually paint, and does the
 * whole chain — geometry -> mesh name -> structures/*.json -> info panel —
 * work end to end".
 *
 * Runs its own Chromium so it does not depend on any window being open or
 * focused. A browser tab that is minimised reports visibilityState "hidden",
 * and Chrome then suspends requestAnimationFrame and ResizeObserver — which
 * means R3F never measures its container and never renders at all. Headless
 * Chromium always reports "visible", so this is reliable.
 *
 *   npm run check:visual                 # all checks
 *   npm run check:visual -- zone-knee    # one region
 *
 * Screenshots are written to .visual/ for eyeballing.
 */

import { chromium } from "playwright";
import { analyse } from "./pixels.mjs";
import { canvasShot } from "./canvas-shot.mjs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".visual");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOT_TIMEOUT = 180_000;

/** Each check searches for a structure and asserts the info panel names it. */
const CHECKS = [
  { region: "hand", search: "Scaphoid", expect: "Scaphoid" },
  { region: "zone-knee", search: "cruciate", expect: "cruciate ligament" },
  {
    region: "brachial-plexus-and-branches",
    search: "Superior trunk",
    expect: "Superior trunk",
  },
  { region: "overview-skull", search: "", expect: null },
  // Content authored against the hand model must also resolve here, where the
  // same bone is called "Scaphoid.r" rather than "Scaphoid".
  { region: "overview-skeleton", search: "Rib (8th)", expect: "Typical rib" },
  // Attachment patches are named after their muscle ("Iliacus origin and
  // insertion.r"); they must resolve to that muscle's entry, not dead-end.
  { region: "insertions-and-origins", search: "Iliacus", expect: "Iliacus" },
];

const ok = (b) => (b ? "ok  " : "FAIL");

async function checkRegion(page, { region, search, expect }) {
  const result = { region, problems: [] };
  const started = Date.now();

  await page.goto(`${BASE}/explore/${region}`, { waitUntil: "domcontentloaded" });

  // The left rail switches from "loading N MB…" to "N named structures" only
  // once the GLB has parsed and the scene graph has been published to the store.
  try {
    await page.waitForFunction(
      () => Number(document.querySelector("[data-viewer]")?.getAttribute("data-structure-count") ?? 0) > 0,
      { timeout: 120_000 }
    );
  } catch {
    result.problems.push("model never finished loading (no structure count appeared)");
    return result;
  }
  result.loadMs = Date.now() - started;

  const counts = await page.evaluate(() => {
    const text = document.body.innerText.match(/(\d+)\s+named structures/);
    const canvas = document.querySelector("canvas");
    // Split the wait into "fetching the file" vs "everything after".
    // Network is the part a real user's connection affects; the remainder is
    // CPU (Draco decode, scene build, shader compilation) and is heavily
    // inflated here by software rendering.
    const glb = performance
      .getEntriesByType("resource")
      .find((e) => e.name.endsWith(".glb"));
    return {
      structures: text ? Number(text[1]) : 0,
      canvas: canvas ? [canvas.width, canvas.height] : null,
      visibility: document.visibilityState,
      glbMs: glb ? Math.round(glb.duration) : null,
      glbMB: glb ? +(glb.decodedBodySize / 1048576).toFixed(2) : null,
    };
  });
  Object.assign(result, counts);

  if (!counts.canvas || counts.canvas[0] <= 300) {
    result.problems.push(`canvas not measured (${counts.canvas?.join("x") ?? "none"})`);
  }

  /*
   * Is anything actually drawn?
   *
   * Measured from a screenshot of the canvas, NOT by reading the canvas in-page.
   * A WebGL context without preserveDrawingBuffer is cleared once composited, so
   * ctx2d.drawImage(webglCanvas) returns fully transparent pixels — which compare
   * as "not the background" and report 100% coverage for a completely blank
   * canvas. That false positive is exactly what this check exists to catch.
   */
  await mkdir(OUT_DIR, { recursive: true });
  // canvasShot hides the on-canvas view controls first; a plain element
  // screenshot would include them and inflate the coverage figure.
  const shot = await canvasShot(page).catch(() => null);

  if (!shot) {
    result.problems.push("could not screenshot the canvas");
  } else {
    const pixels = await analyse(shot.buf);
    result.painted = pixels.litPct;
    // A model fills a healthy fraction of the frame. Anything under ~1% is an
    // empty scene, a stray highlight, or a failed load.
    if (pixels.litPct < 1) {
      result.problems.push(`canvas is effectively blank (${pixels.litPct}% non-background)`);
    }
  }

  // Measure frame rate over one second.
  result.fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames++;
          if (performance.now() - start < 1000) requestAnimationFrame(tick);
          else resolve(frames);
        };
        requestAnimationFrame(tick);
      })
  );

  // Generous timeout: SwiftShader has to rasterise ~500k triangles on the CPU
  // before the compositor can hand over a frame.
  await page.screenshot({ path: join(OUT_DIR, `${region}.png`), timeout: SHOT_TIMEOUT });

  // The real end-to-end assertion: search -> select -> info panel.
  if (search) {
    await page.fill('input[type="search"]', search);
    const firstResult = page.locator("ul li button").first();
    try {
      await firstResult.waitFor({ timeout: 10_000 });
      result.selectedLabel = (await firstResult.innerText()).split("\n")[0];
      await firstResult.click();
      await page.waitForTimeout(400);

      const heading = await page.locator("aside h2").first().innerText();
      result.panelHeading = heading;
      if (expect && !heading.toLowerCase().includes(expect.toLowerCase())) {
        result.problems.push(`panel showed "${heading}", expected to contain "${expect}"`);
      }
      await page.screenshot({
        path: join(OUT_DIR, `${region}-selected.png`),
        timeout: SHOT_TIMEOUT,
      });
    } catch (err) {
      result.problems.push(`search/select failed: ${err.message.split("\n")[0]}`);
    }
  }

  return result;
}

async function main() {
  const arg = process.argv[2];
  let checks;

  if (arg === "--all") {
    // Every model in the catalogue. Regions without a bespoke assertion still get
    // the important ones: it loads, it paints, and it reports named structures.
    const catalogue = JSON.parse(
      await readFile(join(ROOT, "data", "models.json"), "utf8")
    );
    const bespoke = new Map(CHECKS.map((c) => [c.region, c]));
    checks = catalogue.map(
      (m) => bespoke.get(m.id) ?? { region: m.id, search: "", expect: null }
    );
  } else if (arg) {
    checks = CHECKS.filter((c) => c.region === arg);
    if (checks.length === 0) checks = [{ region: arg, search: "", expect: null }];
  } else {
    checks = CHECKS;
  }

  const browser = await chromium.launch({
    args: [
      // Software WebGL: there is no GPU in CI, and headless Chrome refuses
      // hardware GL. SwiftShader is slow but correct.
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // Software rendering plus on-demand dev compilation makes 30s far too tight.
  page.setDefaultNavigationTimeout(120_000);
  page.setDefaultTimeout(60_000);

  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  // One region failing must not abort the rest — a partial report is useful,
  // a stack trace with no results is not.
  const results = [];
  for (const check of checks) {
    process.stdout.write(`checking ${check.region}...\n`);
    try {
      results.push(await checkRegion(page, check));
    } catch (err) {
      results.push({
        region: check.region,
        problems: [`threw: ${err.message.split("\n")[0]}`],
      });
    }
  }

  await browser.close();

  console.log("\n" + "-".repeat(78));
  for (const r of results) {
    console.log(
      `${ok(r.problems.length === 0)} ${r.region.padEnd(32)} ` +
        `${String(r.structures ?? "?").padStart(4)} structures  ` +
        `${String(r.loadMs ?? "?").padStart(6)} ms total ` +
        `(net ${String(r.glbMs ?? "?").padStart(5)} ms)  ` +
        `${String(r.painted ?? "?").padStart(3)}% painted  ` +
        `${String(r.fps ?? "?").padStart(3)} fps*`
    );
    if (r.panelHeading) console.log(`       selected: "${r.panelHeading}"`);
    for (const p of r.problems) console.log(`       x ${p}`);
  }

  if (consoleErrors.length) {
    console.log(`\nUncaught page errors (${consoleErrors.length}):`);
    for (const e of [...new Set(consoleErrors)].slice(0, 5)) console.log(`  ! ${e}`);
  }

  await writeFile(join(OUT_DIR, "results.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(
    `\n* fps is software-rendered (SwiftShader) and is NOT representative of a real\n` +
      `  device. It confirms the render loop runs; it is not a performance measurement.`
  );
  console.log(`Screenshots in .visual/`);

  const failed = results.filter((r) => r.problems.length > 0);
  if (failed.length) {
    console.error(`\n${failed.length} of ${results.length} checks FAILED.`);
    process.exit(1);
  }
  console.log(`All ${results.length} visual checks passed.`);
}

main();

