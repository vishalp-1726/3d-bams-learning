"use client";

import { useMemo, useState } from "react";
import { useViewer } from "@/lib/viewer-store";
import { structureForMesh } from "@/lib/structures";
import { labelForMesh } from "@/lib/mesh-name";

/**
 * Search the structures actually present in the loaded model.
 *
 * Deliberately searches mesh names — not only structures we've written content
 * for — so all 223 parts of the hand are findable from day one. Latin (TA2) and
 * synonym matches come from the content layer where it exists.
 */
export default function StructureSearch({ onPick }: { onPick?: () => void } = {}) {
  const [query, setQuery] = useState("");
  const meshLayer = useViewer((s) => s.meshLayer);
  const meshLabels = useViewer((s) => s.meshLabels);
  const select = useViewer((s) => s.select);
  const hover = useViewer((s) => s.hover);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    return Object.keys(meshLayer)
      .map((meshName) => {
        // Exact matches only in search results — a parent match would make every
        // head of pectoralis major appear under that name and hide the difference.
        const structure = structureForMesh(meshName, meshLabels);
        // Search the original name too: the scene only carries the mangled
        // canonical form, so typing "Superior trunk" would otherwise miss
        // "Superior_trunk_of_brachial_plexusr".
        const haystacks = [
          meshName,
          meshLabels[meshName] ?? "",
          labelForMesh(meshName, meshLabels),
          structure?.en ?? "",
          structure?.ta2 ?? "",
          ...(structure?.synonyms ?? []),
        ];
        let score = Infinity;
        for (const h of haystacks) {
          const i = h.toLowerCase().indexOf(q);
          if (i !== -1) score = Math.min(score, i);
        }
        return { meshName, structure, score };
      })
      .filter((r) => r.score !== Infinity)
      .sort((a, b) => a.score - b.score || a.meshName.localeCompare(b.meshName))
      .slice(0, 12);
  }, [query, meshLayer, meshLabels]);

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search structures…"
        aria-label="Search anatomical structures"
        className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
      />

      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-white shadow-lg">
          {results.map(({ meshName, structure }) => (
            <li key={meshName}>
              <button
                type="button"
                onMouseEnter={() => hover(meshName)}
                onMouseLeave={() => hover(null)}
                onClick={() => {
                  select(meshName);
                  setQuery("");
                  onPick?.();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-[var(--ink)] transition hover:bg-[var(--accent-soft)]"
              >
                <span className="block">
                  {structure?.en ?? labelForMesh(meshName, meshLabels)}
                </span>
                {structure?.ta2 && (
                  <span className="block text-xs italic text-[var(--ink-faint)]">
                    {structure.ta2}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
