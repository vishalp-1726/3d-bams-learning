/**
 * Screenshot the non-3D pages for design review, at desktop and phone widths.
 *
 * The 3D viewer is covered by check-visual; this covers everything around it,
 * where most usability problems actually live.
 *
 *   npm run shots
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".visual");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const PAGES = [
  { path: "/", name: "home" },
  { path: "/attributions", name: "sources" },
  { path: "/explore/zone-knee", name: "viewer", is3d: true },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 950 },
  { name: "phone", width: 390, height: 844 },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
    });
    page.setDefaultNavigationTimeout(180_000);
    page.setDefaultTimeout(120_000);

    for (const p of PAGES) {
      await page.goto(BASE + p.path, { waitUntil: "domcontentloaded" });
      if (p.is3d) {
        // Wait for the model, then for a click to select something, so the
        // screenshot shows the panel in its real state rather than empty.
        await page.waitForFunction(
          () =>
            Number(
              document.querySelector("[data-viewer]")?.getAttribute("data-structure-count") ?? 0
            ) > 0,
          { timeout: 180_000 }
        );
        await page.waitForTimeout(6000);
        await page.fill('input[type="search"]', "cruciate").catch(() => {});
        await page.locator("ul li button").first().click().catch(() => {});
        await page.waitForTimeout(2500);
      } else {
        await page.waitForLoadState("networkidle").catch(() => {});
      }
      const file = join(OUT, `${p.name}-${vp.name}.png`);
      // Software rendering needs a long deadline before the compositor can hand
      // over a frame containing the model. One failure should not lose the rest.
      try {
        await page.screenshot({
          path: file,
          fullPage: vp.name === "desktop" && !p.is3d,
          timeout: 180_000,
        });
        console.log(`  ${p.name.padEnd(8)} ${vp.name.padEnd(8)} -> .visual/${p.name}-${vp.name}.png`);
      } catch (err) {
        console.warn(`  ${p.name.padEnd(8)} ${vp.name.padEnd(8)} FAILED: ${err.message.split("\n")[0]}`);
      }
    }
    await page.close();
  }

  await browser.close();
}

main();
