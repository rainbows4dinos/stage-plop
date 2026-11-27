"use client";

import { useEffect, useRef, useState } from "react";
import { GEAR, defOf, type CustomGear } from "@/lib/gear";
import { EXAMPLE_PLOT, clampStage, computeInputs, inputListText, parsePlot, type Plot } from "@/lib/plot";
import { ANGLES, StageEngine, type ViewMode } from "@/lib/stage/engine";
import { setMuted } from "@/lib/stage/sound";
import { GearDrawer, type CustomFormState } from "./gear-drawer";
import { InputList } from "./input-list";
import { StageSettings } from "./stage-settings";

// Plots save in this browser for now. Shareable links come with Supabase.
const STORAGE_KEY = "stage-plop-v1";
const RECENT_KEY = "stage-plop-recent";
const RECENT_MAX = 6;
const DISPLAY_FONT = '"Hanken Grotesk Variable", sans-serif';

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
  const [recent, setRecent] = useState<string[]>([]);
  const [customForm, setCustomForm] = useState<CustomFormState>(null);
  const [toast, setToast] = useState<string | null>(null);

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
      let saved: Plot | null = null;
      try {
        saved = parsePlot(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
      } catch {}
      const initial = saved ?? EXAMPLE_PLOT;
      try {
        const r = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
        if (Array.isArray(r)) setRecent(r.filter((id) => typeof id === "string" && GEAR[id]).slice(0, RECENT_MAX));
      } catch {}
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
      setReady(true);
    })();
    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Save after each change (this browser only).
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plot));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [plot, ready]);

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
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
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

  const plop = (id: string) => {
    engineRef.current?.plop(id);
    setRecent((r) => {
      const next = [id, ...r.filter((x) => x !== id)].slice(0, RECENT_MAX);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
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
      engineRef.current?.plop("custom", c);
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
          <input
            className="field"
            id="band"
            aria-label="Band Name"
            placeholder="Band Name"
            value={plot.band}
            onChange={(e) => setPlot((p) => ({ ...p, band: e.target.value }))}
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
            recent={recent}
            customForm={customForm}
            onPlop={plop}
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
