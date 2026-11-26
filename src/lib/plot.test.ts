import { test } from "node:test";
import assert from "node:assert/strict";
import { GEAR } from "./gear.ts";
import { EXAMPLE_PLOT, computeInputs, inputListText, nextLabel, parsePlot, type PlotItem } from "./plot.ts";

const item = (id: number, type: string, label: string): PlotItem => ({ id, type, label, x: 0, z: 0, rot: 0 });

test("drums come first, then bass, guitar, keys, vocals", () => {
  const rows = computeInputs([item(1, "vox", "Vox 1"), item(2, "twin", "Guitar 1"), item(3, "kit4", "Drums")]);
  assert.equal(rows[0].name, "Kick In");
  assert.equal(rows.at(-2)?.name, "Guitar 1");
  assert.equal(rows.at(-1)?.name, "Vox 1");
  assert.deepEqual(
    rows.map((r) => r.ch),
    rows.map((_, i) => i + 1),
  );
});

test("labels fill in the input names", () => {
  const rows = computeInputs([item(1, "svt", "Bass (Sam)")]);
  assert.deepEqual(
    rows.map((r) => r.name),
    ["Bass (Sam) DI", "Bass (Sam) Mic"],
  );
});

test("gear with no inputs adds no channels", () => {
  assert.equal(computeInputs([item(1, "wedge", "Mix 1"), item(2, "riser", "Riser")]).length, 0);
});

test("numbered labels take the first free number", () => {
  const items = [item(1, "vox", "Vox 1"), item(2, "vox", "Vox 3")];
  assert.equal(nextLabel(items, GEAR.vox), "Vox 2");
  assert.equal(nextLabel(items, GEAR.kit4), "Drums");
});

test("the example plot has 17 inputs and 4 mixes", () => {
  assert.equal(computeInputs(EXAMPLE_PLOT.items).length, 17);
  assert.match(inputListText(EXAMPLE_PLOT), /MONITORS\nMix 1\nMix 2\nMix 3\nMix 4/);
});

test("kits keep a lefty flag; other gear can't have one", () => {
  const p = parsePlot({
    stage: { w: 16, d: 12 },
    items: [{ type: "kit4", lefty: true }, { type: "kit5" }, { type: "twin", lefty: true }],
  });
  assert.deepEqual(
    p?.items.map((i) => i.lefty),
    [true, undefined, undefined],
  );
});

test("parsePlot drops unknown gear and clamps the stage", () => {
  const p = parsePlot({ band: "X", stage: { w: 400, d: 2 }, items: [{ type: "theremin" }, { type: "vox", x: 1 }] });
  assert.ok(p);
  assert.deepEqual(p.stage, { w: 60, d: 6 });
  assert.equal(p.items.length, 1);
  assert.equal(parsePlot("nope"), null);
});

const theremin = {
  name: "Theremin",
  cat: "Keys",
  shape: { kind: "table", w: 24, d: 14, h: 32, top: "none" },
  inputs: "di",
} as const;

test("custom pieces add their inputs and survive a save and load", () => {
  const items: PlotItem[] = [{ id: 1, type: "custom", label: "Theremin", x: 0, z: 0, rot: 0, custom: { ...theremin } }];
  assert.deepEqual(
    computeInputs(items).map((r) => [r.name, r.source]),
    [["Theremin", "DI"]],
  );
  const back = parsePlot(JSON.parse(JSON.stringify({ stage: { w: 16, d: 12 }, items })));
  assert.equal(back?.items[0].custom?.name, "Theremin");
  assert.equal(computeInputs(back!.items).length, 1);
});

test("custom pieces with bad data are dropped on load", () => {
  const p = parsePlot({
    stage: { w: 16, d: 12 },
    items: [
      { type: "custom", custom: { ...theremin, shape: { kind: "table", w: -1, d: 14, h: 32, top: "none" } } },
      { type: "custom", custom: { ...theremin, shape: { kind: "kit", kick: 22, toms: [], floor: [] } } },
      { type: "custom" },
      { type: "custom", custom: { ...theremin, inputs: [{ name: "Left", source: "DI", stand: "None" }] } },
    ],
  });
  assert.equal(p?.items.length, 1);
  assert.equal(p?.items[0].custom?.inputs.length, 1);
});
