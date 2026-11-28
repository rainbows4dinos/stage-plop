"use client";

import { useEffect, useRef, useState } from "react";

/** Phones: zoom, Labels and Sound tucked behind one button so the stage toolbar stays one row. */
export function ViewMenu({
  labels,
  sound,
  onLabels,
  onSound,
  onFit,
}: {
  labels: boolean;
  sound: boolean;
  onLabels: (v: boolean) => void;
  onSound: (v: boolean) => void;
  onFit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        className="btn btn-sm w-[28px] px-0"
        aria-label="View Options"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {open && (
        <div className="popover popover-end w-[200px]" role="dialog" aria-label="View Options">
          <label className="check">
            <input type="checkbox" checked={labels} onChange={(e) => onLabels(e.target.checked)} />
            Labels
          </label>
          <label className="check">
            <input type="checkbox" checked={sound} onChange={(e) => onSound(e.target.checked)} />
            Sound
          </label>
          <button
            className="btn btn-sm"
            onClick={() => {
              onFit();
              setOpen(false);
            }}
          >
            Fit Stage to View
          </button>
          <p className="m-0 text-xs text-muted">Pinch to zoom. In 3D, drag empty space to spin.</p>
        </div>
      )}
    </div>
  );
}
