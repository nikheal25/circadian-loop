# Circadian Loop — Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.8] - 2026-10-03

### Changed
- CI (`ci.yml`) now runs separate audit, typecheck, test (Node 22 and 24) and
  package jobs, with read-only permissions, timeouts and cancel-in-progress on
  pull requests.

### Removed
- The `publish.yml` workflow (npm and GitHub Packages). Releases are published
  by hand.

## [0.1.7] - 2026-10-03

### Added
- The publish workflow now also publishes the package to GitHub Packages as
  `@nikheal25/circadian-loop`, so it shows in the repo's Packages box.

## [0.1.6] - 2026-10-03

### Changed
- Package metadata: author set to Nick Gholap, LICENSE copyright updated, npm
  description and keywords reworded so the package is easier to find in search.
- README: added an Author section.

## [0.1.4] - 2026-10-03

### Fixed
- The red "Error: This operation was aborted" no longer appears after "Waking —
  compacting into a fresh cycle...". The `sleep` tool used to start the
  compaction inside its own run, which aborted the model request pi sends after
  a tool result. It now returns `terminate: true` and the compaction starts from
  the `agent_settled` event, once the run has stopped. The wake itself is
  unchanged. Requires a pi version that emits `agent_settled`.
- The generated `loop.md` template, the skill and the `sleep` tool guideline no
  longer tell the agent that cycles are logged automatically (the log is off
  unless `CIRCADIAN_DEBUG=1`). `sleep_overlay_action` added to the README
  event table.
- CONTRIBUTING, AGENTS and the PR template no longer prescribe a manual
  temp-directory loop test or hard-code a test count; the file layout lists
  `debug-log.test.ts`, and the write-scope rule matches the code.

### Removed
- The `loop-results/` folder. Bootstrap no longer creates it. The agent puts
  each deliverable where it belongs in the project and notes its path on the
  task line in `task.md`. Existing loops: delete the `loop-results/` and
  `.pi/loop/work/` lines from your `loop.md`.
- The `.pi/loop/work/` scratch folder. Bootstrap no longer creates it and the
  skill no longer mentions it. Nothing in the extension read it.

### Added
- `test/wake.test.ts`: the wake runs only after the run has settled.

## [0.1.3] - 2026-10-03

### Added
- `docs/architecture.md` and `docs/troubleshooting.md`.
- README: a four-step cycle summary and a "Stopping and restarting" section.

### Changed
- README: the Help screen description now says the cycle number and per-cycle
  cost need `CIRCADIAN_DEBUG=1`, matching the 0.1.1 behaviour.

## [0.1.1] - 2026-10-03

### Changed
- The cycle log (`.pi/loop/cycles.jsonl`) is now **off by default**. It is only
  written when pi is launched with `CIRCADIAN_DEBUG=1`; otherwise nothing is
  logged and `.pi/loop/` is not created by the log. Previously every typed
  message and every cycle boundary was written on every run.
- With the log off, the help screen has no cycle number or per-cycle stats and
  does not show the "last wake failed" / "compaction failed" warnings. Sleep
  and wake are unaffected.
- README, SECURITY.md and `.gitignore` comments updated to match.

## [0.1.0] - 2026-08-08

First public release.

### Added
- `sleep` tool: ends a cycle, shows a countdown screen, then compacts the
  context and re-injects `loop.md` to start the next cycle.
- Sleep screen with wake-now, ±1h, ±15m, help, and stop-the-loop actions.
- Help screen answering "what is this loop doing?" — cycle number, the last
  cycle's handoff note, mission, task counts, next task, inbox state, and
  the last cycle's wall-clock, tool calls, tokens and cost. Problems with
  the loop are listed under "Needs your attention".
- `circadian-loop` skill: bootstraps `loop.md`, `.pi/loop/task.md`,
  `.pi/loop/inbox.md`, `.pi/loop/handoff.md`, `.pi/loop/work/` from a short interview.
- Cycle log at `.pi/loop/cycles.jsonl`, recording per-cycle metrics, wake
  outcomes, human interventions and sleep-screen actions.
- Guarantee layer: an unplanned mid-cycle compaction triggers a
  reorientation message pointing the agent back at the loop files.
- Headless support: `sleep` waits out its timer in `print`, `rpc` and `json`
  modes instead of returning immediately.

- `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue
  and PR templates, and CI on Node 22 and 24.
- README banner and cycle diagram (`assets/`, SVG sources included).

### Notes
- Per-cycle metrics are recorded under `cycle`; session-to-date totals are
  recorded separately under `cumulative`. Quote `cycle`.
