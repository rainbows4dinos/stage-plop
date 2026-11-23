"use client";

import { useEffect, useRef, useState } from "react";
import { GEAR } from "@/lib/gear";
import {
  EXAMPLE_PLOT,
  STAGE_PRESETS,
  clampStage,
  computeInputs,
  inputListText,
  parsePlot,
  type Plot,
} from "@/lib/plot";
import { ANGLES, StageEngine, type ViewMode } from "@/lib/stage/engine";
import { setMuted } from "@/lib/stage/sound";
import { GearLibrary } from "./gear-library";
import { InputList } from "./input-list";

// Plots save in this browser for now. Shareable links come with Supabase.
const STORAGE_KEY = "stage-plop-v1";
const DISPLAY_FONT = '"Hanken Grotesk Variable", sans-serif';

export function StagePlop() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef<HTMLButtonElement>(null);
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
  const [tab, setTab] = useState<"gear" | "inputs">("gear");
  const [toast, setToast] = useState<string | null>(null);

  const selected = plot.items.find((i) => i.id === selectedId) ?? null;
  const presetId = STAGE_PRESETS.find((p) => p.w === plot.stage.w && p.d === plot.stage.d)?.id ?? "custom";

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

  // Keyboard: R rotates, Delete removes, arrows nudge, Escape deselects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine || selectedId === null) return;
      if ((e.target as HTMLElement).closest("input, select, textarea")) return;
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

      <aside className="panel panel-gear" aria-label="Stage and Gear" data-hidden={tab !== "gear"}>
        <span
          className="tape tape-magenta"
          style={{ top: -14, right: -12, transform: "rotate(7deg)" }}
          aria-hidden="true"
        />
        <div className="panel-head">
          <h2 className="h2">Stage</h2>
          <button
            className="btn btn-sm"
            onClick={() => {
              engineRef.current?.clear();
              say("Stage Cleared");
            }}
          >
            Clear Stage
          </button>
        </div>
        <div className="stage-settings">
          <label className="grid gap-1">
            <span className="caption">Size</span>
            <select
              className="field"
              value={presetId}
              onChange={(e) => {
                const p = STAGE_PRESETS.find((x) => x.id === e.target.value);
                if (p) setStage(p.w, p.d);
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
                key={`w${plot.stage.w}`}
                defaultValue={plot.stage.w}
                onBlur={(e) => setStage(+e.target.value, plot.stage.d)}
              />
            </label>
            <label className="grid gap-1">
              <span className="caption">Depth (ft)</span>
              <input
                className="field"
                type="number"
                min={6}
                max={40}
                key={`d${plot.stage.d}`}
                defaultValue={plot.stage.d}
                onBlur={(e) => setStage(plot.stage.w, +e.target.value)}
              />
            </label>
          </div>
          <div>
            <label className="check">
              <input
                type="checkbox"
                checked={snap}
                onChange={(e) => {
                  engineRef.current?.setSnap(e.target.checked);
                  setSnap(e.target.checked);
                }}
              />
              Snap to 6 in Grid
            </label>
          </div>
        </div>
        <div className="panel-head">
          <h2 className="h2">Gear</h2>
          <span className="caption">Tap to Plop</span>
        </div>
        <GearLibrary onPlop={(id) => engineRef.current?.plop(id)} />
      </aside>

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
          <div className="stage-top">
            <div className="flex flex-wrap items-center gap-2">
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
              <span className="tag">
                {plot.stage.w} × {plot.stage.d} ft
              </span>
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
              ? "drag to move · drag the dot to rotate · arrows nudge"
              : "drag the floor to spin · Plot for fine moves"}
          </div>
          <button className="rot-handle" ref={rotRef} aria-label="Drag to Rotate" hidden>
            ↻
          </button>
          {selected && (
            <div className="inspector">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-base leading-5 font-bold tracking-tight">
                  {GEAR[selected.type].name}
                </span>
                <span className="caption text-right">{GEAR[selected.type].note}</span>
              </div>
              <input
                className="field w-full"
                aria-label="Label"
                value={selected.label}
                onChange={(e) => engineRef.current?.update(selected.id, { label: e.target.value })}
                onBlur={(e) => {
                  if (!e.target.value.trim())
                    engineRef.current?.update(selected.id, { label: GEAR[selected.type].base });
                }}
              />
              {GEAR[selected.type].handed && (
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
        </div>
      </main>

      <div className="tabs">
        <div className="seg" role="group" aria-label="Panels">
          <button aria-pressed={tab === "gear"} onClick={() => setTab("gear")}>
            Gear
          </button>
          <button aria-pressed={tab === "inputs"} onClick={() => setTab("inputs")}>
            Inputs
          </button>
        </div>
      </div>

      <aside className="panel panel-inputs" aria-label="Input List" data-hidden={tab !== "inputs"}>
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
