// GET /api/plots/:id   read a plot (view link: anyone)
// PUT /api/plots/:id   save changes (needs the edit token)
import { cleanIncoming, isId, isToken, sameHash, sha256 } from "@/lib/share";
import { getPlotStore } from "@/lib/server/plot-store";
import { bearer, json, unavailable } from "@/lib/server/request";

export async function GET(req: Request, ctx: RouteContext<"/api/plots/[id]">) {
  const store = getPlotStore();
  if (!store) return unavailable();
  const { id } = await ctx.params;
  if (!isId(id)) return json({ error: "No plot here." }, 404);
  const rec = await store.get(id);
  if (!rec) return json({ error: "No plot here." }, 404);
  // With an edit token, also say whether it's still good (opening an edit link).
  const token = bearer(req);
  const canEdit = isToken(token) ? sameHash(rec.editTokenHash, await sha256(token)) : undefined;
  return json({ id: rec.id, plot: rec.plot, updatedAt: rec.updatedAt, ...(canEdit === undefined ? {} : { canEdit }) });
}

export async function PUT(req: Request, ctx: RouteContext<"/api/plots/[id]">) {
  const store = getPlotStore();
  if (!store) return unavailable();
  const { id } = await ctx.params;
  const token = bearer(req);
  if (!isId(id) || !isToken(token)) return json({ error: "That edit link isn't valid." }, 401);
  const rec = await store.get(id);
  // same answer for "no such plot" and "wrong token"
  if (!rec || !sameHash(rec.editTokenHash, await sha256(token))) {
    return json({ error: "That edit link isn't valid." }, 401);
  }
  const clean = cleanIncoming(await req.json().catch(() => null));
  if ("error" in clean) return json({ error: clean.error }, 400);
  const saved = await store.update(id, clean.plot);
  return json({ id, updatedAt: saved?.updatedAt });
}
