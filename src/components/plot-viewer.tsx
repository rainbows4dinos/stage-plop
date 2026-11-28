"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { computeInputs, inputListText, type Plot } from "@/lib/plot";
import { ANGLES, StageEngine, type ViewMode } from "@/lib/stage/engine";
import { setMuted } from "@/lib/stage/sound";
import { InputList } from "./input-list";

const DISPLAY_FONT = '"Hanken Grotesk Variable", sans-serif';

/** The view link: the plot and input list, look-only. Built for an engineer on a phone. */
export function PlotViewer({ plot, updatedAt }: { plot: Plot; updatedAt: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<StageEngine | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<ViewMode>("plot");
  const [angle, setAngle] = useState<string>(ANGLES[0]);
  const [noGL, setNoGL] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputs = computeInputs(plot.items);

  useEffect(() => {
    let cancelled = false;
    setMuted(true); // nobody wants a plop when opening an email link
    (async () => {
      try {
        await Promise.race([document.fonts.load(`800 150px ${DISPLAY_FONT}`), new Promise((r) => setTimeout(r, 1500))]);
      } catch {}
      if (cancelled || !viewportRef.current || !labelsRef.current || !rotRef.current) return;
      try {
        const engine = new StageEngine(
          viewportRef.current,
          labelsRef.current,
          rotRef.current,
          { onChange: () => {}, onSelect: setSelectedId, onAngle: setAngle },
          DISPLAY_FONT,
          true,
        );
        engine.load(plot.items, plot.stage);
        engineRef.current = engine;
      } catch {
        setNoGL(true);
      }
    })();
    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [plot]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inputListText(plot));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const changeMode = (m: ViewMode) => {
    engineRef.current?.setMode(m);
    setMode(m);
  };

  return (
    <div className="app">
      <header className="app-head">
        <div className="brand">
          <div>
            <div className="caption">Stage Plot</div>
            <h1 className="font-display m-0 text-[32px] leading-9 font-extrabold tracking-[-0.04em] max-[1000px]:text-[26px] max-[1000px]:leading-8">
              {plot.band || "Untitled Band"}
            </h1>
            <div className="text-xs text-muted">
              {plot.stage.w} × {plot.stage.d} ft stage · {inputs.length} inputs · updated{" "}
              {new Date(updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>
        <div className="head-controls">
          <button className="btn btn-primary" onClick={copy}>
            {copied ? "Copied" : "Copy Input List"}
          </button>
          <Link className="btn" href="/">
            Make Your Own
          </Link>
        </div>
      </header>

      <main className="stage-wrap">
        <div className="window">
          <div className="viewport" ref={viewportRef} />
          <div className="labels" ref={labelsRef} />
          {noGL && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <p>This browser can&apos;t show the 3D stage. The input list has everything the engineer needs.</p>
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
            </div>
          </div>
          <div className="hint">tap gear to find its inputs</div>
          <button className="rot-handle" ref={rotRef} aria-hidden="true" tabIndex={-1} hidden />
        </div>
      </main>

      <aside className="panel panel-inputs" aria-label="Input List">
        <div className="panel-head">
          <h2 className="h2">Input List</h2>
          <a className="tag tag-ink tag-link" href="https://www.seeens.com" target="_blank" rel="noopener">
            By Seeens
          </a>
        </div>
        <InputList items={plot.items} selectedId={selectedId} />
      </aside>
    </div>
  );
}
