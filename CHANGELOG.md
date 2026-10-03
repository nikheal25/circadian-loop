# Circadian Loop — Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- The generated `loop.md` template, the skill and the `sleep` tool guideline no
  longer tell the agent that cycles are logged automatically (the log is off
  unless `CIRCADIAN_DEBUG=1`). `sleep_overlay_action` added to the README
  event table.
- CONTRIBUTING, AGENTS and the PR template no longer prescribe a manual
  temp-directory loop test or hard-code a test count; the file layout lists
  `debug-log.test.ts`, and the write-scope rule matches the code.

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
  `.pi/loop/inbox.md`, `.pi/loop/handoff.md`, `.pi/loop/work/` and
  `loop-results/` from a short interview.
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
