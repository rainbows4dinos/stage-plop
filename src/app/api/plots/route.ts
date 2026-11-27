// POST /api/plots: save a plot online. Returns its id and a fresh edit token.
import { CREATE_LIMIT, cleanIncoming, makeId, makeToken, sha256 } from "@/lib/share";
import { getPlotStore } from "@/lib/server/plot-store";
import { creatorHash, json, unavailable } from "@/lib/server/request";

export async function POST(req: Request) {
  const store = getPlotStore();
  if (!store) return unavailable();
  const body = await req.json().catch(() => null);
  const clean = cleanIncoming(body);
  if ("error" in clean) return json({ error: clean.error }, 400);

  const who = await creatorHash(req);
  if (who && !(await store.allowCreate(who, CREATE_LIMIT))) {
    return json({ error: "That's a lot of new plots. Try again in an hour." }, 429);
  }

  const token = makeToken();
  const editTokenHash = await sha256(token);
  // ids are random; on the off chance one is taken, draw again
  for (let tries = 0; tries < 3; tries++) {
    const rec = await store.create({ id: makeId(), editTokenHash, plot: clean.plot });
    if (rec) return json({ id: rec.id, token, updatedAt: rec.updatedAt }, 201);
  }
  return json({ error: "Couldn't save right now. Try again." }, 500);
}
