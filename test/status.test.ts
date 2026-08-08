import { strict as assert } from "node:assert";
import { after, describe, it } from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readLoopStatus } from "../.pi/extensions/circadian-loop/index.ts";

const roots: string[] = [];
after(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

// Build a throwaway project that looks like a real loop on disk.
function makeLoop(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "circadian-test-"));
  roots.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return root;
}

const LOOP_MD = `# Loop: jobs

## Mission
Track remote Python jobs that match my profile and keep a running shortlist.

## Sleep
- normal: 21600 seconds between cycles
`;

const TASK_MD = `# Tasks
- [ ] Verify the Canva careers page links are still live
- [ ] Refresh the shortlist
- [🟡] waiting Q1 · Confirm the salary floor
- [✅] Build the first shortlist
- [✅] Set up the profile
`;

const INBOX_MD = `# 💬 Inbox

## ✍️ Your message box

## ❓ Questions for you

### Q1 · 2026-08-05 · task: Confirm the salary floor
What is the lowest base salary worth flagging?
Your answer:

### Q2 · 2026-08-01 · task: Pick a region
Which regions count as remote for you?
Your answer: Anywhere in Australia or New Zealand.

## ✅ Done
`;

describe("readLoopStatus", () => {
  it("reads the mission, task counts and next task", () => {
    const root = makeLoop({
      "loop.md": LOOP_MD,
      ".pi/loop/task.md": TASK_MD,
      ".pi/loop/inbox.md": INBOX_MD,
      ".pi/loop/handoff.md": "Cycle 18: merged two tables into one.",
    });
    const s = readLoopStatus(root);
    assert.equal(s.mission, "Track remote Python jobs that match my profile and keep a running shortlist.");
    assert.equal(s.openTasks, 2);
    assert.equal(s.waitingTasks, 1);
    assert.equal(s.doneTasks, 2);
    assert.equal(s.nextTask, "Verify the Canva careers page links are still live");
    assert.equal(s.handoff, "Cycle 18: merged two tables into one.");
  });

  it("counts only questions that are still unanswered", () => {
    const root = makeLoop({
      "loop.md": LOOP_MD,
      ".pi/loop/task.md": TASK_MD,
      ".pi/loop/inbox.md": INBOX_MD,
    });
    const s = readLoopStatus(root);
    assert.equal(s.openQuestions, 1);
    assert.ok(s.warnings.some((w) => w.includes("waiting on you")));
  });

  it("counts unread messages in the message box only", () => {
    const inbox = INBOX_MD.replace(
      "## ✍️ Your message box\n",
      "## ✍️ Your message box\n- Please prioritise the Canva role\n- And skip contract work\n",
    );
    const root = makeLoop({ "loop.md": LOOP_MD, ".pi/loop/task.md": TASK_MD, ".pi/loop/inbox.md": inbox });
    assert.equal(readLoopStatus(root).unreadMessages, 2);
  });

  it("warns when the loop has no spec and no tasks", () => {
    const s = readLoopStatus(makeLoop({}));
    assert.ok(s.warnings.some((w) => w.includes("loop.md is missing")));
    assert.ok(s.warnings.some((w) => w.includes("task.md is missing")));
    assert.equal(s.openTasks, 0);
    assert.equal(s.nextTask, null);
  });

  it("warns when every task is done or waiting", () => {
    const root = makeLoop({
      "loop.md": LOOP_MD,
      ".pi/loop/task.md": "# Tasks\n- [✅] Everything\n",
      ".pi/loop/inbox.md": "# Inbox\n",
    });
    assert.ok(readLoopStatus(root).warnings.some((w) => w.includes("No open tasks left")));
  });

  it("reads the cycle number and this cycle's own metrics from the log", () => {
    const log = [
      JSON.stringify({ event: "sleep", endedAt: "2026-08-07T01:00:00Z", cycle: { toolCalls: 5, tokens: 100, costUsd: 0.1, wallClockMs: 600_000 } }),
      JSON.stringify({ event: "wake", compaction: "ok" }),
      JSON.stringify({ event: "sleep", endedAt: "2026-08-07T02:00:00Z", cycle: { toolCalls: 27, tokens: 48_213, costUsd: 0.62, wallClockMs: 840_000 } }),
    ].join("\n");
    const root = makeLoop({
      "loop.md": LOOP_MD,
      ".pi/loop/task.md": TASK_MD,
      ".pi/loop/inbox.md": "# Inbox\n",
      ".pi/loop/cycles.jsonl": log + "\n",
    });
    const s = readLoopStatus(root);
    assert.equal(s.cycle, 2);
    assert.equal(s.lastCycle.toolCalls, 27);
    assert.equal(s.lastCycle.tokens, 48_213);
    assert.equal(s.lastCycle.minutes, 14);
  });

  it("survives a torn log line rather than losing the whole log", () => {
    const root = makeLoop({
      "loop.md": LOOP_MD,
      ".pi/loop/cycles.jsonl": '{"event":"sleep","cycle":{"toolCalls":3}}\n{"event":"sle\n',
    });
    assert.equal(readLoopStatus(root).cycle, 1);
  });

  it("warns when the last compaction or the last wake failed", () => {
    const root = makeLoop({
      "loop.md": LOOP_MD,
      ".pi/loop/cycles.jsonl":
        '{"event":"sleep"}\n{"event":"wake","compaction":"failed"}\n{"event":"wake_failed","error":"boom"}\n',
    });
    const w = readLoopStatus(root).warnings;
    assert.ok(w.some((x) => x.includes("last compaction failed")));
    assert.ok(w.some((x) => x.includes("last wake failed")));
  });
});
