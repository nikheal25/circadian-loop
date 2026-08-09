# TODO

## Nick to do

- [ ] Delete the premature `v0.1.0` tag and release — the package is not finished yet. `gh release delete v0.1.0 --yes --cleanup-tag`, then `git push --delete origin v0.1.0` if the tag survives. Retag only when you actually publish.

- [ ] Run a real multi-cycle loop before announcing. `cd ../try-circadian && pi --approve`, then `follow loop.md`. Watch 3+ cycles complete. Nothing has driven a live pi session end to end yet.
- [ ] `npm login`, then `npm publish` (or cut a GitHub release and let `.github/workflows/publish.yml` do it — needs an `NPM_TOKEN` repo secret).
- [ ] Record a demo (countdown ticking, Help screen opening). Upload it to a GitHub release or issue to get a `user-attachments` URL, drop that URL under the badges in README.md, and set it as `pi.video` in `package.json` — video beats image on the pi.dev gallery card.
- [ ] After `npm publish`, add the npm badge back to README.md line 4: `[![npm](https://img.shields.io/npm/v/circadian-loop)](https://www.npmjs.com/package/circadian-loop)`. It was removed because it renders "npm package not found" until the package exists.

## Claude to do — extension (`.pi/extensions/circadian-loop/index.ts`)

- [ ] Verify the wake path against a live session. `ctx.compact()` → `onComplete` → `pi.sendUserMessage` is currently verified only against pi's type definitions and docs, not observed running.
- [ ] Confirm `session_compact` fires for our own boundary compaction. If it does not, `boundaryInFlight` and its 1s settle window are dead weight and should go.
- [ ] Wake failures are only partly observable: `pi.sendUserMessage` returns void and pi swallows the rejection internally, so an async failure (bad API key, expired auth) never reaches `wake_failed`. Ask upstream for an observable send, or poll `agent_settled` after a boundary.
- [ ] `readCycleLog` allocates the buffer outside the try that owns the fd. Unreachable today because `LOG_TAIL_BYTES` caps it at 256 KB, but move it inside.
- [ ] Cap `.pi/loop/cycles.jsonl` growth. It grows forever; `readCycleLog` only reads the last 256 KB, so the help screen silently stops seeing old cycles. Decide: rotate, or document the cap.
- [ ] Handle terminal resize on the sleep screen. The overlay requests a fixed 68 columns; below `minWidth` 46 the layout is untested against a live resize.
- [ ] Decide whether `stop` should also write a `handoff.md` line. Today it shuts down without recording that a human stopped the loop.
- [ ] Consider moving `typescript` / `@types/node` out of `devDependencies`. pi runs `npm install` when installing from npm or git, so users may download them.

## Claude to do — skill (`.pi/skills/circadian-loop/`)

- [ ] Bootstrap has never been run end to end against a real empty folder. Walk the full 7-step interview once and fix whatever the agent gets wrong.
- [ ] The `loop.md` template says "if these numbers are unreadable: 600" but the extension's fallback constant is also 600 — confirm they cannot drift, or derive one from the other.

## Done

- [x] Rebuilt the sleep screen: padding, slim progress bar, full-width selection highlight, no emoji, 21 rows, every line exactly the box width
- [x] Replaced the file viewer with the Help screen
- [x] Fixed 9 bugs found in iteration-3 (silent loop death, headless no-sleep, cumulative-vs-per-cycle metrics, unplanned-compaction stranding, unrecorded sleep time, per-frame disk reads, cwd-relative paths, terminal overflow, 150 lines of vendored width math)
- [x] Renamed everything to Circadian Loop / `circadian-loop`
- [x] 24 tests, strict typecheck, CI on Node 22 and 24
