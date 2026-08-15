/**
 * Does the explorer fit the viewport, or does the page scroll?
 *
 * The user's screenshot shows a page-level scrollbar. That matters for more than
 * tidiness: if the page can scroll, a drag that begins on the viewer can scroll
 * the document instead of rotating the model — which is indistinguishable, to the
 * person using it, from "rotation is broken".
 *
 * Checked at several window heights because the fault only appears when the
 * viewport is shorter than the content.
 */

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const REGION = process.argv[2] ?? "overview-skeleton";

const SIZES = [
  { name: "laptop 1366x768", width: 1366, height: 768 },
  { name: "user ~1900x768", width: 1900, height: 768 },
  { name: "desktop 1440x900", width: 1440, height: 900 },
  { name: "phone 390x844", width: 390, height: 844 },
];

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

let bad = 0;

for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  page.setDefaultNavigationTimeout(180_000);
  await page.goto(`${BASE}/explore/${REGION}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => Number(document.querySelector("[data-viewer]")?.getAttribute("data-structure-count") ?? 0) > 0,
    { timeout: 180_000 }
  );
  await page.waitForTimeout(2500);

  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    const canvas = document.querySelector("canvas");
    const r = canvas.getBoundingClientRect();
    return {
      scrollH: doc.scrollHeight,
      clientH: doc.clientHeight,
      scrollW: doc.scrollWidth,
      clientW: doc.clientWidth,
      canvasH: Math.round(r.height),
      canvasW: Math.round(r.width),
      // Can the document actually be scrolled by the user?
      canScrollY: doc.scrollHeight > doc.clientHeight + 1,
      canScrollX: doc.scrollWidth > doc.clientWidth + 1,
    };
  });

  const verdict = m.canScrollY || m.canScrollX ? "PAGE SCROLLS" : "fits";
  if (m.canScrollY || m.canScrollX) bad++;

  console.log(
    `${size.name.padEnd(18)} canvas ${String(m.canvasW).padStart(4)}x${String(m.canvasH).padStart(4)}  ` +
      `doc ${m.scrollW}x${m.scrollH} vs view ${m.clientW}x${m.clientH}  -> ${verdict}`
  );
  await page.close();
}

await browser.close();

if (bad) {
  console.error(`\nFAILED — the page scrolls at ${bad} of ${SIZES.length} sizes.`);
  process.exit(1);
}
console.log("\nThe explorer fits the viewport at every size tested.");

