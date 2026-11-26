// The gear catalog. Entries live in src/data/gear/*.json (see README,
// "Adding Gear"); this file loads them and turns inches into the feet the
// stage works in. The stage's +z points at the audience; gear faces +z.
import bass from "../data/gear/bass.json" with { type: "json" };
import drums from "../data/gear/drums.json" with { type: "json" };
import guitar from "../data/gear/guitar.json" with { type: "json" };
import keys from "../data/gear/keys.json" with { type: "json" };
import pedalboards from "../data/gear/pedalboards.json" with { type: "json" };
import vocalsMonitors from "../data/gear/vocals-monitors.json" with { type: "json" };
import {
  CATEGORIES,
  INPUT_PRESETS,
  duplicateIds,
  validateGearFile,
  type GearCategory,
  type GearFileJson,
  type GearJson,
  type InputSpec,
  type ShapeJson,
} from "./gear-schema.ts";

export type { GearCategory, InputSpec } from "./gear-schema.ts";

export const IN = (inches: number) => inches / 12;

/** Shapes the 3D builders take. Kit sizes stay in inches (drum sizes); everything else is feet. */
export type BuildSpec =
  | Extract<ShapeJson, { kind: "kit" | "mic" | "wedge" }>
  | { kind: "riser"; w: number; d: number; h: number }
  | { kind: "combo"; w: number; h: number; d: number; grill: "light" | "dark" }
  | { kind: "stack"; cw: number; ch: number; cd: number; hw: number; hh: number; hd: number }
  | { kind: "board"; w: number; d: number }
  | { kind: "keys"; w: number; d: number; stand: "x" | "legs" }
  | { kind: "box"; w: number; h: number; d: number; color: "cyan" | "yellow" };

export type GearDef = {
  id: string;
  cat: GearCategory;
  name: string;
  brand?: string;
  aliases: string[];
  note: string;
  /** Default label. Numbered gear gets "Guitar 1", "Guitar 2"… */
  base: string;
  numbered?: boolean;
  handed?: boolean;
  riser?: boolean;
  monitor?: boolean;
  power?: boolean;
  build: BuildSpec;
  inputs: InputSpec[];
};

/** JSON shapes are in inches; the builders want feet (kits excepted). */
export function toBuildSpec(s: ShapeJson): BuildSpec {
  if (s.kind === "kit" || s.kind === "mic" || s.kind === "wedge") return s;
  const ft = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === "number" ? IN(v) : v]));
  return ft as BuildSpec;
}

function toDef(g: GearJson, cat: GearCategory): GearDef {
  return {
    id: g.id,
    cat,
    name: g.name,
    brand: g.brand,
    aliases: g.aliases ?? [],
    note: g.note,
    base: g.label,
    numbered: g.numbered,
    handed: g.handed,
    riser: g.riser,
    monitor: g.monitor,
    power: g.power,
    build: toBuildSpec(g.shape),
    inputs: typeof g.inputs === "string" ? INPUT_PRESETS[g.inputs] : g.inputs,
  };
}

/** Every gear file, by name. Add new files here. */
export const GEAR_FILES: Record<string, unknown> = {
  "drums.json": drums,
  "guitar.json": guitar,
  "bass.json": bass,
  "pedalboards.json": pedalboards,
  "keys.json": keys,
  "vocals-monitors.json": vocalsMonitors,
};

function loadCatalog(): Record<string, GearDef> {
  const errors = Object.entries(GEAR_FILES).flatMap(([file, raw]) => validateGearFile(raw, file));
  const files = Object.values(GEAR_FILES) as GearFileJson[];
  if (!errors.length) errors.push(...duplicateIds(files));
  // Tests catch this first; failing loudly here stops a bad entry from shipping.
  if (errors.length) throw new Error(`Gear catalog has problems:\n${errors.join("\n")}`);
  const out: Record<string, GearDef> = {};
  for (const f of files) for (const g of f.gear) out[g.id] = toDef(g, f.category);
  return out;
}

export const GEAR: Record<string, GearDef> = loadCatalog();

export const LIBRARY_ORDER: GearCategory[] = CATEGORIES;

/** Engineers list channels drums first, then bass, guitar, keys, vocals. */
export const INPUT_ORDER: Record<GearCategory, number> = {
  Drums: 0,
  Bass: 1,
  Guitar: 2,
  Keys: 3,
  "Vocals & Monitors": 4,
  Pedalboards: 5,
};
