"use client";

import { useState } from "react";
import type { Setup } from "@/lib/library";

/** Save the whole stage as a setup, and drop saved ones onto any plot. */
export function SetupsPanel({
  setups,
  stageEmpty,
  onSave,
  onDrop,
  onRename,
  onDelete,
}: {
  setups: Setup[];
  stageEmpty: boolean;
  onSave: (name: string) => void;
  onDrop: (id: string, replace: boolean) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <div className="scroll">
      <form
        className="grid gap-1.5 border-b border-ink px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (stageEmpty) return;
          onSave(name);
          setName("");
        }}
      >
        <label className="caption" htmlFor="setup-name">
          Save This Stage
        </label>
        <div className="flex gap-2">
          <input
            id="setup-name"
            className="field min-w-0 flex-1"
            placeholder="Full Backline, Acoustic Duo…"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={stageEmpty}>
            Save
          </button>
        </div>
        {stageEmpty && <span className="text-xs text-muted">Plop some gear first, then save it here.</span>}
      </form>

      {setups.length === 0 ? (
        <p className="m-0 p-4 text-muted">
          Save a whole stage, like your full backline or an acoustic duo, then drop it onto any plot in one go. Setups
          save in this browser for now.
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-3">
          {setups.map((s) => (
            <li key={s.id} className="grid gap-2 border border-ink bg-paper p-3">
              {renaming === s.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = new FormData(e.currentTarget).get("name");
                    if (typeof v === "string" && v.trim()) onRename(s.id, v);
                    setRenaming(null);
                  }}
                >
                  <input
                    name="name"
                    className="field min-w-0 flex-1"
                    aria-label="Setup Name"
                    defaultValue={s.name}
                    maxLength={60}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setRenaming(null);
                      }
                    }}
                  />
                  <button type="submit" className="btn btn-sm self-center">
                    Save
                  </button>
                </form>
              ) : (
                <div>
                  <div className="font-display text-base leading-5 font-bold tracking-tight">{s.name}</div>
                  <div className="text-xs text-muted">
                    {s.items.length} {s.items.length === 1 ? "piece" : "pieces"} · saved on {s.stage.w} × {s.stage.d} ft
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                <button className="btn btn-sm btn-primary" onClick={() => onDrop(s.id, false)}>
                  Add to Stage
                </button>
                <button className="btn btn-sm" onClick={() => onDrop(s.id, true)}>
                  Replace Stage
                </button>
                <button className="btn btn-sm" onClick={() => setRenaming(s.id)}>
                  Rename
                </button>
                {confirmDelete === s.id ? (
                  <button
                    className="btn btn-sm bg-yellow"
                    onClick={() => {
                      onDelete(s.id);
                      setConfirmDelete(null);
                    }}
                    onBlur={() => setConfirmDelete(null)}
                    autoFocus
                  >
                    Yes, Delete
                  </button>
                ) : (
                  <button className="btn btn-sm" onClick={() => setConfirmDelete(s.id)}>
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
