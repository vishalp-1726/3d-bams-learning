"use client";

import Link from "next/link";
import { useRef } from "react";
import type { ModelEntry } from "@/lib/types";

/**
 * Catalogue card that starts downloading its model as soon as the pointer lands
 * on it.
 *
 * A plain fetch() is used rather than useGLTF.preload() on purpose: preloading
 * through drei would pull three.js into the landing page bundle for no rendering
 * benefit. The file lands in the HTTP cache either way, and /models/* is served
 * immutable with a one-year max-age, so the viewer then loads it from cache.
 */
export default function ModelCard({
  model,
  explained,
}: {
  model: ModelEntry;
  explained?: number;
}) {
  const prefetched = useRef(false);

  const prefetch = () => {
    if (prefetched.current) return;
    prefetched.current = true;
    const base = process.env.NEXT_PUBLIC_MODEL_BASE_URL ?? "/models";
    // Low priority so it never competes with what the user is currently viewing.
    fetch(`${base}/${model.file}`, { priority: "low" } as RequestInit).catch(() => {
      prefetched.current = false;
    });
  };

  return (
    <Link
      href={`/explore/${model.id}`}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
      className="group flex h-full flex-col rounded-xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(15,28,46,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_6px_18px_rgba(15,28,46,0.09)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium leading-tight text-[var(--ink)] group-hover:text-[var(--accent)]">
          {model.title}
        </h3>
        <span className="shrink-0 text-xs tabular-nums text-[var(--ink-faint)]">
          {model.sizeMB} MB
        </span>
      </div>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--ink-soft)]">
        {model.blurb}
      </p>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {model.meshCount > 0 && (
          <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 font-medium text-[var(--accent)]">
            {model.meshCount} structures
          </span>
        )}
        {explained ? (
          <span
            className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700"
            title="Structures with a written explanation and clinical note"
          >
            {explained} explained
          </span>
        ) : null}
      </p>
    </Link>
  );
}
