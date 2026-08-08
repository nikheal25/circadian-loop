import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  buildHelpCard,
  buildSleepCard,
  cycleDelta,
  type LoopStatus,
} from "../.pi/extensions/circadian-loop/index.ts";

// A theme stub with the same surface as pi's real Theme. Colors are marked
// with sentinel escapes so the tests can assert on width without them.
const theme = {
  fg: (key: string, s: string) => `\x1b[38;5;1m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  bg: (_key: string, s: string) => `\x1b[48;5;1m${s}\x1b[0m`,
};

const strip = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

const status = (over: Partial<LoopStatus> = {}): LoopStatus => ({
  cycle: 18,
  mission: "Track remote Python jobs and keep a running shortlist.",
  handoff: "Cycle 18: merged two tables into one. 9 firms in one list.",
  openTasks: 4,
  waitingTasks: 1,
  doneTasks: 12,
  nextTask: "Verify the Canva careers page links are still live",
  openQuestions: 1,
  unreadMessages: 0,
  lastCycle: { tokens: 48213, costUsd: 0.62, toolCalls: 27, minutes: 14 },
  warnings: [],
  ...over,
});

const sleepArgs = (over: Record<string, unknown> = {}) => ({
  summary: "Reviewed 3 new job listings and parked a question in the inbox.",
  remaining: 5 * 3600_000,
  durationMs: 6 * 3600_000,
  spin: "⠹",
  selected: 0,
  ...over,
});

describe("buildSleepCard", () => {
  it("renders every line at exactly the requested width", () => {
    for (const width of [46, 52, 68, 72, 100]) {
      for (const line of buildSleepCard(theme, sleepArgs(), width)) {
        assert.equal(strip(line).length, width, `width ${width}: ${JSON.stringify(strip(line))}`);
      }
    }
  });

  it("fits inside a short terminal", () => {
    const lines = buildSleepCard(theme, sleepArgs(), 68);
    assert.ok(lines.length <= 22, `card is ${lines.length} rows`);
  });

  it("keeps every menu item", () => {
    const text = buildSleepCard(theme, sleepArgs(), 68).map(strip).join("\n");
    for (const label of ["Wake now", "+1h", "−1h", "+15m", "−15m", "Help", "Stop the loop"]) {
      assert.match(text, new RegExp(label.replace(/[+]/g, "\\+")));
    }
  });

  it("marks the selected row and only that row", () => {
    const marked = buildSleepCard(theme, sleepArgs({ selected: 2 }), 68)
      .map(strip)
      .filter((l) => l.includes("▸"));
    assert.equal(marked.length, 1);
    assert.match(marked[0]!, /−1h/);
  });

  it("truncates an overlong summary instead of growing", () => {
    const long = "word ".repeat(400);
    const lines = buildSleepCard(theme, sleepArgs({ summary: long }), 68);
    assert.ok(lines.length <= 22);
    assert.ok(lines.map(strip).join("\n").includes("…"));
  });

  it("survives an empty summary", () => {
    const text = buildSleepCard(theme, sleepArgs({ summary: "   " }), 68).map(strip).join("\n");
    assert.match(text, /\(no summary\)/);
  });

  it("does not overflow on wide characters", () => {
    const wide = "日本語のテキストです ".repeat(20) + "🎉🎉🎉";
    for (const line of buildSleepCard(theme, sleepArgs({ summary: wide }), 68)) {
      // Wide chars occupy 2 cells, so the stripped length is <= the width.
      assert.ok(strip(line).length <= 68);
    }
  });

  it("clamps the progress bar at both ends", () => {
    const zero = buildSleepCard(theme, sleepArgs({ remaining: 6 * 3600_000 }), 68).map(strip).join("\n");
    assert.match(zero, /\b0%/);
    const full = buildSleepCard(theme, sleepArgs({ remaining: 0 }), 68).map(strip).join("\n");
    assert.match(full, /100%/);
  });
});

describe("buildHelpCard", () => {
  it("renders every line at exactly the requested width", () => {
    for (const width of [46, 68, 100]) {
      for (const line of buildHelpCard(theme, { remaining: 3600_000, status: status() }, width)) {
        assert.equal(strip(line).length, width);
      }
    }
  });

  it("shows the cycle number and the live counts", () => {
    const text = buildHelpCard(theme, { remaining: 3600_000, status: status() }, 68).map(strip).join("\n");
    assert.match(text, /Cycle 18/);
    assert.match(text, /4 open · 1 waiting · 12 done/);
    assert.match(text, /27 tool calls/);
    assert.match(text, /48k tokens/);
    assert.match(text, /\$0\.62/);
  });

  it("surfaces warnings and stays inside the height cap", () => {
    const warnings = Array.from({ length: 8 }, (_, i) => `Something is wrong, number ${i}.`);
    const lines = buildHelpCard(theme, { remaining: 3600_000, status: status({ warnings }) }, 68);
    assert.ok(lines.length <= 22, `help is ${lines.length} rows`);
    assert.match(lines.map(strip).join("\n"), /Needs your attention/);
  });

  it("handles a loop that has never run", () => {
    const text = buildHelpCard(
      theme,
      {
        remaining: 0,
        status: status({
          cycle: null,
          handoff: null,
          nextTask: null,
          lastCycle: { tokens: null, costUsd: null, toolCalls: null, minutes: null },
        }),
      },
      68,
    )
      .map(strip)
      .join("\n");
    assert.match(text, /No cycle has finished yet/);
  });
});

describe("cycleDelta", () => {
  const cumulative = {
    userMessages: 10,
    assistantTurns: 40,
    toolCalls: 100,
    toolErrors: 3,
    llmErrors: 1,
    usage: { input: 9000, output: 1000, reasoning: 500, costTotal: 4.5 },
    wallClockMs: 900_000,
  };

  it("subtracts the previous cumulative totals", () => {
    const previous = {
      userMessages: 8,
      assistantTurns: 30,
      toolCalls: 73,
      toolErrors: 3,
      llmErrors: 0,
      usage: { input: 7000, output: 800, reasoning: 400, costTotal: 3.88 },
    };
    const d = cycleDelta(cumulative, previous, "2026-08-07T03:00:00Z", "2026-08-07T02:46:00Z")!;
    assert.equal(d.toolCalls, 27);
    assert.equal(d.tokens, 2000 + 200 + 100);
    assert.equal(Number(d.costUsd.toFixed(2)), 0.62);
    assert.equal(d.wallClockMs, 14 * 60_000);
  });

  it("treats the first cycle's cumulative as its own delta", () => {
    const d = cycleDelta(cumulative, null, "2026-08-07T03:00:00Z", null)!;
    assert.equal(d.toolCalls, 100);
    assert.equal(d.tokens, 10_500);
    assert.equal(d.wallClockMs, 900_000);
  });

  it("never reports a negative cost when the session is replayed", () => {
    const d = cycleDelta(cumulative, { usage: { costTotal: 99 } }, null, null)!;
    assert.equal(d.costUsd, 0);
  });

  it("returns null when there are no stats at all", () => {
    assert.equal(cycleDelta(null, null, null, null), null);
  });
});
