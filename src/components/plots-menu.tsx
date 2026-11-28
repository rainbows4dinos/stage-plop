"use client";

import { useEffect, useRef, useState } from "react";
import type { LocalPlot } from "@/lib/local-plots";

/** The plots kept in this browser: switch between them, start a new one, forget one. */
export function PlotsMenu({
  plots,
  current,
  onSwitch,
  onNew,
  onRemove,
}: {
  plots: LocalPlot[];
  current: string;
  onSwitch: (key: string) => void;
  onNew: () => void;
  onRemove: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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

  const sorted = [...plots].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={triggerRef}
        className="btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        Your Plots
        <svg width="10" height="7" viewBox="0 0 12 8" aria-hidden="true">
          <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
      {open && (
        <div className="popover popover-right w-[min(340px,calc(100vw-24px))]" role="dialog" aria-label="Your Plots">
          <div className="flex items-center justify-between gap-2">
            <h2 className="h2">Your Plots</h2>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                onNew();
                setOpen(false);
              }}
            >
              New Plot
            </button>
          </div>
          <ul className="m-0 grid max-h-[50svh] list-none gap-1 overflow-y-auto p-0">
            {sorted.map((p) => {
              const isCurrent = p.key === current;
              return (
                <li
                  key={p.key}
                  className={`flex items-center gap-1 border ${isCurrent ? "border-ink" : "border-transparent"}`}
                >
                  <button
                    className="min-w-0 flex-1 cursor-pointer px-2 py-1.5 text-left hover:bg-[var(--paper-photo)]"
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={() => {
                      onSwitch(p.key);
                      setOpen(false);
                    }}
                  >
                    <span className="block truncate font-medium">{p.plot.band || "Untitled Plot"}</span>
                    <span className="block text-xs text-muted">
                      {p.plot.items.length} pieces · {p.plot.stage.w} × {p.plot.stage.d} ft ·{" "}
                      {new Date(p.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      {p.link ? " · Shared" : ""}
                    </span>
                  </button>
                  {confirm === p.key ? (
                    <button
                      className="btn btn-sm mr-1 bg-yellow"
                      autoFocus
                      onBlur={() => setConfirm(null)}
                      onClick={() => {
                        onRemove(p.key);
                        setConfirm(null);
                      }}
                    >
                      {p.link ? "Forget Here" : "Delete"}
                    </button>
                  ) : (
                    <button
                      className="rig-remove mr-1"
                      aria-label={`Remove ${p.plot.band || "Untitled Plot"}`}
                      title={p.link ? "Forget in this browser (stays online)" : "Delete"}
                      onClick={() => setConfirm(p.key)}
                    >
                      ×
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="m-0 text-xs text-muted">
            Plots live in this browser. Shared plots also live online, and their edit link brings them back anywhere.
          </p>
        </div>
      )}
    </div>
  );
}
