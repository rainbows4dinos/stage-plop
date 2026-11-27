"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { GEAR, LIBRARY_ORDER, defOf, type CustomGear, type GearDef } from "@/lib/gear";
import { rigKey, type RigEntry, type Setup } from "@/lib/library";
import { searchGear } from "@/lib/search";
import { CustomGearForm } from "./custom-gear-form";
import { SetupsPanel } from "./setups-panel";

const CATALOG: RigEntry[] = Object.keys(GEAR).map((type) => ({ type }));

type Option = { key: string; entry: RigEntry; def: GearDef; removable?: boolean };
type Section = { title: string; options: Option[] };

/** When set, the drawer shows the custom piece form instead of the list. */
export type CustomFormState = { editId?: number; initial?: CustomGear; name?: string } | null;

const toOption = (entry: RigEntry, prefix: string, removable = false): Option | null => {
  const def = defOf(entry);
  return def ? { key: `${prefix}-${rigKey(entry)}`, entry, def, removable } : null;
};

/**
 * Add Gear: search first, browse second, plus saved setups on their own tab.
 * Slides over the stage on desktop and comes up as a bottom sheet on phones.
 * Plopping keeps it open so you can add a whole backline in a row.
 */
export function GearDrawer({
  open,
  rig,
  setups,
  stageEmpty,
  customForm,
  onPlop,
  onRemoveFromRig,
  onCustom,
  onCustomForm,
  onSaveSetup,
  onDropSetup,
  onRenameSetup,
  onDeleteSetup,
  onClose,
}: {
  open: boolean;
  rig: RigEntry[];
  setups: Setup[];
  stageEmpty: boolean;
  customForm: CustomFormState;
  onPlop: (entry: RigEntry) => void;
  onRemoveFromRig: (key: string) => void;
  onCustom: (c: CustomGear, editId?: number) => void;
  onCustomForm: (state: CustomFormState) => void;
  onSaveSetup: (name: string) => void;
  onDropSetup: (id: string, replace: boolean) => void;
  onRenameSetup: (id: string, name: string) => void;
  onDeleteSetup: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"gear" | "setups">("gear");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  const sections: Section[] = useMemo(() => {
    const opts = (entries: RigEntry[], prefix: string, removable = false) =>
      entries.map((e) => toOption(e, prefix, removable)).filter((o): o is Option => !!o);
    if (query.trim()) {
      // your custom pieces are searchable alongside the catalog
      const pool = opts([...rig.filter((e) => e.type === "custom"), ...CATALOG], "r");
      const byDef = new Map(pool.map((o) => [o.def, o]));
      return [{ title: "Results", options: searchGear(query, [...byDef.keys()]).map((d) => byDef.get(d)!) }];
    }
    return [
      { title: "Your Rig", options: opts(rig, "rig", true) },
      ...LIBRARY_ORDER.map((cat) => ({
        title: cat,
        options: opts(
          CATALOG.filter((e) => GEAR[e.type].cat === cat),
          cat,
        ),
      })),
    ];
  }, [query, rig]);
  const options = sections.flatMap((s) => s.options);
  const current = Math.min(active, Math.max(0, options.length - 1));
  const optionId = (i: number) => `${uid}-opt-${i}`;

  useEffect(() => {
    if (open && !customForm && tab === "gear") inputRef.current?.focus();
  }, [open, customForm, tab]);

  // Keep the highlighted option in view while arrowing through.
  useEffect(() => {
    document.getElementById(optionId(current))?.scrollIntoView({ block: "nearest" });
    // optionId is stable for a given uid
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive(Math.min(current + 1, options.length - 1));
    else if (e.key === "ArrowUp") setActive(Math.max(current - 1, 0));
    else if (e.key === "Enter" && options[current]) onPlop(options[current].entry);
    else if (e.key === "Escape") onClose();
    else return;
    e.preventDefault();
  };

  const title = customForm ? (customForm.editId ? "Edit Custom Piece" : "Make a Custom Piece") : "Add Gear";
  const makeCustom = () => onCustomForm({ name: query.trim() });
  const t = open ? 0 : -1;

  let i = -1;
  return (
    <div
      className="drawer"
      data-open={open}
      role="dialog"
      aria-label={title}
      aria-hidden={!open}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        if (customForm) {
          e.preventDefault();
          onCustomForm(null);
        } else if (tab === "setups") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className="panel-head">
        <h2 className="h2">{title}</h2>
        <button className="btn btn-sm" onClick={onClose} tabIndex={t}>
          {customForm ? "Close" : "Done"}
        </button>
      </div>
      {customForm ? (
        <CustomGearForm
          key={customForm.editId ?? "new"}
          initial={customForm.initial}
          initialName={customForm.name}
          onSubmit={(c) => onCustom(c, customForm.editId)}
          onCancel={() => onCustomForm(null)}
        />
      ) : (
        <>
          <div className="px-4 pt-3">
            <div className="seg seg-sm flex w-full" role="tablist" aria-label="Add Gear">
              {(["gear", "setups"] as const).map((k) => (
                <button
                  key={k}
                  role="tab"
                  className="flex-1"
                  aria-selected={tab === k}
                  tabIndex={t}
                  onClick={() => setTab(k)}
                >
                  {k === "gear" ? "Gear" : `Setups${setups.length ? ` (${setups.length})` : ""}`}
                </button>
              ))}
            </div>
          </div>
          {tab === "setups" ? (
            <SetupsPanel
              setups={setups}
              stageEmpty={stageEmpty}
              onSave={onSaveSetup}
              onDrop={onDropSetup}
              onRename={onRenameSetup}
              onDelete={onDeleteSetup}
            />
          ) : (
            <>
              <div className="grid gap-1.5 border-b border-ink px-4 py-3">
                <input
                  ref={inputRef}
                  className="field w-full"
                  type="search"
                  role="combobox"
                  aria-label="Search Gear"
                  aria-expanded="true"
                  aria-controls={`${uid}-list`}
                  aria-activedescendant={options.length ? optionId(current) : undefined}
                  placeholder="Search gear, brands, nicknames"
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  tabIndex={t}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                />
                <span className="caption max-[1000px]:hidden">↑↓ Choose · Enter Plops · Esc Closes</span>
              </div>
              <div className="scroll" id={`${uid}-list`} role="listbox" aria-label="Gear">
                {options.length === 0 && (
                  <div className="grid gap-3 p-4">
                    <p className="m-0 text-muted">
                      Nothing matches “{query.trim()}”. Try a brand, a nickname like “fridge”, or a category like
                      “keys”. Or make it yourself:
                    </p>
                    <div>
                      <button className="btn btn-primary" onClick={makeCustom}>
                        Make “{query.trim()}”
                      </button>
                    </div>
                  </div>
                )}
                {sections.map((s) =>
                  s.options.length ? (
                    <section key={s.title} role="group" aria-label={s.title}>
                      <div className="caption flex items-baseline justify-between px-4 pt-3 pb-1">
                        {s.title}
                        {s.title === "Your Rig" && <span>Newest First</span>}
                      </div>
                      <div className="px-2 pb-2">
                        {s.options.map((o) => {
                          i++;
                          const idx = i;
                          const showCat = s.title === "Results" || s.title === "Your Rig";
                          return (
                            <div key={o.key} className="flex items-center gap-1">
                              <div
                                id={optionId(idx)}
                                role="option"
                                aria-selected={idx === current}
                                className="gear-option min-w-0 flex-1"
                                onMouseMove={() => idx !== current && setActive(idx)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => onPlop(o.entry)}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">{o.def.name}</span>
                                  <span className="block text-xs leading-4 text-muted">
                                    {o.def.note}
                                    {showCat && !o.def.custom ? ` · ${o.def.cat}` : ""}
                                  </span>
                                </span>
                                <span className="plop" aria-hidden="true">
                                  +
                                </span>
                              </div>
                              {o.removable && (
                                <button
                                  className="rig-remove"
                                  tabIndex={-1}
                                  aria-label={`Remove ${o.def.name} From Your Rig`}
                                  title="Remove From Your Rig"
                                  onClick={() => onRemoveFromRig(rigKey(o.entry))}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : null,
                )}
                {options.length > 0 && (
                  <div className="border-t border-line px-4 py-3">
                    <button className="btn btn-sm" onClick={makeCustom} tabIndex={t}>
                      Can&apos;t Find It? Make a Custom Piece
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
