/**
 * Screenshot ONLY the 3D canvas.
 *
 * Playwright's element screenshot captures the page clipped to that element's
 * box — including anything drawn on top of it. Once the view-control bar was
 * added over the canvas, every pixel measurement silently started including it:
 * the giveaway was a silhouette exactly 349px wide in all six views, front and
 * side alike, which is impossible for a real body and was in fact the width of
 * the control bar.
 *
 * Hiding the overlays for the duration of the shot keeps the measurements about
 * the model and nothing else.
 */

/** Selectors for chrome layered over the canvas. */
const OVERLAY_SELECTORS = [
  ".anat-canvas ~ *",
  "[data-viewer-overlay]",
];

export async function canvasShot(page, options = {}) {
  const hidden = await page.evaluate((selectors) => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return [];
    const canvasBox = canvas.getBoundingClientRect();
    const marked = [];

    // Anything positioned over the canvas that is not the canvas itself.
    for (const el of document.querySelectorAll("body *")) {
      if (el === canvas || el.contains(canvas)) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== "absolute" && cs.position !== "fixed") continue;
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const r = el.getBoundingClientRect();
      const overlaps =
        r.width > 0 &&
        r.height > 0 &&
        r.left < canvasBox.right &&
        r.right > canvasBox.left &&
        r.top < canvasBox.bottom &&
        r.bottom > canvasBox.top;
      if (!overlaps) continue;
      el.setAttribute("data-hidden-for-shot", "1");
      el.style.setProperty("visibility", "hidden", "important");
      marked.push(true);
    }
    void selectors;
    return marked;
  }, OVERLAY_SELECTORS);

  const buf = await page.locator("canvas").screenshot({ timeout: 180_000, ...options });

  await page.evaluate(() => {
    for (const el of document.querySelectorAll("[data-hidden-for-shot]")) {
      el.style.removeProperty("visibility");
      el.removeAttribute("data-hidden-for-shot");
    }
  });

  return { buf, hiddenCount: hidden.length };
}
