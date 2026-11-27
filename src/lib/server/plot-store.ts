// Where shared plots live. Upstash Redis in production (free tier, never
// pauses, added from the Vercel Marketplace); an in-memory store for local
// development and tests (PLOT_STORE=memory). With neither set up, sharing
// reports itself unavailable and the rest of the app still works.
//
// Keys:
//   plot:<id>                    JSON PlotRecord
//   rl:create:<hash>:<hour>      count of new plots from one address this hour
import "server-only";
import { Redis } from "@upstash/redis";
import type { Plot } from "@/lib/plot";

export type PlotRecord = {
  id: string;
  /** SHA-256 of the edit token, hex. The token itself is never stored. */
  editTokenHash: string;
  plot: Plot;
  createdAt: string;
  updatedAt: string;
};

export interface PlotStore {
  get(id: string): Promise<PlotRecord | null>;
  /** Returns null if the id is already taken. */
  create(r: { id: string; editTokenHash: string; plot: Plot }): Promise<PlotRecord | null>;
  update(id: string, plot: Plot): Promise<PlotRecord | null>;
  setTokenHash(id: string, editTokenHash: string): Promise<void>;
  /** Count one new plot from an address and say whether it's within the hourly limit. */
  allowCreate(creatorHash: string, perHour: number): Promise<boolean>;
}

const hourBucket = () => Math.floor(Date.now() / 3_600_000);
const plotKey = (id: string) => `plot:${id}`;

class RedisStore implements PlotStore {
  constructor(private redis: Redis) {}
  async get(id: string) {
    // the client parses JSON values for us
    return (await this.redis.get<PlotRecord>(plotKey(id))) ?? null;
  }
  async create(r: { id: string; editTokenHash: string; plot: Plot }) {
    const now = new Date().toISOString();
    const rec: PlotRecord = { ...r, createdAt: now, updatedAt: now };
    const ok = await this.redis.set(plotKey(r.id), rec, { nx: true });
    return ok ? rec : null;
  }
  async update(id: string, plot: Plot) {
    const rec = await this.get(id);
    if (!rec) return null;
    const next = { ...rec, plot, updatedAt: new Date().toISOString() };
    await this.redis.set(plotKey(id), next, { xx: true });
    return next;
  }
  async setTokenHash(id: string, editTokenHash: string) {
    const rec = await this.get(id);
    if (rec) await this.redis.set(plotKey(id), { ...rec, editTokenHash }, { xx: true });
  }
  async allowCreate(creatorHash: string, perHour: number) {
    const key = `rl:create:${creatorHash}:${hourBucket()}`;
    const [count] = await this.redis.multi().incr(key).expire(key, 3600).exec<[number, number]>();
    return count <= perHour;
  }
}

class MemoryStore implements PlotStore {
  private rows = new Map<string, PlotRecord>();
  private counts = new Map<string, number>();
  async get(id: string) {
    const r = this.rows.get(id);
    return r ? structuredClone(r) : null;
  }
  async create(r: { id: string; editTokenHash: string; plot: Plot }) {
    if (this.rows.has(r.id)) return null;
    const now = new Date().toISOString();
    const rec = { ...r, createdAt: now, updatedAt: now };
    this.rows.set(r.id, rec);
    return structuredClone(rec);
  }
  async update(id: string, plot: Plot) {
    const r = this.rows.get(id);
    if (!r) return null;
    r.plot = plot;
    r.updatedAt = new Date().toISOString();
    return structuredClone(r);
  }
  async setTokenHash(id: string, editTokenHash: string) {
    const r = this.rows.get(id);
    if (r) r.editTokenHash = editTokenHash;
  }
  async allowCreate(creatorHash: string, perHour: number) {
    const key = `${creatorHash}:${hourBucket()}`;
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    return n <= perHour;
  }
}

// One memory store per server process, kept across hot reloads.
const g = globalThis as { __stagePlopMemoryStore?: MemoryStore };

export function getPlotStore(): PlotStore | null {
  // The Vercel Marketplace integration sets KV_REST_API_*; Upstash's own docs use UPSTASH_REDIS_REST_*.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new RedisStore(new Redis({ url, token }));
  if (process.env.PLOT_STORE === "memory") return (g.__stagePlopMemoryStore ??= new MemoryStore());
  return null;
}
