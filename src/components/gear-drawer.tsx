"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { GEAR, LIBRARY_ORDER, type GearDef } from "@/lib/gear";
import { searchGear } from "@/lib/search";

const CATALOG = Object.values(GEAR);

type Section = { title: string; gear: GearDef[] };

/**
 * Add Gear: search first, browse second. Slides over the stage on desktop and
 * comes up as a bottom sheet on phones. Plopping keeps it open so you can add
 * a whole backline in a row; Escape closes it.
 */
export function GearDrawer({
  open,
  recent,
  onPlop,
  onClose,
}: {
  open: boolean;
  recent: string[];
  onPlop: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  const sections: Section[] = useMemo(() => {
    if (query.trim()) return [{ title: "Results", gear: searchGear(query, CATALOG) }];
    const recentGear = recent.map((id) => GEAR[id]).filter(Boolean);
    return [
      ...(recentGear.length ? [{ title: "Recent", gear: recentGear }] : []),
      ...LIBRARY_ORDER.map((cat) => ({ title: cat, gear: CATALOG.filter((g) => g.cat === cat) })),
    ];
  }, [query, recent]);
  const options = sections.flatMap((s) => s.gear.map((g) => ({ g, key: `${s.title}-${g.id}` })));
  const current = Math.min(active, Math.max(0, options.length - 1));
  const optionId = (i: number) => `${uid}-opt-${i}`;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted option in view while arrowing through.
  useEffect(() => {
    document.getElementById(optionId(current))?.scrollIntoView({ block: "nearest" });
    // optionId is stable for a given uid
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive(Math.min(current + 1, options.length - 1));
    else if (e.key === "ArrowUp") setActive(Math.max(current - 1, 0));
    else if (e.key === "Enter" && options[current]) onPlop(options[current].g.id);
    else if (e.key === "Escape") onClose();
    else return;
    e.preventDefault();
  };

  let i = -1;
  return (
    <div className="drawer" data-open={open} role="dialog" aria-label="Add Gear" aria-hidden={!open}>
      <div className="panel-head">
        <h2 className="h2">Add Gear</h2>
        <button className="btn btn-sm" onClick={onClose} tabIndex={open ? 0 : -1}>
          Done
        </button>
      </div>
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
          tabIndex={open ? 0 : -1}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <span className="caption max-[1000px]:hidden">↑↓ Choose · Enter Plops · Esc Closes</span>
      </div>
      <div className="scroll" id={`${uid}-list`} role="listbox" aria-label="Gear" ref={listRef}>
        {options.length === 0 && (
          <p className="m-0 p-4 text-muted">
            Nothing matches “{query.trim()}”. Try a brand, a nickname like “fridge”, or a category like “keys”.
          </p>
        )}
        {sections.map((s) =>
          s.gear.length ? (
            <section key={s.title} role="group" aria-label={s.title}>
              <div className="caption px-4 pt-3 pb-1">{s.title}</div>
              <div className="px-2 pb-2">
                {s.gear.map((g) => {
                  i++;
                  const idx = i;
                  return (
                    <div
                      key={`${s.title}-${g.id}`}
                      id={optionId(idx)}
                      role="option"
                      aria-selected={idx === current}
                      className="gear-option"
                      onMouseMove={() => idx !== current && setActive(idx)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onPlop(g.id)}
                    >
                      <span>
                        <span className="block font-medium">{g.name}</span>
                        <span className="block text-xs leading-4 text-muted">
                          {g.note}
                          {s.title === "Results" || s.title === "Recent" ? ` · ${g.cat}` : ""}
                        </span>
                      </span>
                      <span className="plop" aria-hidden="true">
                        +
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null,
        )}
      </div>
    </div>
  );
}
