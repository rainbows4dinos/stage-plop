# Working on Stage Plop

Read [README.md](README.md) for scope.

- Stage Plop is a sibling of Seeens, not part of it: separate repo, separate Vercel and (later) Supabase projects. It must work without an account.
- Brand: the tokens at the top of `src/app/globals.css` are copied from Seeens (`rainbows4dinos/seeens`, `src/app/globals.css`). Keep names identical so they're easy to diff. Ink is the primary accent; plate colors are for highlights and tags (cyan = DI, yellow = mixes, magenta = selection). Square corners, Hanken Grotesk for display, IBM Plex Mono for UI.
- Write button and form labels in APA title case. Calls to action lead with a verb.
- Gear is data in `src/data/gear/*.json` (sizes in inches); see README, Adding Gear. Never rename a shipped gear `id`: saved plots use it.
- Units in the app are feet; `+z` points at the audience. Gear faces `+z` at rotation 0.
- Keep plot logic in `src/lib/plot.ts` pure and covered by tests. The engine owns Three.js and pointer handling; React owns panels and state.
- Changes go through PRs; don't commit to `main` directly.
- Run lint, format, typecheck, tests and build before a PR. For UI changes, check Plot and 3D views, phone width, and keyboard use.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->
