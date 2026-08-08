---
name: circadian-loop
description: Circadian Loop — a protocol that lets a pi agent work on a goal indefinitely through sleep/wake cycles, disk memory, and async human contact. Use when setting up a new loop or when loop.md is missing.
---

# Circadian Loop

## The essence — what this protocol is and why

A goal can be endless; a context window cannot — it fills and dies. The
answer is a **chain of fresh cycles**: work, write state to disk,
call `sleep` (the cycle ends), wake with an empty context, rebuild from
disk, continue. Forever.

Everything else follows from four hard truths:

1. **You remember nothing between cycles.** Disk is the only memory, so a
   tiny set of standard files must carry everything, and each must stay
   small. That is why setup matters: every file this skill creates is a
   lifeline the next cycle reads cold — if the files are wrong or missing,
   the loop breaks.
2. **The human is asynchronous.** They appear hours or days apart. So no
   task may ever block the loop: its question is parked in the inbox, the
   task WAITS (a valid state, never a failure), other work continues, and the
   answer — whenever it comes — resumes exactly that task. No busywork,
   ever.
3. **Ownership is split, and that is the standard.** loop.md is the USER's
   alone (bootstrap creates it once — after that they write the mission,
   sleep rhythm, their rules, and may extend it with new sections anytime);
   you obey it, you never edit it. task.md and handoff.md are YOURS alone.
   inbox.md is SHARED — the one channel for every word between you and the
   user. This split is not negotiable and not blurred: each file has exactly
   one writer (or, for the inbox, two), and every other file is read-only
   for the non-owner.
4. **A standard beats a clever one-off.** Every loop — trivial or huge —
   has the same files, same standards, same shapes. That is what makes loops
   buildable, shareable, and extendable by anyone.

Setup is the critical first step: it turns these truths into the concrete
files a fresh cycle wakes into. This skill performs setup once; later cycles
follow `loop.md`, not this skill.

## Routing (do this now)

- `loop.md` missing at the project root → no loop exists. The very first
  thing you do is read `bootstrap.md` (this folder) — **nothing else**. Do
  not `ls`, `cat`, or read any file in the project, not even to "check the
  state". The mission comes only from the user, so there is nothing useful
  to read before you ask. Open `bootstrap.md` and follow it.
- `loop.md` exists → bootstrapping is complete. Read it fully and do what it
  says — it is this loop's bible and defines every runtime standard. Do not
  use this skill as a substitute for `loop.md`.

## The shape (defined per-loop in loop.md — this is the fixed setup frame)

| Where | What | Who writes |
|-------|------|------------|
| loop.md (project root) | the loop's spec + all runtime standards | **user only** |
| .pi/loop/task.md | task list — topmost open task after inbox work | **agent only** |
| .pi/loop/inbox.md | every user↔agent message — user has highest precedence | **both** (shared) |
| .pi/loop/handoff.md | last cycle's paragraph — overwritten each cycle | **agent only** |
| .pi/loop/work/ | scratch | **agent only** |
| loop-results/ (project root) | deliverables — minimal, update over create | **agent only** |
| .pi/loop/cycles.jsonl | per-cycle eval data, auto-written at sleep | **system only** (never you) |

Bootstrap creates this shape and writes the runtime rules into `loop.md` and
the inbox template. After setup, the agent follows those generated files.

## Setup boundary

Bootstrap creates `loop.md`, `.pi/loop/task.md`, `.pi/loop/inbox.md`,
`.pi/loop/handoff.md`, `.pi/loop/work/`, and `loop-results/`. Do not begin
ordinary loop work until those files exist and the user has chosen whether to
start now or sleep.
