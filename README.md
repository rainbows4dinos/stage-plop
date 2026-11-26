# Stage Plop

Stage plots that don't suck. Plop gear on a stage, move it around, and the input list builds itself. Part of the [Seeens](https://www.seeens.com) family.

**Try it:** [stage-plop.vercel.app](https://stage-plop.vercel.app/)

![Stage Plop in 3D view: a four-piece band's gear on a 16 × 12 ft stage, with the gear library on the left and the auto-built input list on the right](docs/screenshot.png)

## What works now

- Gear library with real footprints: kits and a riser, guitar and bass rigs, Pedaltrain boards, keys, vocal mics, wedges, DI boxes and power drops.
- **Add Gear** (press `/`): search by name, brand or nickname ("fridge" finds the SVT), forgiving of typos. Arrow keys and Enter plop gear without closing, so you can add a whole backline in a row. Recent picks show first; browsing by category is in the same drawer, which is a bottom sheet on phones.
- **Plot view** (default) for arranging: straight overhead, drag to move, drag the magenta dot to rotate (15° steps), alignment guides, a 6 in snap grid, arrow keys to nudge.
- **3D view** for looking: drag empty space to orbit, or jump between four preset angles.
- The input list, monitor mixes and power drops come from what's on the stage, in engineer order (drums, bass, guitar, keys, vocals). **Copy Input List** copies them as tab-separated text.
- Stage size, snap and Clear Stage live on the stage size tag.
- Plots save in the browser.

## Next

- A print-ready plot sheet (PDF: plot, input list, mixes, contact).
- Shareable plot links (Supabase): an edit link and a view-only link, no account needed.
- Connect to Seeens: attach a plot to a claimed band profile.
- Better gear models and per-gear sounds.

## Develop

```sh
npm install
npm run dev
```

Checks: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run build`.

## Layout

- `src/data/gear/*.json` the gear catalog, one file per category. See [Adding Gear](#adding-gear).
- `src/lib/gear.ts` loads the catalog; `src/lib/gear-schema.ts` defines and checks it.
- `src/lib/plot.ts` plot data and everything derived from it (input list, copy text, parsing saved plots). Pure, tested in `plot.test.ts`.
- `src/lib/stage/` the Three.js side: `engine.ts` (scene, camera, pointer handling), `builders.ts` (gear models), `sound.ts` (the plop).
- `src/components/` the React panels around the stage.

## Adding Gear

Gear lives in `src/data/gear/`, one JSON file per category. Adding a piece is one entry and no code:

```json
{
  "id": "superReverb",
  "name": "Fender Super Reverb",
  "brand": "Fender",
  "aliases": ["super", "super reverb", "4x10 combo", "guitar amp"],
  "note": "4x10 combo, 24.5 × 10.5 in",
  "label": "Guitar",
  "numbered": true,
  "shape": { "kind": "combo", "w": 24.5, "h": 27, "d": 10.5, "grill": "light" },
  "inputs": "mic"
}
```

- **Sizes are inches**, from the maker's spec sheet. Within an inch is fine.
- **`id`** is camelCase and unique across all files. Saved plots refer to it, so don't rename one that's shipped.
- **`label`** is what the piece is called on stage. With `"numbered": true` it becomes "Guitar 1", "Guitar 2" and so on.
- **`aliases`** are other names people search for, in lowercase.
- **`shape.kind`** picks the 3D model: `kit`, `riser`, `combo`, `stack`, `board`, `keys`, `mic`, `wedge` or `box`. Each needs its own size fields; `src/lib/gear-schema.ts` lists them.
- **`inputs`** is a preset (`none`, `mic`, `di`, `stereo-di`, `di+mic`, `vocal`) or a list of `{ "name", "source", "stand" }`. `{L}` in a name becomes the piece's label.
- Flags: `handed` (kits that can be flipped for a lefty), `riser`, `monitor`, `power`.

A new category file also needs adding to `GEAR_FILES` in `src/lib/gear.ts`.

`npm test` checks every entry and names the file, entry and field when something's wrong.
