// POST /api/plots/:id/token: make a new edit link. The old one stops working.
import { isId, isToken, makeToken, sameHash, sha256 } from "@/lib/share";
import { getPlotStore } from "@/lib/server/plot-store";
import { bearer, json, unavailable } from "@/lib/server/request";

export async function POST(req: Request, ctx: RouteContext<"/api/plots/[id]/token">) {
  const store = getPlotStore();
  if (!store) return unavailable();
  const { id } = await ctx.params;
  const token = bearer(req);
  if (!isId(id) || !isToken(token)) return json({ error: "That edit link isn't valid." }, 401);
  const rec = await store.get(id);
  if (!rec || !sameHash(rec.editTokenHash, await sha256(token))) {
    return json({ error: "That edit link isn't valid." }, 401);
  }
  const fresh = makeToken();
  await store.setTokenHash(id, await sha256(fresh));
  return json({ id, token: fresh });
}
