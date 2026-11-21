# Stage Plop

Stage plots that don't suck. Plop gear on a stage, move it around, and the input list builds itself. Part of the [Seeens](https://www.seeens.com) family.

## What works now

- Gear library with real footprints: kits and a riser, guitar and bass rigs, Pedaltrain boards, keys, vocal mics, wedges, DI boxes and power drops.
- **Plot view** (default) for arranging: straight overhead, drag to move, drag the magenta dot to rotate (15° steps), alignment guides, a 6 in snap grid, arrow keys to nudge.
- **3D view** for looking: drag empty space to orbit, or jump between four preset angles.
- The input list, monitor mixes and power drops come from what's on the stage, in engineer order (drums, bass, guitar, keys, vocals). **Copy Input List** copies them as tab-separated text.
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

- `src/lib/gear.ts` the gear catalog: names, sizes, suggested inputs.
- `src/lib/plot.ts` plot data and everything derived from it (input list, copy text, parsing saved plots). Pure, tested in `plot.test.ts`.
- `src/lib/stage/` the Three.js side: `engine.ts` (scene, camera, pointer handling), `builders.ts` (gear models), `sound.ts` (the plop).
- `src/components/` the React panels around the stage.
