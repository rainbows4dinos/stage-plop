// What a gear entry in src/data/gear/*.json looks like, and how it's checked.
// Sizes in the JSON are inches; the app works in feet (see toBuildSpec).

export type GearCategory = "Drums" | "Guitar" | "Bass" | "Pedalboards" | "Keys" | "Vocals & Monitors";
export const CATEGORIES: GearCategory[] = ["Drums", "Guitar", "Bass", "Pedalboards", "Keys", "Vocals & Monitors"];

/** One channel on the input list. `{L}` is replaced with the piece's label. */
export type InputSpec = { name: string; source: string; stand: string };

/** Shorthand for the common input setups, so most entries don't list channels. */
export const INPUT_PRESETS = {
  none: [],
  mic: [{ name: "{L}", source: "SM57", stand: "Short Boom" }],
  di: [{ name: "{L}", source: "DI", stand: "None" }],
  "stereo-di": [
    { name: "{L} L", source: "DI", stand: "None" },
    { name: "{L} R", source: "DI", stand: "None" },
  ],
  "di+mic": [
    { name: "{L} DI", source: "DI", stand: "None" },
    { name: "{L} Mic", source: "RE20", stand: "Short Boom" },
  ],
  vocal: [{ name: "{L}", source: "SM58", stand: "Tall Boom" }],
} satisfies Record<string, InputSpec[]>;
export type InputPreset = keyof typeof INPUT_PRESETS;

/** Shapes as written in JSON. Every number is inches. */
export type ShapeJson =
  | { kind: "kit"; kick: number; toms: number[]; floor: number[] }
  | { kind: "riser"; w: number; d: number; h: number }
  | { kind: "combo"; w: number; h: number; d: number; grill: "light" | "dark" }
  | { kind: "stack"; cw: number; ch: number; cd: number; hw: number; hh: number; hd: number }
  | { kind: "board"; w: number; d: number }
  | { kind: "keys"; w: number; d: number; stand: "x" | "legs" }
  | { kind: "mic" }
  | { kind: "wedge" }
  | { kind: "box"; w: number; h: number; d: number; color: BoxColor }
  | { kind: "table"; w: number; d: number; h: number; top: TableTop };

export type BoxColor = "cyan" | "yellow" | "paper" | "ink";
export type TableTop = "none" | "synth" | "laptop" | "percussion";

export type GearJson = {
  id: string;
  name: string;
  brand?: string;
  /** Other names people search for: "twin", "65 twin", "fridge". */
  aliases?: string[];
  note: string;
  /** Default label on the stage. Numbered gear becomes "Guitar 1", "Guitar 2"… */
  label: string;
  numbered?: boolean;
  /** Can be flipped for a left-handed player (drum kits). */
  handed?: boolean;
  riser?: boolean;
  monitor?: boolean;
  power?: boolean;
  shape: ShapeJson;
  inputs: InputPreset | InputSpec[];
};

export type GearFileJson = { category: GearCategory; gear: GearJson[] };

/* ---------- Validation ---------- */

// Numeric fields each shape needs (all inches), plus enum fields.
const SHAPE_FIELDS: Record<ShapeJson["kind"], { nums: string[]; lists?: string[]; enums?: Record<string, string[]> }> =
  {
    kit: { nums: ["kick"], lists: ["toms", "floor"] },
    riser: { nums: ["w", "d", "h"] },
    combo: { nums: ["w", "h", "d"], enums: { grill: ["light", "dark"] } },
    stack: { nums: ["cw", "ch", "cd", "hw", "hh", "hd"] },
    board: { nums: ["w", "d"] },
    keys: { nums: ["w", "d"], enums: { stand: ["x", "legs"] } },
    mic: { nums: [] },
    wedge: { nums: [] },
    box: { nums: ["w", "h", "d"], enums: { color: ["cyan", "yellow", "paper", "ink"] } },
    table: { nums: ["w", "d", "h"], enums: { top: ["none", "synth", "laptop", "percussion"] } },
  };

const ID_RE = /^[a-z][a-zA-Z0-9]*$/;
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isSize = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 600;

/** Returns a list of problems, each prefixed with where it is. Empty means valid. */
export function validateGearFile(raw: unknown, file: string): string[] {
  const errors: string[] = [];
  const at = (where: string, msg: string) => errors.push(`${file}${where ? ` › ${where}` : ""}: ${msg}`);
  if (!raw || typeof raw !== "object") return [`${file}: not an object`];
  const f = raw as Record<string, unknown>;
  if (!CATEGORIES.includes(f.category as GearCategory)) at("", `category must be one of ${CATEGORIES.join(", ")}`);
  if (!Array.isArray(f.gear)) {
    at("", "gear must be a list");
    return errors;
  }
  f.gear.forEach((g: unknown, i) => {
    const e = (g ?? {}) as Record<string, unknown>;
    const where = isStr(e.id) ? e.id : `#${i}`;
    if (!isStr(e.id) || !ID_RE.test(e.id)) at(where, "id must be camelCase letters and digits, starting lowercase");
    for (const k of ["name", "note", "label"]) if (!isStr(e[k])) at(where, `${k} is required`);
    if (e.brand !== undefined && !isStr(e.brand)) at(where, "brand must be text");
    if (e.aliases !== undefined && (!Array.isArray(e.aliases) || !e.aliases.every(isStr)))
      at(where, "aliases must be a list of text");
    for (const k of ["numbered", "handed", "riser", "monitor", "power"])
      if (e[k] !== undefined && typeof e[k] !== "boolean") at(where, `${k} must be true or false`);

    const s = e.shape as Record<string, unknown> | undefined;
    const spec = s && SHAPE_FIELDS[s.kind as ShapeJson["kind"]];
    if (!s || !spec) {
      at(where, `shape.kind must be one of ${Object.keys(SHAPE_FIELDS).join(", ")}`);
    } else {
      for (const n of spec.nums) if (!isSize(s[n])) at(where, `shape.${n} must be a size in inches`);
      for (const l of spec.lists ?? [])
        if (!Array.isArray(s[l]) || !(s[l] as unknown[]).every(isSize))
          at(where, `shape.${l} must be a list of sizes in inches`);
      for (const [k, opts] of Object.entries(spec.enums ?? {}))
        if (!opts.includes(s[k] as string)) at(where, `shape.${k} must be one of ${opts.join(", ")}`);
      if (e.handed && s.kind !== "kit") at(where, "only kits can be handed");
    }

    if (typeof e.inputs === "string") {
      if (!(e.inputs in INPUT_PRESETS))
        at(where, `inputs preset must be one of ${Object.keys(INPUT_PRESETS).join(", ")}`);
    } else if (Array.isArray(e.inputs)) {
      e.inputs.forEach((inp: unknown, j) => {
        const r = (inp ?? {}) as Record<string, unknown>;
        if (!isStr(r.name) || !isStr(r.source) || !isStr(r.stand))
          at(where, `inputs[${j}] needs name, source and stand`);
      });
    } else {
      at(where, "inputs must be a preset name or a list");
    }
  });
  return errors;
}

/** Checks ids are unique across every file. */
export function duplicateIds(files: GearFileJson[]): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const f of files)
    for (const g of f.gear) {
      if (seen.has(g.id)) dupes.push(`duplicate id: ${g.id}`);
      seen.add(g.id);
    }
  return dupes;
}

/* ---------- Custom pieces ---------- */

/** A piece someone made because it isn't in the catalog. Saved inside the plot. */
export type CustomGear = {
  name: string;
  cat: GearCategory;
  shape: ShapeJson;
  inputs: InputPreset | InputSpec[];
};

/** Shapes a custom piece can use, in the order the form offers them. */
export const CUSTOM_SHAPES = ["combo", "stack", "keys", "table", "board", "box", "mic"] as const;
export type CustomShapeKind = (typeof CUSTOM_SHAPES)[number];

/** Same checks as catalog entries, plus a name length limit. */
export function validateCustom(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return ["custom piece: not an object"];
  const c = raw as Record<string, unknown>;
  const errors = validateGearFile(
    {
      category: c.cat,
      gear: [{ id: "custom", name: c.name, note: "Custom", label: c.name, shape: c.shape, inputs: c.inputs }],
    },
    "custom piece",
  );
  if (typeof c.name === "string" && c.name.length > 60) errors.push("custom piece: name is longer than 60 characters");
  const kind = (c.shape as { kind?: string } | undefined)?.kind;
  if (kind && !(CUSTOM_SHAPES as readonly string[]).includes(kind))
    errors.push(`custom piece: shape ${kind} isn't offered`);
  if (Array.isArray(c.inputs) && c.inputs.length > 32) errors.push("custom piece: more than 32 inputs");
  return errors;
}
