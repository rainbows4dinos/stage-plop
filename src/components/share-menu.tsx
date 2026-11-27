"use client";

import { useEffect, useRef, useState } from "react";
import type { PlotLink } from "@/lib/local-plots";
import { editPath, viewPath } from "@/lib/share";

export type SaveStatus = { state: "idle" | "saving" | "saved" } | { state: "error"; message: string };

/** Header button: make share links, copy them, see whether changes are saved online. */
export function ShareMenu({
  link,
  status,
  onShare,
  onNewEditLink,
  onRetry,
}: {
  link?: PlotLink;
  status: SaveStatus;
  onShare: () => Promise<void>;
  onNewEditLink: () => Promise<void>;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"view" | "edit" | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

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

  const copy = async (which: "view" | "edit", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 1600);
    } catch {
      // the field is selectable as a fallback
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const viewUrl = link ? origin + viewPath(link.id) : "";
  const editUrl = link ? origin + editPath(link.id, link.token) : "";

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={triggerRef}
        className="btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        Share
        {link && <SaveDot status={status} />}
      </button>
      {open && (
        <div className="popover popover-right w-[min(360px,calc(100vw-24px))]" role="dialog" aria-label="Share">
          {!link ? (
            <>
              <h2 className="h2">Share This Plot</h2>
              <p className="m-0">
                Get a link venues and engineers can open, and a separate link for your band to keep editing. No account
                needed.
              </p>
              {status.state === "error" && (
                <p className="m-0 border border-ink bg-yellow px-3 py-2" role="alert">
                  {status.message}
                </p>
              )}
              <div>
                <button className="btn btn-primary" disabled={busy} onClick={() => run(onShare)}>
                  {busy ? "Making Links…" : "Make Share Links"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="h2">Share</h2>
                <SaveLine status={status} onRetry={onRetry} />
              </div>
              {status.state === "error" && (
                <p className="m-0 border border-ink bg-yellow px-3 py-2 text-xs" role="alert">
                  {status.message}
                </p>
              )}
              <LinkField
                label="View Link"
                hint="For venues and engineers. They can look, not change."
                url={viewUrl}
                copied={copied === "view"}
                onCopy={() => copy("view", viewUrl)}
                openHref={viewPath(link.id)}
              />
              <LinkField
                label="Edit Link"
                hint="For your band. Anyone with this link can change the plot."
                url={editUrl}
                copied={copied === "edit"}
                onCopy={() => copy("edit", editUrl)}
              />
              <div className="border-t border-line pt-3">
                {confirmNew ? (
                  <div className="grid gap-2">
                    <p className="m-0 text-xs">
                      The current edit link will stop working. Your view link stays the same.
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-sm bg-yellow"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await onNewEditLink();
                            setConfirmNew(false);
                          })
                        }
                      >
                        Make New Edit Link
                      </button>
                      <button className="btn btn-sm" onClick={() => setConfirmNew(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="btn btn-sm" onClick={() => setConfirmNew(true)}>
                    Make a New Edit Link…
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LinkField({
  label,
  hint,
  url,
  copied,
  onCopy,
  openHref,
}: {
  label: string;
  hint: string;
  url: string;
  copied: boolean;
  onCopy: () => void;
  openHref?: string;
}) {
  return (
    <div className="grid gap-1">
      <span className="caption">{label}</span>
      <div className="flex gap-1.5">
        <input
          className="field min-w-0 flex-1 text-xs"
          readOnly
          value={url}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button className="btn btn-sm self-center" onClick={onCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <span className="text-xs text-muted">
        {hint}{" "}
        {openHref && (
          <a href={openHref} target="_blank" rel="noopener" className="text-ink underline">
            Open It
          </a>
        )}
      </span>
    </div>
  );
}

function SaveDot({ status }: { status: SaveStatus }) {
  const color = status.state === "error" ? "bg-yellow" : status.state === "saving" ? "bg-cyan" : "bg-ink";
  return <span className={`inline-block h-2 w-2 border border-ink ${color}`} aria-hidden="true" />;
}

function SaveLine({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status.state === "saving") return <span className="caption">Saving…</span>;
  if (status.state === "error")
    return (
      <span className="caption text-right normal-case" role="status">
        Not saved online.{" "}
        <button className="underline" onClick={onRetry}>
          Retry
        </button>
      </span>
    );
  return (
    <span className="caption" role="status">
      Saved Online
    </span>
  );
}
