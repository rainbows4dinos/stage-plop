import { test } from "node:test";
import assert from "node:assert/strict";
import { addToRig, makeSetup, parseRig, parseSetups, placeSetup, removeFromRig, rigKey } from "./library.ts";
import { EXAMPLE_PLOT } from "./plot.ts";

const theremin = {
  name: "Theremin",
  cat: "Keys",
  shape: { kind: "table", w: 24, d: 14, h: 32, top: "none" },
  inputs: "di",
} as const;

test("Your Rig puts newest first and skips duplicates", () => {
  let rig = addToRig([], [{ type: "twin" }, { type: "svt" }]);
  rig = addToRig(rig, [{ type: "twin" }, { type: "custom", custom: { ...theremin } }]);
  assert.deepEqual(rig.map(rigKey), ["twin", "custom:theremin", "svt"]);
  // same custom name, different case: one entry, newest wins
  rig = addToRig(rig, [{ type: "custom", custom: { ...theremin, name: "theremin", inputs: "stereo-di" } }]);
  assert.equal(rig.filter((e) => e.type === "custom").length, 1);
  assert.equal(rig[0].custom?.inputs, "stereo-di");
  assert.deepEqual(removeFromRig(rig, "svt").map(rigKey), ["custom:theremin", "twin"]);
});

test("Your Rig drops unknown gear and broken custom pieces when loading", () => {
  const rig = parseRig([
    { type: "twin" },
    { type: "theremin9000" },
    { type: "custom", custom: { ...theremin, shape: { kind: "spaceship" } } },
    "nope",
  ]);
  assert.deepEqual(rig.map(rigKey), ["twin"]);
  assert.deepEqual(parseRig({}), []);
});

test("a setup keeps every piece and its spot", () => {
  const s = makeSetup("  Full Backline ", EXAMPLE_PLOT.items, EXAMPLE_PLOT.stage, "s1");
  assert.equal(s.name, "Full Backline");
  assert.equal(s.items.length, EXAMPLE_PLOT.items.length);
  assert.ok(s.items.every((i) => !("id" in i)));
  const back = parseSetups(JSON.parse(JSON.stringify([s])));
  assert.deepEqual(back[0].items, s.items);
});

test("placing a setup on a smaller stage squeezes positions to fit", () => {
  const s = makeSetup(
    "Big",
    [{ id: 1, type: "twin", label: "Guitar 1", x: 15.5, z: -11.5, rot: 0 }],
    { w: 32, d: 24 },
    "s",
  );
  const [p] = placeSetup(s, { w: 16, d: 12 });
  assert.ok(Math.abs(p.x) <= 8 && Math.abs(p.z) <= 6, `${p.x}, ${p.z}`);
  // same-size or bigger stage: positions don't change
  assert.equal(placeSetup(s, { w: 40, d: 30 })[0].x, 15.5);
});

test("placing a setup next to existing gear renumbers clashing labels", () => {
  const s = makeSetup("Vox", [{ id: 1, type: "vox", label: "Vox 1", x: 0, z: 0, rot: 0 }], { w: 16, d: 12 }, "s");
  const [p] = placeSetup(s, { w: 16, d: 12 }, [{ type: "vox", label: "Vox 1" }]);
  assert.equal(p.label, "Vox 2");
});
