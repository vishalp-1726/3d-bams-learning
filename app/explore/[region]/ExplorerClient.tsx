"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AnatomyCanvas from "@/components/viewer/AnatomyCanvas";
import LayerControls from "@/components/viewer/LayerControls";
import StructurePanel from "@/components/viewer/StructurePanel";
import StructureSearch from "@/components/viewer/StructureSearch";
import LoadingOverlay from "@/components/viewer/LoadingOverlay";
import ViewControls from "@/components/viewer/ViewControls";
import Sheet from "@/components/viewer/Sheet";
import { useViewer } from "@/lib/viewer-store";
import type { ModelEntry } from "@/lib/types";

/**
 * Canvas-first explorer.
 *
 * The model gets the whole area and every control floats over it, which is the
 * layout every established 3D anatomy tool converges on. The previous version
 * gave two fixed side columns a permanent third of the screen even when nothing
 * was selected, and on a phone it squeezed the model into a strip with the
 * controls stacked below — so the page scrolled and the model was too small to
 * work with.
 *
 * Phones get the same canvas at full size, with detail arriving in a bottom
 * sheet over the model rather than pushing it out of the way.
 */
export default function ExplorerClient({ model }: { model: ModelEntry }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);

  const selected = useViewer((s) => s.selected);
  const structureCount = useViewer((s) => Object.keys(s.meshLayer).length);

  const base = process.env.NEXT_PUBLIC_MODEL_BASE_URL ?? "/models";
  const url = `${base}/${model.file}`;

  // On a phone, selecting a structure should surface its explanation straight
  // away — that is the whole point of tapping it.
  useEffect(() => {
    if (selected) setPanelOpen(true);
  }, [selected]);

  return (
    <div
      className="relative min-h-0 flex-1 overflow-hidden"
      // Stable readiness signal for the checks in scripts/. Matching prose broke
      // them every time a label was reworded.
      data-viewer
      data-structure-count={structureCount}
      data-model={model.id}
    >
      <AnatomyCanvas url={url} regionId={model.id} />
      <ViewControls />
      <LoadingOverlay sizeMB={model.sizeMB} />

      {/* ---------- top-left: where am I ---------- */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex max-w-[min(20rem,60vw)] flex-col gap-2">
        <div className="pointer-events-auto rounded-xl border border-[var(--border)] bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
          <Link
            href="/"
            className="text-[11px] text-[var(--ink-faint)] transition hover:text-[var(--accent)]"
          >
            ← All models
          </Link>
          <h1 className="text-sm font-semibold leading-tight text-[var(--ink)]">
            {model.title}
          </h1>
          <p className="text-[11px] text-[var(--ink-faint)]">
            {structureCount > 0 ? `${structureCount} structures` : `${model.sizeMB} MB`}
          </p>
        </div>

        {/* Search is the fastest route to a named structure, so it stays visible. */}
        <div className="pointer-events-auto hidden lg:block">
          <StructureSearch />
        </div>
      </div>

      {/* ---------- desktop left rail: layers ---------- */}
      <div className="pointer-events-none absolute bottom-3 left-3 top-32 z-10 hidden w-60 lg:block">
        {railOpen ? (
          <div className="pointer-events-auto flex h-full flex-col rounded-xl border border-[var(--border)] bg-white/95 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
                Layers
              </span>
              <button
                type="button"
                onClick={() => setRailOpen(false)}
                className="rounded px-1.5 text-sm text-[var(--ink-faint)] transition hover:text-[var(--accent)]"
                title="Collapse"
                aria-label="Collapse layers panel"
              >
                ‹
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <LayerControls />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRailOpen(true)}
            className="pointer-events-auto rounded-xl border border-[var(--border)] bg-white/95 px-3 py-2 text-xs font-medium text-[var(--ink-soft)] shadow-sm backdrop-blur transition hover:text-[var(--accent)]"
          >
            Layers ›
          </button>
        )}
      </div>

      {/* ---------- desktop right: detail, only when something is chosen ---------- */}
      {selected && (
        <aside className="absolute bottom-3 right-3 top-3 z-20 hidden w-[21rem] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-lg lg:flex">
          <StructurePanel onClose={() => useViewer.getState().select(null)} />
        </aside>
      )}

      {/* Desktop hint when nothing is selected — replaces the old always-on panel. */}
      {!selected && structureCount > 0 && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden max-w-[15rem] rounded-xl border border-[var(--border)] bg-white/90 px-3 py-2 text-[11px] leading-relaxed text-[var(--ink-soft)] shadow-sm backdrop-blur lg:block">
          Click any structure to read about it. Drag to rotate, scroll to zoom.
        </div>
      )}

      {/* ---------- mobile action bar ---------- */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t border-[var(--border)] bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setLayersOpen(true)}
          className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm font-medium text-[var(--ink-soft)]"
        >
          Layers
        </button>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium ${
            selected
              ? "bg-[var(--accent)] text-white"
              : "border border-[var(--border)] text-[var(--ink-faint)]"
          }`}
        >
          {selected ? "Details" : "Nothing selected"}
        </button>
      </div>

      <Sheet open={layersOpen} onClose={() => setLayersOpen(false)} title="Layers and search">
        <div className="space-y-5 p-4 pb-8">
          <StructureSearch onPick={() => setLayersOpen(false)} />
          <LayerControls />
        </div>
      </Sheet>

      <Sheet open={panelOpen} onClose={() => setPanelOpen(false)} title="Structure details">
        <StructurePanel />
      </Sheet>
    </div>
  );
}
