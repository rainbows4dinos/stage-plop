// Where shared plots live. Supabase in production; an in-memory store for
// local development and tests (PLOT_STORE=memory). With neither set up,
// sharing reports itself unavailable and the rest of the app still works.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Plot } from "@/lib/plot";

export type PlotRecord = {
  id: string;
  editTokenHash: string;
  plot: Plot;
  createdAt: string;
  updatedAt: string;
};

export interface PlotStore {
  get(id: string): Promise<PlotRecord | null>;
  create(r: { id: string; editTokenHash: string; plot: Plot; creatorHash: string | null }): Promise<PlotRecord>;
  update(id: string, plot: Plot): Promise<PlotRecord | null>;
  setTokenHash(id: string, editTokenHash: string): Promise<void>;
  /** Plots made from one address since a time, for rate limiting. */
  countCreatedSince(creatorHash: string, since: Date): Promise<number>;
}

type Row = {
  id: string;
  edit_token_hash: string;
  data: Plot;
  created_at: string;
  updated_at: string;
};
const fromRow = (r: Row): PlotRecord => ({
  id: r.id,
  editTokenHash: r.edit_token_hash,
  plot: r.data,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

class SupabaseStore implements PlotStore {
  constructor(private db: SupabaseClient) {}
  async get(id: string) {
    const { data, error } = await this.db.from("plots").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as Row) : null;
  }
  async create(r: { id: string; editTokenHash: string; plot: Plot; creatorHash: string | null }) {
    const { data, error } = await this.db
      .from("plots")
      .insert({
        id: r.id,
        edit_token_hash: r.editTokenHash,
        band: r.plot.band,
        data: r.plot,
        creator_hash: r.creatorHash,
      })
      .select("*")
      .single();
    if (error) throw error;
    return fromRow(data as Row);
  }
  async update(id: string, plot: Plot) {
    const { data, error } = await this.db
      .from("plots")
      .update({ data: plot, band: plot.band, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as Row) : null;
  }
  async setTokenHash(id: string, editTokenHash: string) {
    const { error } = await this.db.from("plots").update({ edit_token_hash: editTokenHash }).eq("id", id);
    if (error) throw error;
  }
  async countCreatedSince(creatorHash: string, since: Date) {
    const { count, error } = await this.db
      .from("plots")
      .select("id", { count: "exact", head: true })
      .eq("creator_hash", creatorHash)
      .gte("created_at", since.toISOString());
    if (error) throw error;
    return count ?? 0;
  }
}

class MemoryStore implements PlotStore {
  private rows = new Map<string, PlotRecord & { creatorHash: string | null }>();
  async get(id: string) {
    const r = this.rows.get(id);
    return r ? structuredClone(r) : null;
  }
  async create(r: { id: string; editTokenHash: string; plot: Plot; creatorHash: string | null }) {
    const now = new Date().toISOString();
    const rec = {
      id: r.id,
      editTokenHash: r.editTokenHash,
      plot: r.plot,
      createdAt: now,
      updatedAt: now,
      creatorHash: r.creatorHash,
    };
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
  async countCreatedSince(creatorHash: string, since: Date) {
    return [...this.rows.values()].filter((r) => r.creatorHash === creatorHash && new Date(r.createdAt) >= since)
      .length;
  }
}

// One memory store per server process, kept across hot reloads.
const g = globalThis as { __stagePlopMemoryStore?: MemoryStore };

export function getPlotStore(): PlotStore | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    return new SupabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  }
  if (process.env.PLOT_STORE === "memory") return (g.__stagePlopMemoryStore ??= new MemoryStore());
  return null;
}
