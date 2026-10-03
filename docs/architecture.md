# Architecture

Circadian Loop is one pi extension and one skill. There is no build step and no background process.

```
Skill      .pi/skills/circadian-loop/      Setup interview (bootstrap.md). Writes loop.md and the loop's files.
Extension  .pi/extensions/circadian-loop/  The sleep tool, the countdown screen, the wake.
Files      loop.md + .pi/loop/             The loop's only memory.
```

## Why files, not conversation

A conversation fills up and gets compacted, and the agent loses the thread. Circadian Loop treats the conversation as disposable and keeps every durable fact on disk. A fresh cycle rebuilds itself from five files: `loop.md`, `inbox.md`, `handoff.md`, `task.md` and the deliverables in `loop-results/`. `loop.md` is yours alone, `task.md` and `handoff.md` are the agent's alone, and `inbox.md` is shared.

## The cycle boundary

Pi gives a tool no way to open a new session, so a boundary is a context compaction inside the running session:

1. The agent finishes a task, checkpoints to disk, and calls the `sleep` tool.
2. The extension shows the countdown screen and waits for the timer, or for **Wake now**.
3. It calls pi's `ctx.compact()` with custom instructions. They make the summary nearly empty: it says only where state lives on disk, so stale cycle details can't fight the files.
4. When the compaction completes, the extension sends the full text of `loop.md` as the next user message. That starts the next cycle on a near-empty context.

The session id stays the same, but the context window is fresh. That is what the loop needs.

If the compaction fails, the loop still wakes. A worse context is better than a dead loop.

## What the extension owns

- **`sleep` tool.** The agent calls it. Parameters are `summary` and an optional `durationSeconds` (default 600).
- **Countdown screen.** Progress bar, wake time, the last summary, and the menu: Wake now, ±1h, ±15m, Help, Stop.
- **Help screen.** Reads the loop files and shows the mission, task counts, inbox state and anything needing attention. With `CIRCADIAN_DEBUG=1` it adds the cycle number and per-cycle cost.
- **Wake.** Compact, then send `loop.md`. Guarded so one boundary can never start two cycles.
- **Guarantee layer.** If pi compacts mid-cycle on its own (context full), the extension sends a message pointing the agent back at `loop.md` and the `.pi/loop/` files.
- **Evaluation log.** `.pi/loop/cycles.jsonl`, written only when pi is launched with `CIRCADIAN_DEBUG=1`.

## What it does not do

- It does not edit `loop.md`, `task.md` or `inbox.md`. Those belong to you and the agent.
- It does not run when pi isn't running. If you quit pi, run `/skill:circadian-loop` to resume.
- It does not make the agent call `sleep`. That is an instruction in `loop.md`, so the model has to follow it.
