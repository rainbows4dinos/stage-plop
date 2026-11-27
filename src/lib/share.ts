// Share links. A plot online has two links:
//   view: /p/<id>               anyone with it can look
//   edit: /edit/<id>#k=<token>  anyone with it can change the plot
// The token lives in the URL fragment, so browsers never send it to the
// server in the request line or in logs; the app sends it in a header.
// Only a hash of the token is stored.
import { parsePlot, type Plot } from "./plot.ts";

export const ID_LENGTH = 10;
export const MAX_ITEMS = 300;
export const MAX_BYTES = 200_000;
/** New plots per address per hour. */
export const CREATE_LIMIT = 20;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // no 0/O, 1/l/I

export function makeId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH * 2));
  let out = "";
  // rejection sampling keeps every letter equally likely
  for (const b of bytes) {
    if (b >= 256 - (256 % ALPHABET.length)) continue;
    out += ALPHABET[b % ALPHABET.length];
    if (out.length === ID_LENGTH) return out;
  }
  return out + makeId().slice(0, ID_LENGTH - out.length);
}

export const isId = (s: unknown): s is string =>
  typeof s === "string" && s.length === ID_LENGTH && [...s].every((c) => ALPHABET.includes(c));

/** 256 random bits, base64url. */
export function makeToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const isToken = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{43}$/.test(s);

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time compare for two hex digests. */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Check and clean a plot coming in from the network. Returns a reason when it's refused. */
export function cleanIncoming(body: unknown): { plot: Plot } | { error: string } {
  const size = JSON.stringify(body ?? null).length;
  if (size > MAX_BYTES) return { error: "That plot is too big to save." };
  const raw = (body as { plot?: unknown } | null)?.plot;
  const plot = parsePlot(raw);
  if (!plot) return { error: "That doesn't look like a stage plot." };
  if (plot.items.length > MAX_ITEMS) return { error: `A plot can hold up to ${MAX_ITEMS} pieces.` };
  return { plot: { ...plot, band: plot.band.slice(0, 80) } };
}

export const viewPath = (id: string) => `/p/${id}`;
export const editPath = (id: string, token: string) => `/edit/${id}#k=${token}`;

/** Read the token out of an edit link's fragment ("#k=..."). */
export function tokenFromHash(hash: string): string | null {
  const k = new URLSearchParams(hash.replace(/^#/, "")).get("k");
  return isToken(k) ? k : null;
}
