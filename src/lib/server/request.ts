import "server-only";
import { sha256 } from "@/lib/share";

/** A salted hash of the caller's address, for rate limiting. Kept an hour at most. */
export async function creatorHash(req: Request): Promise<string | null> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  if (!ip) return null;
  return sha256(`${process.env.RATE_LIMIT_SALT ?? "stage-plop"}:${ip}`);
}

/** The edit token from `Authorization: Bearer <token>`. */
export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const unavailable = () =>
  json({ error: "Sharing isn't set up on this server yet. Your plot is still saved in this browser." }, 503);
