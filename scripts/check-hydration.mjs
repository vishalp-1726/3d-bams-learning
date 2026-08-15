/**
 * Hydration check in an extension-free browser.
 *
 * React hydration warnings are noisy in normal development because browser
 * extensions (Grammarly, Scribe, password managers, dark-mode tools) inject
 * attributes into <html> and <body> before React hydrates. Those are not our
 * bugs, but they look identical to real ones in the console — so a genuine
 * hydration bug can hide behind the noise indefinitely.
 *
 * Playwright's Chromium has no extensions, so anything reported here is real.
 *
 *   npm run dev
 *   npm run check:hydration
 *
 * Exit code 1 means a genuine hydration mismatch exists in our own markup.
 */

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PAGES = ["/", "/explore/hand", "/attributions"];

const HYDRATION_RE = /hydrat|did not match|didn't match|server rendered HTML/i;

async function main() {
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultNavigationTimeout(120_000);

  let captured = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") captured.push(m.text());
  });
  page.on("pageerror", (e) => captured.push(`PAGEERROR: ${e.message}`));

  const findings = [];

  for (const path of PAGES) {
    captured = [];
    await page.goto(BASE + path, { waitUntil: "load" });
    await page.waitForTimeout(4000);

    const hydration = captured.filter((m) => HYDRATION_RE.test(m));
    const other = captured.filter((m) => !HYDRATION_RE.test(m));

    console.log(`${hydration.length === 0 ? "ok  " : "FAIL"} ${path.padEnd(20)} ` +
      `${hydration.length} hydration, ${other.length} other`);

    for (const h of hydration) {
      findings.push(`${path}: ${h.split("\n")[0].slice(0, 300)}`);
    }
    for (const o of other.slice(0, 3)) {
      console.log(`       - ${o.split("\n")[0].slice(0, 160)}`);
    }
  }

  // Show what is actually on <html>/<body> with no extensions present, so the
  // difference from a real browser is visible at a glance.
  const attrs = await page.evaluate(() => ({
    html: [...document.documentElement.attributes].map((a) => a.name),
    body: [...document.body.attributes].map((a) => a.name),
  }));
  console.log(`\nAttributes with no extensions installed:`);
  console.log(`  <html>: ${attrs.html.join(", ") || "(none)"}`);
  console.log(`  <body>: ${attrs.body.join(", ") || "(none)"}`);

  await browser.close();

  if (findings.length) {
    console.error(`\nFAILED — ${findings.length} genuine hydration mismatch(es):`);
    for (const f of findings) console.error(`  x ${f}`);
    console.error(
      `\nThese are real: this browser has no extensions, so nothing external\n` +
        `touched the markup before React hydrated.`
    );
    process.exit(1);
  }

  console.log(`\nNo hydration mismatches in our markup across ${PAGES.length} pages.`);
  console.log(
    `If your own browser still reports one, it is an extension modifying <html>/<body>\n` +
      `before React loads. app/layout.tsx carries suppressHydrationWarning on those two\n` +
      `elements for exactly that reason — see the comment there.`
  );
}

main();
