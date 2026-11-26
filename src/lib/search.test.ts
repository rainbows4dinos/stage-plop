import { test } from "node:test";
import assert from "node:assert/strict";
import { GEAR } from "./gear.ts";
import { searchGear } from "./search.ts";

const catalog = Object.values(GEAR);
const ids = (q: string) => searchGear(q, catalog).map((g) => g.id);

test("names, brands and aliases all find gear", () => {
  assert.equal(ids("twin")[0], "twin");
  assert.equal(ids("fridge")[0], "svt");
  assert.equal(ids("ampeg")[0], "svt");
  assert.equal(ids("nord")[0], "nord88");
  assert.ok(ids("fender").includes("deluxe"));
});

test("every word has to match", () => {
  assert.deepEqual(ids("fender deluxe"), ["deluxe"]);
  assert.deepEqual(ids("pedaltrain 42"), ["terra42"]);
});

test("short typos still match", () => {
  assert.equal(ids("twn")[0], "twin");
  assert.equal(ids("pedaltrian")[0], "nano");
  assert.ok(ids("rodes").includes("rhodes"));
});

test("categories work as a search", () => {
  const keys = ids("keys");
  assert.ok(["nord88", "rhodes", "synth61"].every((id) => keys.includes(id)));
});

test("empty and junk queries return nothing", () => {
  assert.deepEqual(ids(""), []);
  assert.deepEqual(ids("   "), []);
  assert.deepEqual(ids("xylophone"), []);
});
