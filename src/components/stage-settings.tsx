"use client";

import { useEffect, useRef, useState } from "react";
import { STAGE_PRESETS } from "@/lib/plot";

/** The stage size tag on the toolbar. Opens a popover with size, snap and Clear Stage. */
export function StageSettings({
  stage,
  snap,
  onStage,
  onSnap,
  onClear,
}: {
  stage: { w: number; d: number };
  snap: boolean;
  onStage: (w: number, d: number) => void;
  onSnap: (v: boolean) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const presetId = STAGE_PRESETS.find((p) => p.w === stage.w && p.d === stage.d)?.id ?? "custom";

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
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
        ref={triggerRef}
        className="tag-button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Stage Size, ${stage.w} by ${stage.d} feet`}
        onClick={() => setOpen(!open)}
      >
        {stage.w} × {stage.d} ft
        <svg width="10" height="7" viewBox="0 0 12 8" aria-hidden="true">
          <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Stage Settings">
          <label className="grid gap-1">
            <span className="caption">Size</span>
            <select
              className="field"
              value={presetId}
              autoFocus
              onChange={(e) => {
                const p = STAGE_PRESETS.find((x) => x.id === e.target.value);
                if (p) onStage(p.w, p.d);
              }}
            >
              {STAGE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              <span className="caption">Width (ft)</span>
              <input
                className="field"
                type="number"
                min={6}
                max={60}
                key={`w${stage.w}`}
                defaultValue={stage.w}
                onBlur={(e) => onStage(+e.target.value, stage.d)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            </label>
            <label className="grid gap-1">
              <span className="caption">Depth (ft)</span>
              <input
                className="field"
                type="number"
                min={6}
                max={40}
                key={`d${stage.d}`}
                defaultValue={stage.d}
                onBlur={(e) => onStage(stage.w, +e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            </label>
          </div>
          <label className="check w-fit">
            <input type="checkbox" checked={snap} onChange={(e) => onSnap(e.target.checked)} />
            Snap to 6 in Grid
          </label>
          <div className="border-t border-line pt-3">
            <button
              className="btn btn-sm"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              Clear Stage
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
