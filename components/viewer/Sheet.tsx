"use client";

import { useEffect } from "react";

/**
 * Mobile bottom sheet.
 *
 * The pattern every serious 3D anatomy tool settles on for phones: the model
 * keeps the full screen, and detail slides up over it rather than shrinking the
 * canvas into a strip. Dismissed by the handle, the backdrop, or Escape.
 */
export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // Escape closes, and the page behind must not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--ink)]/25"
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[78dvh] flex-col rounded-t-2xl border-t border-[var(--border)] bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="flex w-full shrink-0 items-center justify-center py-3"
          aria-label="Close panel"
        >
          <span className="h-1 w-10 rounded-full bg-[var(--border)]" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
