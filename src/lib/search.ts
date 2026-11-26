// Gear search for the Add Gear drawer. Small and forgiving on purpose: every
// word you type has to match something (name, brand, alias, category or note),
// prefixes count, and short typos ("twn", "pedaltrian") still find the gear.
import type { GearDef } from "./gear.ts";

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Letters of `q` appear in `s` in order ("twn" in "twin"). */
function subsequence(q: string, s: string) {
  let i = 0;
  for (const ch of s) if (ch === q[i]) i++;
  return i === q.length;
}

/** True when a and b are at most one edit apart (insert, delete, swap or change). */
function oneEdit(a: string, b: string) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const restA = a.slice(i + 1),
    restB = b.slice(i + 1);
  if (a.length === b.length) {
    // change one letter, or swap two neighbors
    return restA === restB || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

function tokenScore(t: string, g: GearDef): number {
  const name = norm(g.name);
  const nameWords = words(g.name);
  const brand = words(g.brand ?? "");
  const aliases = g.aliases.map(norm);
  const aliasWords = g.aliases.flatMap(words);
  const cat = words(g.cat);
  let best = 0;
  const hit = (score: number) => (best = Math.max(best, score));

  if (nameWords.some((w) => w === t)) hit(12);
  if (nameWords.some((w) => w.startsWith(t))) hit(10);
  if (aliases.includes(t) || aliasWords.includes(t)) hit(9);
  if (brand.some((w) => w.startsWith(t))) hit(8);
  if (aliasWords.some((w) => w.startsWith(t))) hit(7);
  if (name.includes(t)) hit(6);
  if (cat.some((w) => w.startsWith(t))) hit(4);
  if (norm(g.note).includes(t)) hit(2);
  if (best === 0 && t.length >= 3) {
    if ([...nameWords, ...aliasWords, ...brand].some((w) => w.length >= t.length && subsequence(t, w))) hit(3);
    if (t.length >= 4 && [...nameWords, ...aliasWords, ...brand].some((w) => oneEdit(t, w))) hit(3);
  }
  return best;
}

/** Gear matching the query, best first. An empty query matches nothing. */
export function searchGear(query: string, catalog: GearDef[]): GearDef[] {
  const tokens = words(query);
  if (!tokens.length) return [];
  const scored: { g: GearDef; score: number; i: number }[] = [];
  catalog.forEach((g, i) => {
    let total = 0;
    for (const t of tokens) {
      const s = tokenScore(t, g);
      if (!s) return;
      total += s;
    }
    scored.push({ g, score: total, i });
  });
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.g);
}
