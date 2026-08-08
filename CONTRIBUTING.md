# Contributing

## Setup

```bash
npm install
npm test          # 24 tests, no API calls, ~1s
npm run typecheck # strict tsc
```

Node 22+ is required (the tests use `--experimental-strip-types`).

## Layout

```
.pi/extensions/circadian-loop/index.ts   the whole extension, one file
.pi/skills/circadian-loop/SKILL.md       routing + the protocol's rationale
.pi/skills/circadian-loop/bootstrap.md   the first-run interview + templates
test/layout.test.ts                      sleep + help screen rendering
test/status.test.ts                      loop-file parsing, against real files
```

There is no build step. pi compiles the TypeScript at load time.

## House rules

- **"Cycle", never "session".** A cycle boundary is not a session boundary —
  the extension compacts the context inside one pi session. Using "session"
  for a cycle describes a mechanism this protocol does not use. "Session" is
  correct only for pi's own machinery (`sessionManager`, `ctx.compact()`).
- **Keep the extension self-contained.** No network calls, no spawned
  processes, no writes outside `loop.md`, `.pi/loop/` and `loop-results/`.
  Reviewers read this file first; it should stay easy to audit.
- **Do not vendor pi's utilities.** `@earendil-works/pi-tui` exports
  `visibleWidth`, `truncateToWidth`, `wrapTextWithAnsi` and `sliceByColumn`.
  Import them. pi resolves these at load time.
- **Render functions stay pure.** `buildSleepCard`, `buildHelpCard`,
  `readLoopStatus` and `cycleDelta` are exported so they can be tested
  without a terminal. Never read from disk inside `render()` — it runs on
  every tick.
- **Every rendered line must be exactly the requested width.** Overlays
  composite over existing terminal content; a short line leaves a visible
  gap. The layout tests enforce this.

## Testing a real loop

```bash
cd ../try-circadian     # 60-second cycles
pi install /absolute/path/to/circadian-loop -l
pi --approve
```

Watch at least three cycles complete before shipping a change to the
sleep/wake path.

## Pull requests

- One concern per PR.
- Add or update a test for behaviour changes.
- Update `CHANGELOG.md` under `## [Unreleased]`.
- `npm test` and `npm run typecheck` must pass.
