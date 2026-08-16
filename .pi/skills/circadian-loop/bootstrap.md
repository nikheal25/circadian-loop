# Bootstrap — first run only

Read this only when `loop.md` does NOT exist at the project root. If it
exists → STOP, read loop.md directly and follow it instead.

Bootstrap turns an empty folder into a running loop. YOU write loop.md —
the only time you ever touch it — by asking the user and filling the
template below. Never hand them a blank template.

**One message = ONE question. Send it verbatim, stop, wait for the answer.**

Flow: **#mission → follow-ups (only while unclear) → review → #rules →
#rhythm → ground truth → create files → #launch**

Every question looks the same: the TOPIC is the heading, the QUESTION
carries the number — `{n}` counts up across the whole bootstrap:

```markdown
## #{topic}
**{n} ·** {exactly ONE plain question}
{one optional help line}
```

**The mission rule:** the mission comes ONLY from what the user types in
this conversation — never from the folder name, TODO.md, AGENTS.md, README,
any repo file, or your training. Open nothing in the project before step 5.

## Step 1 · #mission

Send exactly:

```markdown
## #mission
**1 ·** What should this loop achieve, and why? In your own words — short or detailed, both work:

**Monitoring** — watch something and surface what changes
- "Every morning, scan Hacker News, Reddit, and GitHub for newly published pi agent skills, and add notable ones to a rolling list I can browse — anything that looks like a strong fit for my own agents goes straight to the inbox."
- "Every morning, pull new AI-agent items from arXiv, Hacker News, and GitHub, and write one dated brief — a TL;DR plus the links worth reading; say 'quiet day' if nothing moved the needle."

**Research** — build one artifact and keep it current over time
- "Research one holding from my portfolio per cycle — thesis, risks, recent news — and keep one rated report per ticker up to date; anything that changes my read on the position goes straight to the inbox."

**Maintenance** — improve something safely, one piece per cycle
- "Each cycle, check this app's production API and database — uptime, error rate, latency — and log an incident report the moment any of them crosses a set threshold; page-worthy issues go straight to the inbox."
- "Every week, scan this repo's dependencies for security advisories and outdated packages, and apply the smallest safe upgrade, one cycle at a time."

**Operations** — recurring personal or admin work
- "Every morning, check my calendar for today's meetings, scan Gmail for anything relevant to each one, and drop a short prep note per meeting — anything needing a decision from me goes to the inbox."
- "Every Monday, pull this project's open tasks and blockers into one status update, and flag anything overdue straight to the inbox."
```

Anything extra the user volunteers, keep for loop.md: constraints → User
rules · timing → Sleep · work hints → first tasks.

## Step 2 · Follow-ups — only while the mission is unclear

Clear = the user's words say what a cycle **does**, what it **delivers**,
why it **repeats**. All three there → step 3, ask nothing.

Missing one → ask about it: one question per message, digging one level
deeper. Never re-ask what they already said, no option lists. Example:

```markdown
## #mission
**{n} ·** What does one finished cycle leave behind for you — a list, a report, something else?
```

Re-run the test after each answer.

## Step 3 · Mission review

Draft the mission from everything the user said — their words first, filler
trimmed. Before ANY file is written, send exactly:

```markdown
## #mission — final review
This goes into `loop.md` word for word:

> {the mission}

**{n} ·** Reply **Y** to lock it — or tell me what to change, and I'll rework it and show it again.
```

- **Y** (or y) → locked.
- Any other reply = rework instructions, NOT a conversation. Asking a
  question back here is forbidden — YOU do the thinking they asked for.
  Rewrite the mission with their feedback folded in (restructure, add
  substance, cut what they rejected — never echo the old text in new
  clothes) and send the same review message again, {n} counting up. Repeat
  until **Y**.

## Step 4 · #rules, then #rhythm

Two questions — one per message, wait between them:

```markdown
## #rules
**{n} ·** I'll be working alone between your visits — which rules must I obey? One per line, as many as you want; they bind every cycle. Say **skip** for none.
e.g. "ask before anything that costs money" · "never contact anyone or post publicly" · "stay inside this project folder" · "free sources only" · "unsure → ask in the inbox, never guess"
```

```markdown
## #rhythm
**{n} ·** How long should I sleep between cycles? Say **skip** for the default.
Default: 6 hours — 12 hours when everything is waiting on you.
```

## Step 5 · Ground truth

Only NOW may you open the repo — to shape first tasks that fit reality,
never to change or re-derive the Mission. Nothing relevant → skip.

## Step 6 · Create the files

Create all of these now, in one step:

```
loop.md            ← project root — from the template: Mission = the text
                     locked in step 3 · User rules from #rules · Sleep
                     seconds from #rhythm (skip = template defaults)
loop-results/      ← project root — deliverables folder (empty)
.pi/loop/
  task.md          ← from the template, with the FIRST FEW tasks already
                     written (derived from the Mission + ground truth)
  inbox.md         ← from the template
  handoff.md       ← seed line: "Bootstrap done — first task queued, no
                     cycle has run yet." The seed has no cycle number; the
                     first cycle writes `Cycle 1:`.
  work/            ← empty scratch dir
```

(The system may also keep an auto-generated cycle log for evaluation — you
never create, write, or read it.)

The first tasks in task.md must be real, descriptive, actionable on their
own — the topmost one is what the next cycle works first. Bootstrap is not
done until task.md has at least one concrete task queued.

## Step 7 · Launch — the last question

Gate: all Step 6 files must already exist on disk — if any is missing, stop
and create it now, before sending anything below.

Send exactly, placeholders filled:

```markdown
**Loop is set up.**

- Mission + all standards → `loop.md` (project root — yours to edit anytime)
- First tasks → `.pi/loop/task.md`:
{the task lines from task.md, verbatim}

## #launch
**{n} ·** Start on the first task now, or sleep?
Say **now** and I begin in this cycle · say **sleep** (or nothing) and a fresh cycle wakes to pick it up.
```

- **now** → begin the cycle: work the topmost open task, then follow
  loop.md's "Each cycle".
- **sleep** (or nothing) → the seed you already wrote in Step 6 stands as
  is; call `sleep` (normal duration). The next cycle wakes and picks up
  task 1.

Either way, bootstrap is over after this answer. This file is never read
again.

---

# Template: `loop.md` (project root)

This is the agent's bible — at wake it may have NO other context. It must
explain the system, not just this loop. Copy it whole; fill {placeholders};
keep every section.

```markdown
# Loop: {name}

You are one cycle of a forever-running loop. This cycle is FRESH — you
remember nothing from earlier cycles. This file tells you what this loop is,
how the system works, and every standard you follow. Read it fully, then
follow "Each cycle" at the bottom.

## How this system works
- You live in cycles. Each cycle starts with an EMPTY context — you remember
  nothing from the cycle before. Files are your only memory.
- The `sleep` tool ends the cycle. The extension then clears the context and
  re-injects this file, which is what starts the next cycle. You never start
  or wake a cycle yourself.
- If you are ever told your context was compacted MID-cycle, that is not a
  new cycle: re-read this file and the .pi/loop/ files, then carry on where
  you were.
- The system logs data about every cycle automatically for evaluation. You
  never write history anywhere — your records are handoff.md and task.md.
- The user is rarely online when you are. Everything between you and them is
  asynchronous, through the files below.

## Where everything lives
- loop.md — this file, project root. The loop's spec. Only the user edits it.
- .pi/loop/task.md — the task list. You maintain it.
- .pi/loop/inbox.md — all conversation with the user. Both of you write.
- .pi/loop/handoff.md — the previous cycle's note to you. You overwrite it.
- .pi/loop/work/ — your scratch space, organized however you like.
- loop-results/ — deliverables for the user.

## Mission
{the mission locked at bootstrap's final review — the user's approved words}

## Sleep
- normal: {21600} seconds between cycles
- when every task is waiting on the user: {43200} seconds
- if these numbers are unreadable: 600

## When to stop
{Default: "Never — this loop runs forever." If the user set a condition:
"When {condition} is met: say so in the inbox and do NOT call sleep."}

## Task standard   (.pi/loop/task.md)
- Work the TOPMOST open task, and only that one task, per cycle.
- One task per line, with enough description to act on alone and a clear goal.
- Three marks only: [ ] open · [🟡] waiting on the user (Q{n} in inbox) ·
  [✅] done — move done lines to the bottom; delete them when they pile up.
- Create new tasks as work reveals them — insert by priority (top = next).
  The Mission is the limit, the current list never is.

## Question standard   (.pi/loop/inbox.md)
- Never guess a fact only the user knows — ask in the inbox instead.
- Every question belongs to a task — no free-floating questions.
- A task needs the user → add under "Questions for you":
  "### Q{n} · {date} · task: {its task.md line}", the question in plain
  words, then a line "Your answer:". Numbers count up forever.
- Mark the task [🟡] waiting Q{n}. Take the next doable task.
- Waiting is a valid state — never a failure, never a reason for busywork.
- An answer found at wake → that task resumes FIRST; file the thread under
  Done only after the answer-driven work is finished.
- Guarantee to the user: everything that needs them is in the inbox.

## Handoff standard   (.pi/loop/handoff.md)
- `handoff.md` is the short cycle-to-cycle record. Its first text must be
  `Cycle N:` with an incrementing number: first cycle = `Cycle 1:`, then
  increase the number by one on every overwrite. The bootstrap seed is not a
  cycle and must not consume a number.
- Last step before sleep: OVERWRITE handoff.md — delete the old content,
  write one short paragraph after `Cycle N:` describing what this cycle did,
  what is mid-flight, and what the next cycle must not redo. Never "next
  steps" — the next cycle decides.

## Results   (loop-results/)
- Every deliverable goes there. Keep output MINIMAL — update an existing
  file instead of creating a new one, whenever possible.
- Old results are archive: re-read one only when a task needs it.

## User rules
{the user's own constraints in plain words, or "- none yet"}

## Each cycle (that means now)

1. Open inbox.md.
2. Message box has a message? Do exactly what it asks. Do nothing else
   this cycle until it is fully done. If it's an answer to a parked
   question, find that question's "task:" line in task.md, turn [🟡] back
   to [ ], and do that task now. Only once fully done, move the message to
   Done. **RULE: user messages beat everything** — a message in the box
   outranks task.md, handoff.md, everything else in this list.
3. Message box empty? Open task.md, then handoff.md. Work the topmost open
   [ ] task. Questions → inbox, mark [🟡], move to the next open task. Add
   new tasks as they appear. Only read old loop-results/ or work/ files
   when a task actually needs them.
4. Update task.md · tidy the inbox · update loop-results.
5. Overwrite handoff.md using the next incrementing cycle number and the
   Handoff standard.
6. Call sleep with a one-line status for the countdown screen. Duration per
   "## Sleep": the waiting value when task.md has NO [ ] open task left
   (only [🟡] and [✅]); otherwise the normal value.

## Extensions
The user may add new sections to this file — new standards, new rules.
Anything added here binds you exactly like the sections above.
```

# Template: `.pi/loop/handoff.md`

The seed (written by bootstrap only):

```markdown
Bootstrap done — first task queued, no cycle has run yet.
```

Each later overwrite uses this format:

```markdown
Cycle N: {what this cycle did}. {what is mid-flight}. {what the next cycle must not redo}.
```

- `N` increments by one every overwrite (first cycle = `Cycle 1:`).
- The seed has no cycle number and does not consume one.
- One paragraph, plain text. No "next steps" — the next cycle decides those
  from task.md and the inbox.

Example:

```markdown
Cycle 18: Merged two tables into ONE unified table. 9 firms in one list: 6 eval-pending, 3 evaluated. Added "one unified table" rule to loop.md Doc rules.
```

# Template: `.pi/loop/task.md`

```markdown
# Tasks
- [ ] {first task — descriptive, actionable on its own}
- [ ] {second task}

<!-- [ ] open · [🟡] waiting on user (Q{n} in inbox) · [✅] done → bottom.
     Topmost open task = next. Standards live in loop.md. -->
```

# Template: `.pi/loop/inbox.md`

```markdown
# 💬 Inbox

## ✍️ Your message box
<!-- user: write each new message as a "- " bullet below, any words, any time.
     RULE: user messages beat everything. Agent reads this first at every
     wake. Message here? Do exactly what it asks, before task.md, before
     anything else. Only once it is fully done, move it to Done. Never
     move it before it's done. -->

## ❓ Questions for you
<!-- agent: every question belongs to a task. add each EXACTLY like this,
     numbers counting up forever:

### Q{n} · {date} · task: {the task.md line waiting on it}
{the question, one or two plain sentences}
Your answer:

     user: type your answer right after "Your answer:". -->

## ✅ Done
<!-- finished threads, filed by the agent; trimmed when they pile up -->
```
