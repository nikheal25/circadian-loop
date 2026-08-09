# Circadian Loop — Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
