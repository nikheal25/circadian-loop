# Circadian Loop

[![CI](https://github.com/nikheal25/circadian-loop/actions/workflows/ci.yml/badge.svg)](https://github.com/nikheal25/circadian-loop/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/circadian-loop)](https://www.npmjs.com/package/circadian-loop)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Circadian Loop makes a [pi](https://pi.dev) agent work on one goal indefinitely.

A goal can be endless; a context window cannot. Circadian Loop turns the
goal into a chain of **cycles**: the agent works, checkpoints everything it knows to
disk, calls `sleep`, and wakes with an empty context to rebuild from those
files and continue. Forever.

Pure extension — no shell scripts, no core patches, works on stock pi.

## How it works

- **`sleep` tool** — the agent calls it at a stopping point. A countdown
  screen appears (wake now · ±1h · ±15m · help · stop the loop).
- **Wake** — when the timer expires (or you pick *Wake now*), the extension
  compacts the session with instructions to discard everything except a
  pointer to the on-disk files, then re-injects `loop.md` as the next
  message. The agent resumes with a near-empty context; the files are its
  memory.
- **State on disk** — `loop.md` (the spec, project root) ·
  `.pi/loop/task.md` · `.pi/loop/inbox.md` · `.pi/loop/handoff.md` ·
  `loop-results/` (deliverables).
- **Async human contact** — you talk to the loop by typing into
  `.pi/loop/inbox.md` whenever you like. The agent reads it at every wake,
  and a message there outranks everything else it was going to do.

### The files

| Where | What | Who writes |
|-------|------|------------|
| `loop.md` (project root) | the loop's spec + every runtime standard | **you** |
| `.pi/loop/task.md` | the task list | agent |
| `.pi/loop/inbox.md` | every message between you and the agent | **both** |
| `.pi/loop/handoff.md` | last cycle's note to the next one | agent |
| `.pi/loop/work/` | agent scratch space | agent |
| `.pi/loop/cycles.jsonl` | one record per cycle, for evaluation | extension |
| `loop-results/` | deliverables | agent |

`loop.md` is yours. Edit the mission, the sleep rhythm, or your rules at any
time and the next cycle obeys them — no restart needed.

## Install

```bash
pi install npm:circadian-loop            # once published
pi install /path/to/this/folder -l  # or straight from disk, project-local
```

## Use

1. Run `pi` in an empty project and ask it to set up a loop. The bundled
   `circadian-loop` skill interviews you and writes `loop.md` plus the
   `.pi/loop/` files. You answer roughly four questions.
2. `pi --approve` — the agent reads `loop.md`, works, sleeps, wakes,
   repeats.
3. Leave notes in `.pi/loop/inbox.md` whenever you want; stop the loop from
   the sleep screen.

## The sleep screen

```
╭──────────────────────────────────────────────────────────────────╮
│                                                                  │
│  ⠹  Circadian Loop                              waking at 03:44  │
│                                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  5h 48m left                                                 3%  │
│                                                                  │
│  Reviewed 3 new job listings against the profile, shortlisted     │
│  one at Canva and parked a question about salary expectations.    │
│                                                                  │
│ ▸ Wake now                                                       │
│   +1h                                                            │
│   −1h                                                            │
│   +15m                                                           │
│   −15m                                                           │
│   Help                                                           │
│   Stop the loop                                                  │
│                                                                  │
│  ↑↓ select · enter apply                                         │
╰──────────────────────────────────────────────────────────────────╯
```

**Help** answers "what is this thing actually doing?" — the cycle number,
the last cycle's handoff note, how many tasks are open / waiting / done,
what's next, whether anything in your inbox needs you, and what the last
cycle cost in time, tool calls and tokens. Anything wrong with the loop
(missing `loop.md`, no open tasks left, a failed compaction, questions you
haven't answered) is listed under **Needs your attention**.

## Evaluation data

Every boundary appends JSON Lines to `.pi/loop/cycles.jsonl`: a `sleep`
record when the cycle ends and a `wake` record when the context is cleared.
Each `sleep` record carries two separate blocks:

- **`cycle`** — this cycle alone. Tokens, cost, tool calls, wall-clock.
  These are the numbers to quote.
- **`cumulative`** — session-to-date totals straight from pi's session
  branch. Not a per-cycle measurement; `cycle` is derived by subtracting the
  previous sleep's `cumulative`.

The file also records human interventions (`user_message`), sleep-screen
actions, and unplanned mid-cycle compactions.

## Development

```bash
npm test    # renders the cards and checks the layout invariants
```

The extension is a single TypeScript file that pi compiles at load time; it
has no build step. `buildSleepCard`, `buildHelpCard`, `readLoopStatus` and
`cycleDelta` are exported as pure functions so the layout and the metrics
can be tested without a terminal.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Release notes are in
[CHANGELOG.md](CHANGELOG.md); security reporting is in
[SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).
