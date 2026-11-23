// The gear library. Sizes are real footprints in feet (IN converts inches).
// The stage's +z points at the audience; gear faces +z at rotation 0.

export const IN = (inches: number) => inches / 12;

export type GearCategory = "Drums" | "Guitar" | "Bass" | "Pedalboards" | "Keys" | "Vocals & Monitors";

/** One channel on the input list. `{L}` is replaced with the piece's label. */
export type InputSpec = { name: string; source: string; stand: string };

export type BuildSpec =
  | { kind: "kit"; kick: number; toms: number[]; floor: number[] }
  | { kind: "riser"; w: number; d: number; h: number }
  | { kind: "combo"; w: number; h: number; d: number; grill: "light" | "dark" }
  | { kind: "stack"; cw: number; ch: number; cd: number; hw: number; hh: number; hd: number }
  | { kind: "board"; w: number; d: number }
  | { kind: "keys"; w: number; d: number; stand: "x" | "legs" }
  | { kind: "mic" }
  | { kind: "wedge" }
  | { kind: "box"; w: number; h: number; d: number; color: "cyan" | "yellow" };

export type GearDef = {
  id: string;
  cat: GearCategory;
  name: string;
  note: string;
  /** Default label. Numbered gear gets "Guitar 1", "Guitar 2"… */
  base: string;
  numbered?: boolean;
  riser?: boolean;
  monitor?: boolean;
  power?: boolean;
  /** Can be flipped for a left-handed player (drum kits). */
  handed?: boolean;
  build: BuildSpec;
  inputs: InputSpec[];
};

const i = (name: string, source: string, stand: string): InputSpec => ({ name, source, stand });

const kitInputs = (toms: string[]) => [
  i("Kick In", "Beta 91A", "None"),
  i("Kick Out", "Beta 52A", "Short Boom"),
  i("Snare Top", "SM57", "Short Boom"),
  i("Snare Bottom", "SM57", "Short Boom"),
  i("Hi-Hat", "SM81", "Short Boom"),
  ...toms.map((t) => i(t, "e604", "Clip")),
  i("OH L", "KM184", "Tall Boom"),
  i("OH R", "KM184", "Tall Boom"),
];
const ampMic = [i("{L}", "SM57", "Short Boom")];
const bassInputs = [i("{L} DI", "DI", "None"), i("{L} Mic", "RE20", "Short Boom")];
const stereoDI = [i("{L} L", "DI", "None"), i("{L} R", "DI", "None")];

const list: GearDef[] = [
  {
    id: "kit4",
    cat: "Drums",
    name: "4-Piece Kit",
    note: '22" kick, 12" rack, 16" floor',
    base: "Drums",
    handed: true,
    build: { kind: "kit", kick: 22, toms: [12], floor: [16] },
    inputs: kitInputs(["Rack Tom", "Floor Tom"]),
  },
  {
    id: "kit5",
    cat: "Drums",
    name: "5-Piece Kit",
    note: '22" kick, 10/12" racks, 16" floor',
    base: "Drums",
    handed: true,
    build: { kind: "kit", kick: 22, toms: [10, 12], floor: [16] },
    inputs: kitInputs(["Rack Tom 1", "Rack Tom 2", "Floor Tom"]),
  },
  {
    id: "kitBop",
    cat: "Drums",
    name: "Bop Kit",
    note: '18" kick, 12" rack, 14" floor',
    base: "Drums",
    handed: true,
    build: { kind: "kit", kick: 18, toms: [12], floor: [14] },
    inputs: [
      i("Kick", "Beta 52A", "Short Boom"),
      i("Snare", "SM57", "Short Boom"),
      i("OH L", "KM184", "Tall Boom"),
      i("OH R", "KM184", "Tall Boom"),
    ],
  },
  {
    id: "riser",
    cat: "Drums",
    name: "Drum Riser",
    note: "8 × 6 ft, 1 ft tall",
    base: "Riser",
    riser: true,
    build: { kind: "riser", w: 8, d: 6, h: 1 },
    inputs: [],
  },
  {
    id: "twin",
    cat: "Guitar",
    name: "Fender Twin Reverb",
    note: "2x12 combo, 26 × 10.5 in",
    base: "Guitar",
    numbered: true,
    build: { kind: "combo", w: IN(26), h: IN(19.5), d: IN(10.5), grill: "light" },
    inputs: ampMic,
  },
  {
    id: "deluxe",
    cat: "Guitar",
    name: "Fender Deluxe Reverb",
    note: "1x12 combo, 24.5 × 9.5 in",
    base: "Guitar",
    numbered: true,
    build: { kind: "combo", w: IN(24.5), h: IN(17.5), d: IN(9.5), grill: "light" },
    inputs: ampMic,
  },
  {
    id: "ac30",
    cat: "Guitar",
    name: "Vox AC30",
    note: "2x12 combo, 27.5 × 10.5 in",
    base: "Guitar",
    numbered: true,
    build: { kind: "combo", w: IN(27.5), h: IN(22), d: IN(10.5), grill: "dark" },
    inputs: ampMic,
  },
  {
    id: "halfstack",
    cat: "Guitar",
    name: "4x12 Half Stack",
    note: "30 × 14 in cab, head on top",
    base: "Guitar",
    numbered: true,
    build: { kind: "stack", cw: IN(30), ch: IN(30), cd: IN(14), hw: IN(24), hh: IN(10), hd: IN(10) },
    inputs: ampMic,
  },
  {
    id: "svt",
    cat: "Bass",
    name: "SVT Head + 8x10",
    note: "24 × 15.5 in cab, 4.4 ft tall",
    base: "Bass",
    build: { kind: "stack", cw: IN(24), ch: IN(52), cd: IN(15.5), hw: IN(24), hh: IN(11), hd: IN(12) },
    inputs: bassInputs,
  },
  {
    id: "bassCombo",
    cat: "Bass",
    name: "1x15 Bass Combo",
    note: "22 × 17 in",
    base: "Bass",
    build: { kind: "combo", w: IN(22), h: IN(24), d: IN(17), grill: "light" },
    inputs: bassInputs,
  },
  ...(
    [
      ["nano", "Pedaltrain Nano", 14, 5.5],
      ["metro16", "Pedaltrain Metro 16", 16, 8],
      ["classic1", "Pedaltrain Classic 1", 22, 12.5],
      ["classicPro", "Pedaltrain Classic Pro", 32, 16],
      ["terra42", "Pedaltrain Terra 42", 42, 16],
    ] as const
  ).map(([id, name, w, d]): GearDef => ({
    id,
    cat: "Pedalboards",
    name,
    note: `${w} × ${d} in`,
    base: "Board",
    numbered: true,
    build: { kind: "board", w: IN(w), d: IN(d) },
    inputs: [],
  })),
  {
    id: "nord88",
    cat: "Keys",
    name: "Nord Stage 88",
    note: "51.4 × 13.6 in, X stand",
    base: "Keys",
    numbered: true,
    build: { kind: "keys", w: IN(51.4), d: IN(13.6), stand: "x" },
    inputs: stereoDI,
  },
  {
    id: "rhodes",
    cat: "Keys",
    name: "Rhodes Mk I 73",
    note: "44 × 22 in, own legs",
    base: "Keys",
    numbered: true,
    build: { kind: "keys", w: IN(44), d: IN(22), stand: "legs" },
    inputs: [i("{L}", "DI", "None")],
  },
  {
    id: "synth61",
    cat: "Keys",
    name: "61-Key Synth",
    note: "39 × 13 in, X stand",
    base: "Synth",
    numbered: true,
    build: { kind: "keys", w: IN(39), d: IN(13), stand: "x" },
    inputs: stereoDI,
  },
  {
    id: "vox",
    cat: "Vocals & Monitors",
    name: "Vocal Mic",
    note: "SM58 on a tall boom",
    base: "Vox",
    numbered: true,
    build: { kind: "mic" },
    inputs: [i("{L}", "SM58", "Tall Boom")],
  },
  {
    id: "wedge",
    cat: "Vocals & Monitors",
    name: "Monitor Wedge",
    note: "22 × 16 in, faces upstage",
    base: "Mix",
    numbered: true,
    monitor: true,
    build: { kind: "wedge" },
    inputs: [],
  },
  {
    id: "di",
    cat: "Vocals & Monitors",
    name: "DI Box",
    note: "Acoustic, laptop, anything",
    base: "DI",
    numbered: true,
    build: { kind: "box", w: IN(5), h: IN(3), d: IN(7.5), color: "cyan" },
    inputs: [i("{L}", "DI", "None")],
  },
  {
    id: "power",
    cat: "Vocals & Monitors",
    name: "Power Drop",
    note: "Quad box, 120V",
    base: "Power",
    numbered: true,
    power: true,
    build: { kind: "box", w: IN(9), h: IN(3.5), d: IN(5), color: "yellow" },
    inputs: [],
  },
];

export const GEAR: Record<string, GearDef> = Object.fromEntries(list.map((g) => [g.id, g]));

export const LIBRARY_ORDER: GearCategory[] = ["Drums", "Guitar", "Bass", "Pedalboards", "Keys", "Vocals & Monitors"];

/** Engineers list channels drums first, then bass, guitar, keys, vocals. */
export const INPUT_ORDER: Record<GearCategory, number> = {
  Drums: 0,
  Bass: 1,
  Guitar: 2,
  Keys: 3,
  "Vocals & Monitors": 4,
  Pedalboards: 5,
};
