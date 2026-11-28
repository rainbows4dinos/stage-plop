"use client";

import { useEffect, useRef, useState } from "react";
import { defOf, type CustomGear } from "@/lib/gear";
import { EXAMPLE_PLOT, clampStage, computeInputs, inputListText, type Plot } from "@/lib/plot";
import {
  LEGACY_PLOT_KEY,
  PLOTS_KEY,
  addPlot,
  blankPlot,
  currentOf,
  hasUnsaved,
  openShared,
  parseLocal,
  removePlot,
  switchTo,
  updateCurrent,
  type LocalPlot,
  type LocalState,
} from "@/lib/local-plots";
import { ANGLES, StageEngine, type ViewMode } from "@/lib/stage/engine";
import { setMuted } from "@/lib/stage/sound";
import {
  SETUPS_MAX,
  addToRig,
  makeSetup,
  parseRig,
  parseSetups,
  placeSetup,
  removeFromRig,
  type RigEntry,
  type Setup,
} from "@/lib/library";
import { GearDrawer, type CustomFormState } from "./gear-drawer";
import { InputList } from "./input-list";
import { PlotsMenu } from "./plots-menu";
import { ShareMenu, type SaveStatus } from "./share-menu";
import { StageSettings } from "./stage-settings";

// Plots live in this browser; shared ones also live online (see src/lib/share.ts).
const AUTOSAVE_MS = 1200;
const RIG_KEY = "stage-plop-rig";
const SETUPS_KEY = "stage-plop-setups";
/** Before Your Rig there was a short Recent list; its ids seed the rig once. */
const OLD_RECENT_KEY = "stage-plop-recent";

const readJSON = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
};
const writeJSON = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};
const DISPLAY_FONT = '"Hanken Grotesk Variable", sans-serif';

/** A shared plot as it is online, or null when it can't be fetched. */
async function fetchShared(id: string): Promise<{ plot: Plot; updatedAt: string } | null> {
  try {
    const res = await fetch(`/api/plots/${id}`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export function StagePlop() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef<HTMLButtonElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<StageEngine | null>(null);

  const [plot, setPlot] = useState<Plot>(EXAMPLE_PLOT);
  const [ready, setReady] = useState(false);
  const [noGL, setNoGL] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<ViewMode>("plot");
  const [angle, setAngle] = useState<string>(ANGLES[0]);
  const [snap, setSnap] = useState(true);
  const [labels, setLabels] = useState(true);
  const [sound, setSound] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [rig, setRig] = useState<RigEntry[]>([]);
  const [setups, setSetups] = useState<Setup[]>([]);
  const [customForm, setCustomForm] = useState<CustomFormState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [local, setLocal] = useState<LocalState | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: "idle" });
  const current = local ? currentOf(local) : null;

  const selected = plot.items.find((i) => i.id === selectedId) ?? null;
  const selectedDef = selected ? defOf(selected) : undefined;

  // Start the engine once fonts are in (the AUDIENCE floor text is drawn with them).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.race([document.fonts.load(`800 150px ${DISPLAY_FONT}`), new Promise((r) => setTimeout(r, 1500))]);
      } catch {}
      if (cancelled || !viewportRef.current || !labelsRef.current || !rotRef.current) return;
      const storedPlots = readJSON(PLOTS_KEY);
      const legacy = readJSON(LEGACY_PLOT_KEY);
      const startLocal = parseLocal(storedPlots, legacy);
      const initial = currentOf(startLocal).plot;
      // Your Rig: what's been saved, plus gear on your own plots (the example doesn't count).
      const oldRecent = readJSON(OLD_RECENT_KEY);
      const ownPlots = storedPlots || legacy ? startLocal.plots.map((p) => p.plot) : [];
      setRig(
        parseRig([
          ...((readJSON(RIG_KEY) as unknown[] | null) ?? []),
          ...(Array.isArray(oldRecent) ? oldRecent.map((type) => ({ type })) : []),
          ...ownPlots.flatMap((pl) => pl.items.map(({ type, custom }) => ({ type, custom }))),
        ]),
      );
      setSetups(parseSetups(readJSON(SETUPS_KEY)));
      let engine: StageEngine;
      try {
        engine = new StageEngine(
          viewportRef.current,
          labelsRef.current,
          rotRef.current,
          {
            onChange: (items) => setPlot((p) => ({ ...p, items })),
            onSelect: setSelectedId,
            onAngle: setAngle,
          },
          DISPLAY_FONT,
        );
      } catch {
        setNoGL(true);
        return;
      }
      engine.load(initial.items, initial.stage);
      engineRef.current = engine;
      setPlot(initial);
      setLocal(startLocal);
      setReady(true);
      // A shared plot may have changed online since this browser last saw it.
      const cur = currentOf(startLocal);
      if (cur.link) {
        const fresh = await fetchShared(cur.link.id);
        if (!cancelled && fresh && fresh.updatedAt !== cur.serverUpdatedAt && !cur.unsaved) {
          const next = openShared(startLocal, cur.link, fresh.plot, fresh.updatedAt);
          engine.load(currentOf(next).plot.items, currentOf(next).plot.stage);
          setPlot(currentOf(next).plot);
          setLocal(next);
        }
      }
    })();
    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Edits to the working plot go into the plot list (and mark shared plots unsaved).
  useEffect(() => {
    if (!ready || !current || plot === current.plot) return;
    const t = setTimeout(() => setLocal((s) => s && updateCurrent(s, { plot })), 250);
    return () => clearTimeout(t);
  }, [plot, ready, current]);

  // Keep the plot list in this browser.
  useEffect(() => {
    if (local) writeJSON(PLOTS_KEY, local);
  }, [local]);

  // Shared plots save online a moment after each change.
  const saveOnline = async (lp: LocalPlot) => {
    if (!lp.link) return;
    setSaveStatus({ state: "saving" });
    const stamp = lp.updatedAt;
    try {
      const res = await fetch(`/api/plots/${lp.link.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lp.link.token}` },
        body: JSON.stringify({ plot: lp.plot }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          res.status === 401
            ? "This edit link was replaced. Ask whoever made the new one to send it."
            : (body.error ?? "Couldn't reach the server. Your changes are kept in this browser.");
        setSaveStatus({ state: "error", message });
        return;
      }
      setLocal((s) =>
        s
          ? {
              ...s,
              plots: s.plots.map((p) =>
                p.key === lp.key
                  ? { ...p, serverUpdatedAt: body.updatedAt, unsaved: p.updatedAt === stamp ? false : p.unsaved }
                  : p,
              ),
            }
          : s,
      );
      setSaveStatus({ state: "saved" });
    } catch {
      setSaveStatus({ state: "error", message: "You're offline. Your changes are kept in this browser." });
    }
  };
  useEffect(() => {
    if (!current || !hasUnsaved(current)) return;
    const t = setTimeout(() => saveOnline(current), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [current]);

  // Save before the tab closes if there's anything pending.
  useEffect(() => {
    const flush = () => {
      if (!current || !hasUnsaved(current) || !current.link) return;
      fetch(`/api/plots/${current.link.id}`, {
        method: "PUT",
        keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${current.link.token}` },
        body: JSON.stringify({ plot: current.plot }),
      }).catch(() => {});
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [current]);

  // The tip button floats bottom right; tuck it away while Add Gear is open so it
  // never covers gear in the bottom sheet on phones.
  useEffect(() => {
    document.body.toggleAttribute("data-drawer-open", drawer);
    return () => document.body.removeAttribute("data-drawer-open");
  }, [drawer]);

  // While the drawer covers the stage on desktop, center the view in what's left.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const update = () => {
      const wide = window.matchMedia("(min-width: 1001px)").matches;
      const w = viewportRef.current?.clientWidth ?? 0;
      engine.setInsetLeft(drawer && wide ? Math.min(360, w) : 0);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [drawer, ready]);

  // Keyboard: / adds gear, R rotates, Delete removes, arrows nudge, Escape deselects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      if ((e.target as HTMLElement).closest("input, select, textarea, [role=dialog]")) return;
      // Leave Cmd/Ctrl/Option combos to the browser and OS (Cmd+R reloads, Cmd+← goes back…).
      // Shift is fine: Shift+R and Shift+arrows are ours.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setDrawer(true);
        return;
      }
      if (selectedId === null) return;
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, 1],
        ArrowDown: [0, -1],
      };
      if (e.key === "r" || e.key === "R") engine.rotateBy(selectedId, ((e.shiftKey ? 1 : -1) * Math.PI) / 4);
      else if (e.key === "Delete" || e.key === "Backspace") engine.remove(selectedId);
      else if (e.key === "Escape") engine.select(null);
      else if (arrows[e.key]) engine.nudge(selectedId, ...arrows[e.key], e.shiftKey ? 2 : 0.5);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const say = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 1800);
  };

  const setStage = (w: number, d: number) => {
    const stage = clampStage(w, d);
    engineRef.current?.setStage(stage.w, stage.d);
    setPlot((p) => ({ ...p, stage }));
  };

  const updateRig = (fn: (r: RigEntry[]) => RigEntry[]) =>
    setRig((r) => {
      const next = fn(r);
      writeJSON(RIG_KEY, next);
      return next;
    });

  const plop = (entry: RigEntry) => {
    engineRef.current?.plop(entry.type, entry.custom);
    updateRig((r) => addToRig(r, [entry]));
  };

  const updateSetups = (fn: (s: Setup[]) => Setup[]) =>
    setSetups((s) => {
      const next = fn(s).slice(0, SETUPS_MAX);
      writeJSON(SETUPS_KEY, next);
      return next;
    });

  const saveSetup = (name: string) => {
    const setup = makeSetup(
      name || `${plot.band || "Band"} Setup`,
      plot.items,
      plot.stage,
      `s${Date.now().toString(36)}`,
    );
    updateSetups((s) => [setup, ...s]);
    say(`Saved ${setup.name}`);
  };

  const dropSetup = (id: string, replace: boolean) => {
    const setup = setups.find((s) => s.id === id);
    const engine = engineRef.current;
    if (!setup || !engine) return;
    const items = placeSetup(setup, plot.stage, replace ? [] : plot.items);
    engine.addItems(items, replace);
    updateRig((r) =>
      addToRig(
        r,
        items.map(({ type, custom }) => ({ type, custom })),
      ),
    );
    const squeezed = setup.stage.w > plot.stage.w || setup.stage.d > plot.stage.d;
    say(squeezed ? `Squeezed ${setup.name} to Fit` : `Dropped ${setup.name}`);
  };

  /* ---------- Plots in this browser ---------- */

  const showPlot = (next: LocalState) => {
    const lp = currentOf(next);
    engineRef.current?.load(lp.plot.items, lp.plot.stage);
    setPlot(lp.plot);
    setLocal(next);
    setSaveStatus({ state: "idle" });
  };

  const sharePlot = async () => {
    try {
      const res = await fetch("/api/plots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plot }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveStatus({ state: "error", message: body.error ?? "Couldn't make links. Try again in a moment." });
        return;
      }
      setLocal(
        (s) =>
          s &&
          updateCurrent(
            s,
            { plot, link: { id: body.id, token: body.token }, serverUpdatedAt: body.updatedAt, unsaved: false },
            false,
          ),
      );
      setSaveStatus({ state: "saved" });
      say("Links Ready");
    } catch {
      setSaveStatus({ state: "error", message: "You're offline. Try again when you're connected." });
    }
  };

  const newEditLink = async () => {
    const link = current?.link;
    if (!link) return;
    const res = await fetch(`/api/plots/${link.id}/token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${link.token}` },
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      say(body?.error ?? "Couldn't make a new link.");
      return;
    }
    setLocal((s) => s && updateCurrent(s, { link: { id: link.id, token: body.token } }, false));
    say("New Edit Link Ready");
  };

  const closeDrawer = () => {
    setDrawer(false);
    setCustomForm(null);
    addRef.current?.focus();
  };

  const saveCustom = (c: CustomGear, editId?: number) => {
    if (editId !== undefined) {
      engineRef.current?.setCustom(editId, c);
      setDrawer(false);
      setCustomForm(null);
      say(`Saved ${c.name}`);
    } else {
      plop({ type: "custom", custom: c });
      setCustomForm(null);
    }
  };

  const changeMode = (m: ViewMode) => {
    engineRef.current?.setMode(m);
    setMode(m);
  };

  const copyInputs = async () => {
    try {
      await navigator.clipboard.writeText(inputListText(plot));
      say(`Copied ${computeInputs(plot.items).length} Inputs`);
    } catch {
      say("Couldn't copy. Check your browser's clipboard permission.");
    }
  };

  return (
    <div className="app">
      <header className="app-head">
        <div className="brand">
          <h1 className="wordmark">
            STAGE <span className="swipe">PLOP</span>
          </h1>
          <span className="tag tag-ink">By Seeens</span>
        </div>
        <div className="head-controls">
          {local && (
            <PlotsMenu
              plots={local.plots}
              current={local.current}
              onSwitch={(key) => showPlot(switchTo(local, key))}
              onNew={() => {
                showPlot(addPlot(local, { plot: blankPlot(plot.stage) }));
                setDrawer(true);
              }}
              onRemove={(key) => {
                const next = removePlot(local, key);
                if (next.current !== local.current) showPlot(next);
                else setLocal(next);
              }}
            />
          )}
          <input
            className="field"
            id="band"
            aria-label="Band Name"
            placeholder="Band Name"
            value={plot.band}
            onChange={(e) => setPlot((p) => ({ ...p, band: e.target.value }))}
          />
          <ShareMenu
            link={current?.link}
            status={saveStatus}
            onShare={sharePlot}
            onNewEditLink={newEditLink}
            onRetry={() => current && saveOnline(current)}
          />
          <button className="btn btn-primary" onClick={copyInputs}>
            Copy Input List
          </button>
        </div>
      </header>

      <main className="stage-wrap">
        <span
          className="tape tape-cyan"
          style={{ top: -12, left: -22, transform: "rotate(-28deg)", zIndex: 6 }}
          aria-hidden="true"
        />
        <div className="window">
          <div className="viewport" ref={viewportRef} />
          <div className="labels" ref={labelsRef} />
          {noGL && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <h2 className="h2">3D Isn&apos;t Available Here</h2>
                <p>This browser couldn&apos;t start WebGL. Try another browser or turn on hardware acceleration.</p>
              </div>
            </div>
          )}
          <div className={`stage-top${drawer ? " beside-drawer" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <button
                ref={addRef}
                className="btn btn-sm btn-primary"
                aria-expanded={drawer}
                aria-keyshortcuts="/"
                onClick={() => (drawer ? closeDrawer() : setDrawer(true))}
              >
                <span aria-hidden="true">+</span> Add Gear
              </button>
              <div className="seg seg-sm" role="group" aria-label="View">
                <button aria-pressed={mode === "plot"} onClick={() => changeMode("plot")}>
                  Plot
                </button>
                <button aria-pressed={mode === "3d"} onClick={() => changeMode("3d")}>
                  3D
                </button>
              </div>
              {mode === "3d" && (
                <div className="seg seg-sm" role="group" aria-label="Camera Angle">
                  <button aria-label="Turn Left" onClick={() => engineRef.current?.turn(-1)}>
                    ←
                  </button>
                  <span className="angle-name">{angle}</span>
                  <button aria-label="Turn Right" onClick={() => engineRef.current?.turn(1)}>
                    →
                  </button>
                </div>
              )}
              <StageSettings
                stage={plot.stage}
                snap={snap}
                onStage={setStage}
                onSnap={(v) => {
                  engineRef.current?.setSnap(v);
                  setSnap(v);
                }}
                onClear={() => {
                  engineRef.current?.clear();
                  say("Stage Cleared");
                }}
              />
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <div className="seg seg-sm" role="group" aria-label="Zoom">
                <button aria-label="Zoom Out" onClick={() => engineRef.current?.zoomBy(1.25)}>
                  −
                </button>
                <button onClick={() => engineRef.current?.fit()}>Fit</button>
                <button aria-label="Zoom In" onClick={() => engineRef.current?.zoomBy(0.8)}>
                  +
                </button>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={labels}
                  onChange={(e) => {
                    engineRef.current?.setShowLabels(e.target.checked);
                    setLabels(e.target.checked);
                  }}
                />
                Labels
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={sound}
                  onChange={(e) => {
                    setMuted(!e.target.checked);
                    setSound(e.target.checked);
                  }}
                />
                Sound
              </label>
            </div>
          </div>
          <div className="hint">
            {mode === "plot"
              ? "/ adds gear · drag to move · drag the dot to rotate"
              : "drag the floor to spin · Plot for fine moves"}
          </div>
          <button className="rot-handle" ref={rotRef} aria-label="Drag to Rotate" hidden>
            ↻
          </button>
          {selected && selectedDef && (
            <div className={`inspector${drawer ? " beside-drawer" : ""}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-base leading-5 font-bold tracking-tight">{selectedDef.name}</span>
                <span className="caption text-right">{selectedDef.note}</span>
              </div>
              <input
                className="field w-full"
                aria-label="Label"
                value={selected.label}
                onChange={(e) => engineRef.current?.update(selected.id, { label: e.target.value })}
                onBlur={(e) => {
                  if (!e.target.value.trim()) engineRef.current?.update(selected.id, { label: selectedDef.base });
                }}
              />
              {selected.custom && (
                <div>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setCustomForm({ editId: selected.id, initial: selected.custom });
                      setDrawer(true);
                    }}
                  >
                    Edit Custom Piece
                  </button>
                </div>
              )}
              {selectedDef.handed && (
                <label className="check w-fit">
                  <input
                    type="checkbox"
                    checked={!!selected.lefty}
                    onChange={(e) => engineRef.current?.setLefty(selected.id, e.target.checked)}
                  />
                  Left-Handed
                </label>
              )}
              <div className="flex gap-1.5">
                <button
                  className="btn btn-sm"
                  aria-label="Rotate Left 45 Degrees"
                  onClick={() => engineRef.current?.rotateBy(selected.id, Math.PI / 4)}
                >
                  ↺ 45°
                </button>
                <button
                  className="btn btn-sm"
                  aria-label="Rotate Right 45 Degrees"
                  onClick={() => engineRef.current?.rotateBy(selected.id, -Math.PI / 4)}
                >
                  ↻ 45°
                </button>
                <button className="btn btn-sm" onClick={() => engineRef.current?.duplicate(selected.id)}>
                  Duplicate
                </button>
                <button className="btn btn-sm" onClick={() => engineRef.current?.remove(selected.id)}>
                  Remove
                </button>
              </div>
            </div>
          )}
          <GearDrawer
            open={drawer}
            rig={rig}
            setups={setups}
            stageEmpty={plot.items.length === 0}
            customForm={customForm}
            onPlop={plop}
            onRemoveFromRig={(key) => updateRig((r) => removeFromRig(r, key))}
            onSaveSetup={saveSetup}
            onDropSetup={dropSetup}
            onRenameSetup={(id, name) =>
              updateSetups((all) => all.map((s) => (s.id === id ? { ...s, name: name.trim().slice(0, 60) } : s)))
            }
            onDeleteSetup={(id) => updateSetups((all) => all.filter((s) => s.id !== id))}
            onCustom={saveCustom}
            onCustomForm={setCustomForm}
            onClose={closeDrawer}
          />
        </div>
      </main>

      <aside className="panel panel-inputs" aria-label="Input List">
        <div className="panel-head">
          <h2 className="h2">Input List</h2>
          <span className="caption">Builds Itself</span>
        </div>
        <InputList items={plot.items} selectedId={selectedId} />
      </aside>

      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
