"use client";

import { useProgress } from "@react-three/drei";
import { useViewer } from "@/lib/viewer-store";

/**
 * Loading state for the 3D viewer.
 *
 * Models are 0.2–6.6 MB of Draco-compressed geometry, and on a slow connection
 * the wait is long enough that a static "loading…" label reads as a broken page.
 * drei's useProgress is fed by THREE.DefaultLoadingManager, so this reflects real
 * download and parse progress rather than a guess.
 */
export default function LoadingOverlay({ sizeMB }: { sizeMB: number }) {
  const { active, progress } = useProgress();
  // The store is only populated once the scene graph has been published, so this
  // stays up through parsing, after the network transfer has finished.
  const ready = useViewer((s) => Object.keys(s.meshLayer).length > 0);

  if (ready && !active) return null;

  const pct = Math.min(99, Math.round(progress));

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--page)]/75 backdrop-blur-[1px]">
      <div className="h-1.5 w-52 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200"
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
      <p className="text-sm tabular-nums text-[var(--ink)]">
        {pct < 99 ? `Loading model · ${pct}%` : "Preparing structures…"}
      </p>
      <p className="text-[11px] text-[var(--ink-faint)]">
        {sizeMB} MB · downloaded once, then cached
      </p>
    </div>
  );
}
