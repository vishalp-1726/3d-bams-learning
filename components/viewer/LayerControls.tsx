"use client";

import { useViewer } from "@/lib/viewer-store";
import { LAYER_LABELS, LAYERS } from "@/lib/types";
import type { Layer } from "@/lib/types";

/**
 * Visibility controls, driven entirely by what is actually inside the loaded GLB.
 *
 * Two axes, because the source models carry both:
 *   Layers      bones / muscles / nerves / arteries …
 *   Sub-regions pectoral girdle / arm / forearm / hand & wrist  (upper limb only)
 *
 * Nothing here is hard-coded per model — a file with extra layers or regions gets
 * extra toggles for free.
 */
export default function LayerControls() {
  const layerMeshes = useViewer((s) => s.layerMeshes);
  const regionMeshes = useViewer((s) => s.regionMeshes);
  const hiddenLayers = useViewer((s) => s.hiddenLayers);
  const hiddenRegions = useViewer((s) => s.hiddenRegions);
  const toggleLayer = useViewer((s) => s.toggleLayer);
  const toggleRegion = useViewer((s) => s.toggleRegion);
  const contextOpacity = useViewer((s) => s.contextOpacity);
  const setContextOpacity = useViewer((s) => s.setContextOpacity);
  const reset = useViewer((s) => s.reset);

  // Keep the canonical anatomical order rather than alphabetical.
  const presentLayers = LAYERS.filter((l) => (layerMeshes[l]?.length ?? 0) > 0);
  const regions = Object.keys(regionMeshes).sort();

  if (presentLayers.length === 0) return null;

  return (
    <div className="space-y-6">
      <MirrorToggle />

      <Toggles
        title="Layers"
        hint="Turn a tissue off to see what lies beneath it."
        items={presentLayers.map((layer) => ({
          key: layer,
          label: LAYER_LABELS[layer],
          count: layerMeshes[layer]?.length ?? 0,
          visible: !hiddenLayers.has(layer),
          onToggle: () => toggleLayer(layer as Layer),
        }))}
      />

      {regions.length > 1 && (
        <Toggles
          title="Regions"
          items={regions.map((region) => ({
            key: region,
            label: region,
            count: regionMeshes[region].length,
            visible: !hiddenRegions.has(region),
            onToggle: () => toggleRegion(region),
          }))}
        />
      )}

      <div>
        <label
          htmlFor="context-opacity"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]"
        >
          See-through
        </label>
        <input
          id="context-opacity"
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={contextOpacity}
          onChange={(e) => setContextOpacity(Number(e.target.value))}
          className="w-full"
        />
        <p className="mt-1 text-[11px] text-[var(--ink-faint)]">
          Fades everything except the selected structure.
        </p>
      </div>

      <button
        type="button"
        onClick={reset}
        className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--ink-soft)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        Reset view
      </button>
    </div>
  );
}

/**
 * The half-body question, answered where it is asked.
 *
 * The source models contain the right side plus midline structures and no left
 * side at all, which reads as a broken download. Rather than only explaining
 * that, this offers the fix: mirroring the lateral structures builds the missing
 * half on the spot.
 */
function MirrorToggle() {
  const mirrored = useViewer((s) => s.mirrored);
  const toggleMirror = useViewer((s) => s.toggleMirror);

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
        Body
      </h3>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-[var(--page)] p-1">
        <button
          type="button"
          onClick={() => mirrored && toggleMirror()}
          aria-pressed={!mirrored}
          className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
            !mirrored ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-faint)]"
          }`}
        >
          Right side
        </button>
        <button
          type="button"
          onClick={() => !mirrored && toggleMirror()}
          aria-pressed={mirrored}
          className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
            mirrored ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--ink-faint)]"
          }`}
        >
          Whole body
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--ink-faint)]">
        {mirrored
          ? "The left side is a mirror image of the right, not separate scan data."
          : "The source models contain the right side and the midline only."}
      </p>
    </div>
  );
}

interface ToggleItem {
  key: string;
  label: string;
  count: number;
  visible: boolean;
  onToggle: () => void;
}

function Toggles({
  title,
  hint,
  items,
}: {
  title: string;
  hint?: string;
  items: ToggleItem[];
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
        {title}
      </h3>
      {hint && <p className="mt-1 text-[11px] text-[var(--ink-faint)]">{hint}</p>}
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={item.onToggle}
              aria-pressed={item.visible}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                item.visible
                  ? "bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(15,28,46,0.05)]"
                  : "text-[var(--ink-faint)] hover:bg-white/60"
              }`}
            >
              {/* A real checkbox affordance: the old version relied on colour
                  alone, which is invisible to anyone with low vision. */}
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                  item.visible
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] bg-white"
                }`}
              >
                {item.visible && (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                    <path
                      d="M2.5 6.2l2.3 2.3 4.7-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              {/* Wrap rather than truncate: "Bursae & sheaths" told the student
                  nothing when it rendered as "Bursae & synovial shea…". */}
              <span className="flex-1 leading-snug">{item.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-[var(--ink-faint)]">
                {item.count}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
