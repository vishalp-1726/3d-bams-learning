"use client";

import { useViewer } from "@/lib/viewer-store";
import { resolveMesh, describeLayer } from "@/lib/structures";
import { labelForMesh } from "@/lib/mesh-name";
import { LAYER_LABELS } from "@/lib/types";

/**
 * The right-hand rail: what the student sees after clicking a structure.
 *
 * Two levels of fidelity, on purpose:
 *  - Every mesh in the model always yields a correct anatomical name, because the
 *    name ships with the geometry. There are no dead clicks.
 *  - Structures we have written teaching content for additionally show plain
 *    explanation, detail, clinical note and curriculum codes.
 */
export default function StructurePanel({ onClose }: { onClose?: () => void } = {}) {
  const selected = useViewer((s) => s.selected);
  const meshLayer = useViewer((s) => s.meshLayer);
  const meshRegion = useViewer((s) => s.meshRegion);
  const meshLabels = useViewer((s) => s.meshLabels);
  const isolated = useViewer((s) => s.isolated);
  const isolate = useViewer((s) => s.isolate);
  const hideMesh = useViewer((s) => s.hideMesh);
  const focusOn = useViewer((s) => s.focusOn);

  if (!selected) {
    return (
      <div className="p-5">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Nothing selected yet</h2>
        <p className="prose-anat mt-2 text-sm text-[var(--ink-soft)]">
          Tap any structure on the model to read about it. Every part is
          individually named, so there are no dead taps.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-[var(--ink-soft)]">
          <Hint action="Drag">rotate</Hint>
          <Hint action="Pinch">zoom</Hint>
          <Hint action="Tap">select and read</Hint>
        </ul>
      </div>
    );
  }

  const { structure, tier } = resolveMesh(selected, meshLabels);
  const layer = meshLayer[selected];
  const region = meshRegion[selected];

  // The mesh's own name always leads. When the content comes from a parent
  // structure, showing the parent's title instead would be quietly wrong — the
  // reader clicked a specific head, branch or part.
  const heading =
    tier === "specific" && structure ? structure.en : labelForMesh(selected, meshLabels);
  const general = describeLayer(layer ?? "unclassified");

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-2">
          {layer && (
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
              {LAYER_LABELS[layer]}
              {region && <span className="text-[var(--ink-faint)]"> · {region}</span>}
            </p>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="-mt-1 shrink-0 rounded px-1.5 text-lg leading-none text-[var(--ink-faint)] transition hover:text-[var(--ink)]"
            >
              ×
            </button>
          )}
        </div>

        <h2 className="mt-1.5 text-xl font-semibold leading-tight text-[var(--ink)]">
          {heading}
        </h2>

        {tier === "specific" && structure?.ta2 && (
          <p className="mt-1 text-sm italic text-[var(--ink-soft)]">{structure.ta2}</p>
        )}

        {tier === "specific" && structure?.synonyms?.length ? (
          <p className="mt-1 text-xs text-[var(--ink-faint)]">
            Also called: {structure.synonyms.join(", ")}
          </p>
        ) : null}

        {/* Say where the explanation came from, so a part is never mistaken for
            the whole and a general description is never mistaken for specific. */}
        {tier === "parent" && structure && (
          <p className="mt-2 rounded-md bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs text-[var(--accent)]">
            Part of <strong className="font-semibold">{structure.en}</strong> — shown below.
          </p>
        )}
        {tier === "general" && (
          <p className="mt-2 rounded-md bg-[var(--page)] px-2.5 py-1.5 text-xs text-[var(--ink-faint)]">
            General description for this tissue. A specific entry for this structure
            has not been written yet.
          </p>
        )}

        <Section title="In simple words">
          {structure?.plain ?? general.plain}
        </Section>

        {structure?.detail ? (
          <Section title="Detail">{structure.detail}</Section>
        ) : (
          general.detail && <Section title="Detail">{general.detail}</Section>
        )}

        {/* Shown for a part too: the banner above already says whose it is, and a
            named head shares its parent's clinical significance. */}
        {structure?.clinical && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">
              Why it matters clinically
            </h3>
            <p className="prose-anat mt-1.5 rounded-lg border-l-[3px] border-amber-500 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
              {structure.clinical}
            </p>
          </div>
        )}

        {structure?.curriculum && (
          <div className="mt-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
              Syllabus
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {structure.curriculum.nmc?.map((code) => (
                <Tag key={code} title="NMC CBME competency">
                  {code}
                </Tag>
              ))}
              {structure.curriculum.ncism?.map((code) => (
                <Tag key={code} title="NCISM AyUG-RS module">
                  {code}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {/* The source model's own name. Showing it makes content gaps reportable
            by students without guesswork. */}
        <p className="mt-6 break-words font-mono text-[11px] text-[var(--ink-faint)]">
          {meshLabels[selected] ?? selected}
        </p>
      </div>

      <div className="flex gap-2 border-t border-[var(--border)] bg-white p-3">
        {/* Centres the orbit on this structure, so it can be turned and examined
            from every side without swinging off-screen. */}
        <button
          type="button"
          onClick={() => focusOn(selected)}
          className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--ink-soft)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          title="Centre the view on this structure"
        >
          Focus
        </button>
        <button
          type="button"
          onClick={() => isolate(isolated === selected ? null : selected)}
          className="flex-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition hover:brightness-110"
        >
          {isolated === selected ? "Show all" : "Isolate"}
        </button>
        <button
          type="button"
          onClick={() => hideMesh(selected)}
          className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--ink-soft)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Hide
        </button>
      </div>
    </div>
  );
}

function Hint({ action, children }: { action: string; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="rounded border border-[var(--border)] bg-white px-1.5 py-0.5 text-[11px] font-medium text-[var(--ink)]">
        {action}
      </span>
      <span className="text-[13px]">{children}</span>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
        {title}
      </h3>
      <p className="prose-anat mt-1.5 text-sm text-[var(--ink)]">{children}</p>
    </div>
  );
}

function Tag({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <span
      title={title}
      className="rounded border border-[var(--border)] bg-[var(--page)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink-soft)]"
    >
      {children}
    </span>
  );
}
