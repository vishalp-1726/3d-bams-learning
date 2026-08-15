/**
 * Discover the full Open3DModel catalogue and write data/model-sources.json.
 *
 * The consortium adds new sub-models over time (their published roadmap runs
 * well past what exists today), and the viewer slug for a model is not
 * guessable from its title — it only appears inside the AnatomyTOOL page that
 * embeds the viewer. So we crawl the index rather than hard-coding a list.
 *
 * Output feeds two things:
 *   - data/models.json   the hand-authored catalogue (titles, blurbs, grouping)
 *   - models/LICENSE.md  provenance, one source URL per asset
 *
 * Run this when you want to pick up newly published models:
 *   npm run models:discover
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "model-sources.json");

const INDEX = "https://anatomytool.org/open3dmodel-learn";
const ASSET_BASE = "https://caskanatomy.info/open3dviewer/3dmodels";
const VIEWER_RE = /open3dviewer\/\?model=([a-z0-9._-]+)/gi;
const CONCURRENCY = 6;

/** Run tasks with a small concurrency cap — this is someone else's server. */
async function pooled(items, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    out.push(...(await Promise.all(items.slice(i, i + CONCURRENCY).map(fn))));
  }
  return out;
}

async function main() {
  const html = await (await fetch(INDEX)).text();

  const contentPages = [
    ...new Set([...html.matchAll(/https:\/\/anatomytool\.org\/content\/[a-z0-9-]+/gi)].map((m) => m[0])),
  ];
  console.log(`Index lists ${contentPages.length} model pages.`);

  /** slug -> the AnatomyTOOL page it was found on (used for attribution). */
  const sources = new Map();
  for (const [, slug] of html.matchAll(VIEWER_RE)) sources.set(slug, INDEX);

  await pooled(contentPages, async (url) => {
    try {
      const page = await (await fetch(url)).text();
      for (const [, slug] of page.matchAll(VIEWER_RE)) {
        if (!sources.has(slug)) sources.set(slug, url);
      }
    } catch (err) {
      console.warn(`  ! could not read ${url}: ${err.message}`);
    }
  });

  console.log(`Found ${sources.size} viewer slugs. Checking each asset...`);

  const checked = await pooled([...sources.entries()], async ([slug, sourceUrl]) => {
    const assetUrl = `${ASSET_BASE}/${slug}/${slug}.glb`;
    try {
      // Range request: read the size from Content-Range without downloading.
      const res = await fetch(assetUrl, { headers: { Range: "bytes=0-1" } });
      if (!res.ok && res.status !== 206) return { slug, ok: false };
      const range = res.headers.get("content-range");
      const bytes = range ? Number(range.split("/")[1]) : null;
      res.body?.cancel();
      return { slug, sourceUrl, assetUrl, sizeMB: bytes ? +(bytes / 1048576).toFixed(2) : null, ok: true };
    } catch {
      return { slug, ok: false };
    }
  });

  const available = checked.filter((c) => c.ok).sort((a, b) => a.slug.localeCompare(b.slug));
  const missing = checked.filter((c) => !c.ok);

  const totalMB = available.reduce((sum, a) => sum + (a.sizeMB ?? 0), 0);
  console.log(`\n${available.length} downloadable models, ${totalMB.toFixed(1)} MB total.`);
  if (missing.length) {
    console.log(`Referenced but not downloadable: ${missing.map((m) => m.slug).join(", ")}`);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      Object.fromEntries(available.map((a) => [a.slug, { sourceUrl: a.sourceUrl, assetUrl: a.assetUrl, sizeMB: a.sizeMB }])),
      null,
      2
    ) + "\n"
  );
  console.log(`-> data/model-sources.json`);

  // Flag anything discovered that the catalogue doesn't yet present to students.
  try {
    const catalogue = JSON.parse(await (await import("node:fs/promises")).readFile(join(ROOT, "data", "models.json"), "utf8"));
    const known = new Set(catalogue.map((m) => m.id));
    const unlisted = available.filter((a) => !known.has(a.slug));
    if (unlisted.length) {
      console.log(`\n${unlisted.length} model(s) not yet in data/models.json:`);
      for (const u of unlisted) console.log(`  ${u.slug} (${u.sizeMB} MB)`);
    }
  } catch {
    /* catalogue not present yet */
  }
}

main();
