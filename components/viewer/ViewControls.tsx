"use client";

import { useEffect, useState } from "react";
import { useViewer, type StandardView } from "@/lib/viewer-store";

/**
 * Standard anatomical views, on the canvas itself.
 *
 * Dragging rotates the model, but nothing on screen said so, and reaching the
 * back meant sweeping most of the way across the canvas. These make the model's
 * three-dimensionality obvious at a glance and put every side one click away —
 * which also matters on a trackpad, where a long drag is awkward.
 *
 * Left and right are the PATIENT's left and right, which is the convention
 * students are taught.
 */
const VIEWS: Array<{ id: StandardView; label: string; hint: string }> = [
  { id: "front", label: "Front", hint: "Anterior view" },
  { id: "back", label: "Back", hint: "Posterior view" },
  { id: "left", label: "Left", hint: "From the patient's left" },
  { id: "right", label: "Right", hint: "From the patient's right" },
  { id: "top", label: "Top", hint: "Superior view" },
  { id: "bottom", label: "Bottom", hint: "Inferior view" },
];

export default function ViewControls() {
  const setView = useViewer((s) => s.setView);
  const ready = useViewer((s) => Object.keys(s.meshLayer).length > 0);

  /*
   * The hint teaches the drag gesture, then gets out of the way. Left permanently
   * it sat unreadable over the model — and anyone who has already dragged does
   * not need telling.
   */
  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    if (!ready) return;
    const dismiss = () => setShowHint(false);
    window.addEventListener("pointerdown", dismiss, { once: true });
    const timer = setTimeout(dismiss, 8000);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      clearTimeout(timer);
    };
  }, [ready]);

  if (!ready) return null;

  return (
    /*
     * Top-centre on desktop, just above the thumb-reach action bar on a phone.
     * At the top on mobile it collided with the model title, and reaching the top
     * of a tall screen one-handed is awkward anyway.
     */
    <div className="pointer-events-none absolute inset-x-0 bottom-16 z-10 flex flex-col items-center lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-3 lg:-translate-x-1/2">
      {showHint && (
        <p className="pointer-events-none mb-2 w-fit rounded-full bg-[var(--ink)]/75 px-3 py-1 text-[11px] font-medium text-white shadow-sm lg:order-2 lg:mb-0 lg:mt-2">
          Drag the model to turn it · scroll to zoom
        </p>
      )}
      <div className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-0.5 overflow-x-auto rounded-full border border-[var(--border)] bg-white/95 p-1 shadow-sm backdrop-blur lg:order-1">
        <span className="shrink-0 px-2 text-[11px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
          View
        </span>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            title={v.hint}
            onClick={() => setView(v.id)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
