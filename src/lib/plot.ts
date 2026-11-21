// A plot is plain data: the stage, the gear on it, and the band's name.
// Everything else (input list, monitor mixes, power) is derived from it.
import { GEAR, INPUT_ORDER, type GearDef } from "./gear.ts";

export type PlotItem = {
  id: number;
  type: string;
  label: string;
  /** Feet from stage center. +x is stage left, +z is downstage (toward the audience). */
  x: number;
  z: number;
  /** Radians around the vertical axis. */
  rot: number;
};

export type Plot = {
  band: string;
  stage: { w: number; d: number };
  items: PlotItem[];
};

export type InputRow = { ch: number; itemId: number; name: string; source: string; stand: string };

export const STAGE_PRESETS = [
  { id: "12x8", label: "Basement, 12 × 8 ft", w: 12, d: 8 },
  { id: "16x12", label: "Bar Stage, 16 × 12 ft", w: 16, d: 12 },
  { id: "24x16", label: "Club, 24 × 16 ft", w: 24, d: 16 },
  { id: "32x24", label: "Theater, 32 × 24 ft", w: 32, d: 24 },
] as const;

export const clampStage = (w: number, d: number) => ({
  w: Math.max(6, Math.min(60, Math.round(w) || 16)),
  d: Math.max(6, Math.min(40, Math.round(d) || 12)),
});

export function nextLabel(items: Pick<PlotItem, "type" | "label">[], def: GearDef): string {
  if (!def.numbered) return def.base;
  const used = new Set(items.filter((i) => GEAR[i.type]?.base === def.base).map((i) => i.label));
  let n = 1;
  while (used.has(`${def.base} ${n}`)) n++;
  return `${def.base} ${n}`;
}

export function computeInputs(items: PlotItem[]): InputRow[] {
  const known = items.filter((i) => GEAR[i.type]);
  const order = known.slice().sort((a, b) => {
    const da = GEAR[a.type],
      db = GEAR[b.type];
    return INPUT_ORDER[da.cat] - INPUT_ORDER[db.cat] || da.base.localeCompare(db.base) || a.id - b.id;
  });
  const rows: InputRow[] = [];
  for (const it of order) {
    for (const inp of GEAR[it.type].inputs) {
      rows.push({
        ch: rows.length + 1,
        itemId: it.id,
        name: inp.name.replace("{L}", it.label),
        source: inp.source,
        stand: inp.stand,
      });
    }
  }
  return rows;
}

export const monitorsOf = (items: PlotItem[]) => items.filter((i) => GEAR[i.type]?.monitor);
export const powerOf = (items: PlotItem[]) => items.filter((i) => GEAR[i.type]?.power);

/** Tab-separated, so it pastes cleanly into a spreadsheet or an email. */
export function inputListText(plot: Plot): string {
  const rows = computeInputs(plot.items);
  let t = `${plot.band || "Band"} · Stage Plot (${plot.stage.w} × ${plot.stage.d} ft)\n\nCH\tSOURCE\tMIC/DI\tSTAND\n`;
  t += rows.map((r) => `${r.ch}\t${r.name}\t${r.source}\t${r.stand}`).join("\n");
  const mons = monitorsOf(plot.items);
  if (mons.length) t += `\n\nMONITORS\n${mons.map((m) => m.label).join("\n")}`;
  const pow = powerOf(plot.items).length;
  if (pow) t += `\n\nPOWER\n${pow} drop${pow > 1 ? "s" : ""}`;
  return t;
}

/** Clearly fictional starter plot: a four-piece on a bar stage. */
export const EXAMPLE_PLOT: Plot = (() => {
  const raw: [string, number, number, number, string?][] = [
    ["riser", 0, -3, 0],
    ["kit4", 0, -3.6, 0],
    ["svt", -6, -4.6, 0.25, "Bass"],
    ["vox", -5, 3.6, 0, "Vox 2"],
    ["nano", -5, 2.6, 0, "Bass Board"],
    ["twin", 5.8, -4.8, -0.25, "Guitar 1"],
    ["classic1", 0.5, 3.0, 0, "Guitar Board"],
    ["vox", 0.5, 4.0, 0, "Vox 1"],
    ["nord88", 5.4, 1.4, -0.35, "Keys 1"],
    ["vox", 5.2, 3.0, -0.35, "Vox 3"],
    ["wedge", -5, 5.0, 0, "Mix 1"],
    ["wedge", 0.5, 5.0, 0, "Mix 2"],
    ["wedge", 5.0, 4.6, -0.35, "Mix 3"],
    ["wedge", 4.8, -2.6, Math.PI / 2, "Mix 4"],
    ["power", -4.6, -5.4, 0, "Power 1"],
    ["power", 4.2, -5.4, 0, "Power 2"],
    ["power", 7, 2.6, 0, "Power 3"],
  ];
  return {
    band: "Example Band",
    stage: { w: 16, d: 12 },
    items: raw.map(([type, x, z, rot, label], idx) => ({
      id: idx + 1,
      type,
      x,
      z,
      rot,
      label: label ?? GEAR[type].base,
    })),
  };
})();

/** Accepts anything from storage and returns a valid plot, or null. */
export function parsePlot(value: unknown): Plot | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<Plot>;
  if (!Array.isArray(v.items) || !v.stage) return null;
  const stage = clampStage(Number(v.stage.w), Number(v.stage.d));
  let id = 1;
  const items: PlotItem[] = [];
  for (const raw of v.items as Partial<PlotItem>[]) {
    if (!raw || typeof raw.type !== "string" || !GEAR[raw.type]) continue;
    items.push({
      id: id++,
      type: raw.type,
      label: typeof raw.label === "string" && raw.label ? raw.label : GEAR[raw.type].base,
      x: Number(raw.x) || 0,
      z: Number(raw.z) || 0,
      rot: Number(raw.rot) || 0,
    });
  }
  return { band: typeof v.band === "string" ? v.band : "", stage, items };
}
