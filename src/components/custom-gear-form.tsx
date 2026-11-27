"use client";

import { useId, useState } from "react";
import {
  CATEGORIES,
  INPUT_PRESETS,
  validateCustom,
  type CustomGear,
  type CustomShapeKind,
  type GearCategory,
  type InputPreset,
  type InputSpec,
  type ShapeJson,
  type TableTop,
} from "@/lib/gear-schema";

// Each shape suggests a category and inputs until you pick your own.
const SHAPES: {
  kind: CustomShapeKind;
  label: string;
  dims: ("w" | "d" | "h")[];
  cat: GearCategory;
  inputs: InputPreset;
}[] = [
  { kind: "combo", label: "Amp or Combo", dims: ["w", "d", "h"], cat: "Guitar", inputs: "mic" },
  { kind: "stack", label: "Head on Cab", dims: ["w", "d", "h"], cat: "Guitar", inputs: "mic" },
  { kind: "keys", label: "Keys on Stand", dims: ["w", "d"], cat: "Keys", inputs: "stereo-di" },
  { kind: "table", label: "Table or Stand", dims: ["w", "d", "h"], cat: "Keys", inputs: "di" },
  { kind: "board", label: "Pedalboard", dims: ["w", "d"], cat: "Pedalboards", inputs: "none" },
  { kind: "box", label: "Box", dims: ["w", "d", "h"], cat: "Vocals & Monitors", inputs: "none" },
  { kind: "mic", label: "Mic Stand", dims: [], cat: "Vocals & Monitors", inputs: "vocal" },
];

const DEFAULT_SIZE: Record<CustomShapeKind, { w: number; d: number; h: number }> = {
  combo: { w: 24, d: 10, h: 20 },
  stack: { w: 30, d: 14, h: 30 },
  keys: { w: 40, d: 13, h: 0 },
  table: { w: 36, d: 18, h: 30 },
  board: { w: 22, d: 12, h: 0 },
  box: { w: 18, d: 12, h: 12 },
  mic: { w: 0, d: 0, h: 0 },
};

const PRESETS: { id: InputPreset | "list"; label: string }[] = [
  { id: "none", label: "No Inputs" },
  { id: "mic", label: "1 Mic" },
  { id: "di", label: "1 DI" },
  { id: "stereo-di", label: "Stereo DI" },
  { id: "di+mic", label: "DI + Mic" },
  { id: "vocal", label: "Vocal Mic" },
  { id: "list", label: "Custom List…" },
];

const TOPS: { id: TableTop; label: string }[] = [
  { id: "none", label: "Nothing" },
  { id: "synth", label: "Synth" },
  { id: "laptop", label: "Laptop" },
  { id: "percussion", label: "Percussion" },
];

const DIM_NAMES = { w: "Width", d: "Depth", h: "Height" };
const CM = 2.54;

/** Read size and top back out of a saved shape, so editing starts where you left off. */
function fromShape(shape: ShapeJson | undefined) {
  if (!shape) return null;
  const kind = shape.kind as CustomShapeKind;
  if (shape.kind === "stack") return { kind, w: shape.cw, d: shape.cd, h: shape.ch, top: "none" as TableTop };
  const s = shape as { w?: number; d?: number; h?: number; top?: TableTop };
  return { kind, w: s.w ?? 0, d: s.d ?? 0, h: s.h ?? 0, top: s.top ?? "none" };
}

function toShape(kind: CustomShapeKind, w: number, d: number, h: number, top: TableTop): ShapeJson {
  switch (kind) {
    case "combo":
      return { kind, w, d, h, grill: "light" };
    case "stack":
      // the head is drawn in proportion to the cab
      return {
        kind,
        cw: w,
        cd: d,
        ch: h,
        hw: Math.round(w * 0.8 * 10) / 10,
        hh: Math.min(10, Math.max(6, h * 0.3)),
        hd: Math.min(d, 11),
      };
    case "keys":
      return { kind, w, d, stand: "x" };
    case "table":
      return { kind, w, d, h, top };
    case "board":
      return { kind, w, d };
    case "box":
      return { kind, w, d, h, color: "paper" };
    case "mic":
      return { kind };
  }
}

export function CustomGearForm({
  initial,
  initialName,
  onSubmit,
  onCancel,
}: {
  initial?: CustomGear;
  initialName?: string;
  onSubmit: (c: CustomGear) => void;
  onCancel: () => void;
}) {
  const uid = useId();
  const start = fromShape(initial?.shape);
  const [name, setName] = useState(initial?.name ?? initialName ?? "");
  const [kind, setKind] = useState<CustomShapeKind>(start?.kind ?? "combo");
  const [cat, setCat] = useState<GearCategory>(initial?.cat ?? "Guitar");
  const [catTouched, setCatTouched] = useState(!!initial);
  const [unit, setUnit] = useState<"in" | "cm">("in");
  // sizes are kept in inches; the fields show the chosen unit
  const [size, setSize] = useState(start ? { w: start.w, d: start.d, h: start.h } : DEFAULT_SIZE.combo);
  const [top, setTop] = useState<TableTop>(start?.top ?? "none");
  const [preset, setPreset] = useState<InputPreset | "list">(
    typeof initial?.inputs === "string" ? initial.inputs : initial ? "list" : "mic",
  );
  const [presetTouched, setPresetTouched] = useState(!!initial);
  const [rows, setRows] = useState<InputSpec[]>(
    Array.isArray(initial?.inputs) ? initial.inputs : [{ name: "", source: "DI", stand: "None" }],
  );
  const [error, setError] = useState<string | null>(null);

  const shapeInfo = SHAPES.find((s) => s.kind === kind)!;
  const show = (inches: number) => (unit === "in" ? inches : Math.round(inches * CM * 10) / 10);
  const read = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? (unit === "in" ? n : n / CM) : 0;
  };

  const pickShape = (k: CustomShapeKind) => {
    setKind(k);
    if (!initial || k !== start?.kind) setSize(DEFAULT_SIZE[k]);
    const info = SHAPES.find((s) => s.kind === k)!;
    if (!catTouched) setCat(info.cat);
    if (!presetTouched) setPreset(info.inputs);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const custom: CustomGear = {
      name: name.trim(),
      cat,
      shape: toShape(kind, size.w, size.d, size.h, top),
      inputs:
        preset === "list"
          ? rows
              .map((r) => ({ name: r.name.trim(), source: r.source.trim(), stand: r.stand.trim() }))
              .filter((r) => r.name)
          : preset,
    };
    const errors = validateCustom(custom);
    if (errors.length) {
      setError(friendly(errors[0]));
      return;
    }
    onSubmit(custom);
  };

  return (
    <form className="scroll grid content-start gap-3 p-4" onSubmit={submit} noValidate>
      <label className="grid gap-1">
        <span className="caption">Name</span>
        <input
          className="field"
          value={name}
          maxLength={60}
          autoFocus
          placeholder="Theremin, Big Muff Board, Merch Table…"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <fieldset className="m-0 grid gap-1 border-0 p-0">
        <legend className="caption mb-1">Shape</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {SHAPES.map((s) => (
            <label key={s.kind} className="check">
              <input type="radio" name={`${uid}-shape`} checked={kind === s.kind} onChange={() => pickShape(s.kind)} />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      {shapeInfo.dims.length > 0 && (
        <fieldset className="m-0 grid gap-1 border-0 p-0">
          <legend className="caption mb-1 flex w-full items-center justify-between">Size</legend>
          <div className="flex items-end gap-2">
            {shapeInfo.dims.map((dim) => (
              <label key={dim} className="grid min-w-0 flex-1 gap-1">
                <span className="text-xs text-muted">{DIM_NAMES[dim]}</span>
                <input
                  className="field w-full"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  key={`${dim}-${unit}-${kind}`}
                  defaultValue={show(size[dim])}
                  onChange={(e) => setSize((s) => ({ ...s, [dim]: read(e.target.value) }))}
                />
              </label>
            ))}
            <div className="seg seg-sm mb-1 shrink-0" role="group" aria-label="Units">
              <button type="button" aria-pressed={unit === "in"} onClick={() => setUnit("in")}>
                in
              </button>
              <button type="button" aria-pressed={unit === "cm"} onClick={() => setUnit("cm")}>
                cm
              </button>
            </div>
          </div>
        </fieldset>
      )}

      {kind === "table" && (
        <label className="grid gap-1">
          <span className="caption">On Top</span>
          <select className="field" value={top} onChange={(e) => setTop(e.target.value as TableTop)}>
            {TOPS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="grid gap-1">
        <span className="caption">Inputs</span>
        <select
          className="field"
          value={preset}
          onChange={(e) => {
            setPreset(e.target.value as InputPreset | "list");
            setPresetTouched(true);
          }}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {preset === "list" && (
        <div className="grid gap-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_5.5rem_5.5rem_auto] items-center gap-1.5">
              {(["name", "source", "stand"] as const).map((k) => (
                <input
                  key={k}
                  className="field w-full px-2"
                  aria-label={`Input ${i + 1} ${k === "name" ? "Name" : k === "source" ? "Mic or DI" : "Stand"}`}
                  placeholder={k === "name" ? "Theremin" : k === "source" ? "DI" : "None"}
                  value={r[k]}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                />
              ))}
              <button
                type="button"
                className="btn btn-sm"
                aria-label={`Remove Input ${i + 1}`}
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setRows((rs) => [...rs, { name: "", source: "DI", stand: "None" }])}
            >
              Add Input
            </button>
          </div>
        </div>
      )}
      {preset !== "list" && preset !== "none" && (
        <p className="m-0 text-xs text-muted">
          {INPUT_PRESETS[preset].map((i) => `${i.name.replace("{L}", name.trim() || "Name")} (${i.source})`).join(", ")}
        </p>
      )}

      <label className="grid gap-1">
        <span className="caption">Input List Group</span>
        <select
          className="field"
          value={cat}
          onChange={(e) => {
            setCat(e.target.value as GearCategory);
            setCatTouched(true);
          }}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="m-0 border border-ink bg-yellow px-3 py-2" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn btn-primary">
          {initial ? "Save Changes" : "Plop It"}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Turn a validator message into something a person can act on. */
function friendly(msg: string): string {
  if (/name is required/.test(msg)) return "Give it a name.";
  if (/name is longer/.test(msg)) return "Keep the name under 60 characters.";
  if (/shape\.\w+ must be a size/.test(msg)) return "Fill in every size with a number above zero.";
  if (/inputs\[\d+\]/.test(msg)) return "Each input needs a name, a mic or DI, and a stand.";
  if (/more than 32 inputs/.test(msg)) return "That's more than 32 inputs. Split it into a few pieces.";
  return "Something's off with this piece. Check the fields and try again.";
}
