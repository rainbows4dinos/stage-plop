// The plots this browser knows about. Each can be linked to a shared copy
// online (id + edit token). Pure functions over plain data; the component
// reads and writes localStorage.
import { EXAMPLE_PLOT, parsePlot, type Plot } from "./plot.ts";
import { isId, isToken } from "./share.ts";

export type PlotLink = { id: string; token: string };

export type LocalPlot = {
  key: string;
  plot: Plot;
  link?: PlotLink;
  /** When this browser last changed it. */
  updatedAt: string;
  /** The server's updatedAt from the last successful save or load. */
  serverUpdatedAt?: string;
  /** Changed here since the last successful save online. */
  unsaved?: boolean;
};

export type LocalState = { current: string; plots: LocalPlot[] };

export const MAX_LOCAL_PLOTS = 50;
/** localStorage keys. The legacy key held the single plot saved before this list existed. */
export const PLOTS_KEY = "stage-plop-plots";
export const LEGACY_PLOT_KEY = "stage-plop-v1";

export const newKey = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const now = () => new Date().toISOString();

export const blankPlot = (stage = EXAMPLE_PLOT.stage): Plot => ({ band: "", stage: { ...stage }, items: [] });

/** Read stored state. `legacy` is the single plot saved before this list existed. */
export function parseLocal(raw: unknown, legacy: unknown): LocalState {
  const plots: LocalPlot[] = [];
  const r = raw as Partial<LocalState> | null;
  if (r && Array.isArray(r.plots)) {
    for (const p of r.plots as Partial<LocalPlot>[]) {
      const plot = parsePlot(p?.plot);
      if (!p || typeof p.key !== "string" || !plot) continue;
      const link =
        p.link && isId(p.link.id) && isToken(p.link.token) ? { id: p.link.id, token: p.link.token } : undefined;
      plots.push({
        key: p.key,
        plot,
        ...(link ? { link } : {}),
        updatedAt: String(p.updatedAt ?? now()),
        ...(p.serverUpdatedAt ? { serverUpdatedAt: String(p.serverUpdatedAt) } : {}),
        ...(link && p.unsaved ? { unsaved: true } : {}),
      });
    }
  }
  if (!plots.length) {
    plots.push({ key: newKey(), plot: parsePlot(legacy) ?? EXAMPLE_PLOT, updatedAt: now() });
  }
  const current = plots.some((p) => p.key === r?.current) ? (r!.current as string) : plots[0].key;
  return { current, plots: plots.slice(0, MAX_LOCAL_PLOTS) };
}

export const currentOf = (s: LocalState) => s.plots.find((p) => p.key === s.current) ?? s.plots[0];

/** Change the current plot. An edit (touch) marks a shared plot as needing a save. */
export function updateCurrent(s: LocalState, patch: Partial<Omit<LocalPlot, "key">>, touch = true): LocalState {
  return {
    ...s,
    plots: s.plots.map((p) =>
      p.key === s.current
        ? { ...p, ...(touch ? { updatedAt: now(), unsaved: !!(patch.link ?? p.link) } : {}), ...patch }
        : p,
    ),
  };
}

export function addPlot(s: LocalState, p: Omit<LocalPlot, "key" | "updatedAt"> & { updatedAt?: string }): LocalState {
  const key = newKey();
  return {
    current: key,
    plots: [{ ...p, key, updatedAt: p.updatedAt ?? now() }, ...s.plots].slice(0, MAX_LOCAL_PLOTS),
  };
}

export const switchTo = (s: LocalState, key: string): LocalState =>
  s.plots.some((p) => p.key === key) ? { ...s, current: key } : s;

/** Remove a plot from this browser. Shared copies stay online. Always leaves one plot. */
export function removePlot(s: LocalState, key: string): LocalState {
  const plots = s.plots.filter((p) => p.key !== key);
  if (!plots.length) return addPlot({ current: "", plots: [] }, { plot: blankPlot() });
  return { current: s.current === key ? plots[0].key : s.current, plots };
}

/**
 * Opening an edit link: bring the shared plot into this browser (or refresh
 * the copy already here) and make it current.
 */
export function openShared(s: LocalState, link: PlotLink, plot: Plot, serverUpdatedAt: string): LocalState {
  const existing = s.plots.find((p) => p.link?.id === link.id);
  if (!existing) return addPlot(s, { plot, link, serverUpdatedAt, updatedAt: serverUpdatedAt });
  const keepLocal = existing.serverUpdatedAt === serverUpdatedAt; // nothing new online
  return {
    current: existing.key,
    plots: s.plots.map((p) =>
      p.key === existing.key
        ? { ...p, link, ...(keepLocal ? {} : { plot, serverUpdatedAt, updatedAt: serverUpdatedAt, unsaved: false }) }
        : p,
    ),
  };
}

/** A local copy has changes the server hasn't seen. */
export const hasUnsaved = (p: LocalPlot) => !!p.link && !!p.unsaved;
