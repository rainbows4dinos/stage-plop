import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasUnsaved,
  addPlot,
  blankPlot,
  currentOf,
  openShared,
  parseLocal,
  removePlot,
  switchTo,
  updateCurrent,
} from "./local-plots.ts";
import { EXAMPLE_PLOT } from "./plot.ts";
import { makeToken } from "./share.ts";

const link = { id: "abcdefghjk", token: makeToken() };

test("first run starts with the example; an old single plot is carried over", () => {
  assert.equal(currentOf(parseLocal(null, null)).plot.band, "Example Band");
  const old = { ...EXAMPLE_PLOT, band: "Merwulf" };
  const s = parseLocal(null, old);
  assert.equal(s.plots.length, 1);
  assert.equal(currentOf(s).plot.band, "Merwulf");
});

test("stored state round-trips and drops junk", () => {
  let s = parseLocal(null, null);
  s = addPlot(s, { plot: blankPlot(), link });
  const back = parseLocal(
    JSON.parse(JSON.stringify({ ...s, plots: [...s.plots, { key: 5 }, { key: "x", plot: "no" }] })),
    null,
  );
  assert.equal(back.plots.length, 2);
  assert.deepEqual(currentOf(back).link, link);
  // a broken link is dropped, the plot kept
  const broken = parseLocal(
    { current: "a", plots: [{ key: "a", plot: EXAMPLE_PLOT, link: { id: "x", token: "y" } }] },
    null,
  );
  assert.equal(currentOf(broken).link, undefined);
});

test("new, switch, update and remove", () => {
  let s = parseLocal(null, null);
  const first = s.current;
  s = addPlot(s, { plot: blankPlot() });
  assert.notEqual(s.current, first);
  s = updateCurrent(s, { plot: { ...blankPlot(), band: "New One" } });
  assert.equal(currentOf(s).plot.band, "New One");
  s = switchTo(s, first);
  assert.equal(currentOf(s).plot.band, "Example Band");
  s = removePlot(s, first);
  assert.equal(currentOf(s).plot.band, "New One");
  s = removePlot(s, s.current);
  assert.equal(s.plots.length, 1, "always leaves one plot");
});

test("opening an edit link adds the plot, or refreshes it when the server has news", () => {
  let s = parseLocal(null, null);
  const shared = { ...EXAMPLE_PLOT, band: "Online" };
  s = openShared(s, link, shared, "2026-11-27T10:00:00.000Z");
  assert.equal(s.plots.length, 2);
  assert.equal(currentOf(s).plot.band, "Online");
  // local edit, server unchanged: keep the local edit
  s = updateCurrent(s, { plot: { ...shared, band: "Local Edit" } });
  assert.ok(hasUnsaved(currentOf(s)));
  s = openShared(s, link, shared, "2026-11-27T10:00:00.000Z");
  assert.equal(currentOf(s).plot.band, "Local Edit");
  // server moved on: take the server's copy
  s = openShared(s, link, { ...shared, band: "Changed Online" }, "2026-11-27T11:00:00.000Z");
  assert.equal(currentOf(s).plot.band, "Changed Online");
  assert.ok(!hasUnsaved(currentOf(s)));
  assert.equal(s.plots.length, 2);
});

test("edits to a plot that isn't shared don't count as unsaved", () => {
  const s = updateCurrent(parseLocal(null, null), { plot: blankPlot() });
  assert.ok(!hasUnsaved(currentOf(s)));
});
