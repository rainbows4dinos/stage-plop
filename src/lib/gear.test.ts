import { test } from "node:test";
import assert from "node:assert/strict";
import { GEAR, GEAR_FILES } from "./gear.ts";
import { duplicateIds, validateGearFile, type GearFileJson } from "./gear-schema.ts";

test("every gear file is valid", () => {
  const errors = Object.entries(GEAR_FILES).flatMap(([file, raw]) => validateGearFile(raw, file));
  assert.deepEqual(errors, []);
  assert.deepEqual(duplicateIds(Object.values(GEAR_FILES) as GearFileJson[]), []);
});

const good = {
  id: "twin",
  name: "Fender Twin Reverb",
  note: "2x12 combo",
  label: "Guitar",
  shape: { kind: "combo", w: 26, h: 19.5, d: 10.5, grill: "light" },
  inputs: "mic",
};
const check = (entry: object) => validateGearFile({ category: "Guitar", gear: [entry] }, "test.json");

test("a good entry passes", () => {
  assert.deepEqual(check(good), []);
});

test("bad entries fail with a useful message", () => {
  assert.match(check({ ...good, shape: { kind: "combo", w: 26, d: 10.5, grill: "light" } }).join(), /shape\.h/);
  assert.match(check({ ...good, shape: { kind: "spaceship" } }).join(), /shape\.kind/);
  assert.match(check({ ...good, inputs: "stereo-mic" }).join(), /inputs preset/);
  assert.match(check({ ...good, inputs: [{ name: "Gtr" }] }).join(), /inputs\[0\]/);
  assert.match(check({ ...good, name: "" }).join(), /name is required/);
  assert.match(check({ ...good, handed: true }).join(), /only kits/);
  assert.match(check({ ...good, id: "Twin Reverb" }).join(), /id must be/);
  assert.match(validateGearFile({ category: "Kazoos", gear: [] }, "x.json").join(), /category/);
});

test("duplicate ids across files are caught", () => {
  const f = { category: "Guitar", gear: [good] } as GearFileJson;
  assert.deepEqual(duplicateIds([f, f]), ["duplicate id: twin"]);
});

test("sizes convert from inches to feet, except drum sizes", () => {
  assert.equal(GEAR.twin.build.kind === "combo" && GEAR.twin.build.w, 26 / 12);
  assert.equal(GEAR.riser.build.kind === "riser" && GEAR.riser.build.w, 8);
  assert.equal(GEAR.kit4.build.kind === "kit" && GEAR.kit4.build.kick, 22);
});

test("presets expand to input rows", () => {
  assert.deepEqual(
    GEAR.svt.inputs.map((i) => i.name),
    ["{L} DI", "{L} Mic"],
  );
  assert.equal(GEAR.wedge.inputs.length, 0);
});
