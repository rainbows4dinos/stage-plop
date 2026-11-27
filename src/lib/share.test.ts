import { test } from "node:test";
import assert from "node:assert/strict";
import { EXAMPLE_PLOT } from "./plot.ts";
import {
  MAX_ITEMS,
  cleanIncoming,
  editPath,
  isId,
  isToken,
  makeId,
  makeToken,
  sameHash,
  sha256,
  tokenFromHash,
} from "./share.ts";

test("ids are 10 unambiguous characters and don't repeat", () => {
  const ids = new Set(Array.from({ length: 2000 }, makeId));
  assert.equal(ids.size, 2000);
  for (const id of ids) assert.ok(isId(id), id);
  assert.ok(!isId("O0l1I00000"));
  assert.ok(!isId("short"));
});

test("tokens are 256-bit base64url, and only their hash is compared", async () => {
  const t = makeToken();
  assert.ok(isToken(t), t);
  assert.notEqual(makeToken(), t);
  const h = await sha256(t);
  assert.equal(h.length, 64);
  assert.ok(sameHash(h, await sha256(t)));
  assert.ok(!sameHash(h, await sha256(makeToken())));
});

test("the edit token round-trips through the link fragment", () => {
  const t = makeToken();
  const link = editPath("abcdefghij", t);
  assert.equal(tokenFromHash(link.slice(link.indexOf("#"))), t);
  assert.equal(tokenFromHash("#k=nope"), null);
  assert.equal(tokenFromHash(""), null);
});

test("incoming plots are cleaned and capped", () => {
  const ok = cleanIncoming({ plot: EXAMPLE_PLOT });
  assert.ok("plot" in ok && ok.plot.items.length === EXAMPLE_PLOT.items.length);
  assert.ok("error" in cleanIncoming({ plot: "nope" }));
  assert.ok("error" in cleanIncoming(null));
  const many = {
    ...EXAMPLE_PLOT,
    items: Array.from({ length: MAX_ITEMS + 1 }, (_, i) => ({ ...EXAMPLE_PLOT.items[0], id: i })),
  };
  assert.match((cleanIncoming({ plot: many }) as { error: string }).error, /up to/);
  const huge = { ...EXAMPLE_PLOT, band: "x".repeat(300_000) };
  assert.match((cleanIncoming({ plot: huge }) as { error: string }).error, /too big/);
});
