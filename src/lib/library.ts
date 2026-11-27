// A band's own stuff: the gear they use (Your Rig) and whole stages they've
// saved (setups). Pure data, so it can move from the browser to the band's
// account (#11) without changing shape.
import { GEAR, defOf, type CustomGear } from "./gear.ts";
import { validateCustom } from "./gear-schema.ts";
import { clampStage, nextLabel, type PlotItem } from "./plot.ts";

/** One piece in Your Rig: a catalog id, or a custom piece. */
export type RigEntry = { type: string; custom?: CustomGear };

export type Setup = {
  id: string;
  name: string;
  /** The stage it was saved on, so it can scale down to smaller stages. */
  stage: { w: number; d: number };
  items: Omit<PlotItem, "id">[];
  savedAt: string;
};

export const RIG_MAX = 40;
export const SETUPS_MAX = 30;

/** Custom pieces count as the same rig entry when their names match. */
export const rigKey = (e: RigEntry) =>
  e.type === "custom" && e.custom ? `custom:${e.custom.name.trim().toLowerCase()}` : e.type;

/** Add pieces to the front of the rig, newest first, without duplicates. */
export function addToRig(rig: RigEntry[], add: RigEntry[]): RigEntry[] {
  const fresh = add
    .filter((e) => defOf(e))
    .map((e) => (e.type === "custom" ? { type: "custom", custom: e.custom } : { type: e.type }));
  const keys = new Set<string>();
  const out: RigEntry[] = [];
  for (const e of [...fresh, ...rig]) {
    const k = rigKey(e);
    if (keys.has(k)) continue;
    keys.add(k);
    out.push(e);
  }
  return out.slice(0, RIG_MAX);
}

export const removeFromRig = (rig: RigEntry[], key: string) => rig.filter((e) => rigKey(e) !== key);

export function parseRig(value: unknown): RigEntry[] {
  if (!Array.isArray(value)) return [];
  const ok = value.filter((v): v is RigEntry => {
    if (!v || typeof v !== "object" || typeof (v as RigEntry).type !== "string") return false;
    const e = v as RigEntry;
    return e.type === "custom" ? validateCustom(e.custom).length === 0 : !!GEAR[e.type];
  });
  return addToRig([], ok);
}

/** Save a stage as a setup. Positions are kept relative to the stage center. */
export function makeSetup(name: string, items: PlotItem[], stage: { w: number; d: number }, id: string): Setup {
  return {
    id,
    name: name.trim().slice(0, 60) || "Untitled Setup",
    stage: { ...stage },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    items: items.filter((i) => defOf(i)).map(({ id: _id, ...rest }) => rest),
    savedAt: new Date().toISOString(),
  };
}

/**
 * Lay a setup out on a stage. A setup from a bigger stage is squeezed to fit
 * (positions only, gear keeps its real size). Labels that would clash with
 * pieces already on the stage get the next free number.
 */
export function placeSetup(
  setup: Setup,
  stage: { w: number; d: number },
  existing: Pick<PlotItem, "type" | "label" | "custom">[] = [],
): Omit<PlotItem, "id">[] {
  const sx = Math.min(1, (stage.w - 1) / Math.max(1, setup.stage.w - 1));
  const sz = Math.min(1, (stage.d - 1) / Math.max(1, setup.stage.d - 1));
  const placed: Omit<PlotItem, "id">[] = [];
  for (const it of setup.items) {
    const def = defOf(it);
    if (!def) continue;
    const taken = [...existing, ...placed];
    const clash = taken.some((t) => t.label === it.label);
    placed.push({
      ...it,
      x: Math.round(it.x * sx * 2) / 2,
      z: Math.round(it.z * sz * 2) / 2,
      label: clash ? nextLabel(taken, def) : it.label,
    });
  }
  return placed;
}

export function parseSetups(value: unknown): Setup[] {
  if (!Array.isArray(value)) return [];
  const out: Setup[] = [];
  for (const raw of value as Partial<Setup>[]) {
    if (!raw || typeof raw.id !== "string" || typeof raw.name !== "string" || !Array.isArray(raw.items)) continue;
    const stage = clampStage(Number(raw.stage?.w), Number(raw.stage?.d));
    const items = (raw.items as Partial<PlotItem>[]).flatMap((i) => {
      if (!i || typeof i.type !== "string") return [];
      const custom =
        i.type === "custom" && validateCustom(i.custom).length === 0 ? (i.custom as CustomGear) : undefined;
      const def = i.type === "custom" ? (custom ? defOf({ type: "custom", custom }) : undefined) : GEAR[i.type];
      if (!def) return [];
      return [
        {
          type: i.type,
          label: typeof i.label === "string" && i.label ? i.label : def.base,
          x: Number(i.x) || 0,
          z: Number(i.z) || 0,
          rot: Number(i.rot) || 0,
          ...(i.lefty === true && def.handed ? { lefty: true } : {}),
          ...(custom ? { custom } : {}),
        },
      ];
    });
    out.push({ id: raw.id, name: raw.name.slice(0, 60), stage, items, savedAt: String(raw.savedAt ?? "") });
  }
  return out.slice(0, SETUPS_MAX);
}
