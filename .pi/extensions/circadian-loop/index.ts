import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Key, matchesKey, sliceByColumn, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";

// ─── Layout ───
// loop.md lives at the project root (the user-facing spec); the machinery
// files (task.md, inbox.md, handoff.md, work/) live in .pi/loop/.
const LOOP_MD = "loop.md";
const LOOP_DIR = ".pi/loop";
const TASK_MD = `${LOOP_DIR}/task.md`;
const INBOX_MD = `${LOOP_DIR}/inbox.md`;
const HANDOFF_MD = `${LOOP_DIR}/handoff.md`;

// Auto-generated cycle log (JSON Lines). The EXTENSION writes one line per
// sleep and one per wake; the agent never writes or reads it. Values come
// from pi's native APIs (ctx.model, ctx.getContextUsage(), ctx.sessionManager)
// plus the sleep summary and timestamps.
const CYCLE_LOG = `${LOOP_DIR}/cycles.jsonl`;

const TITLE = "Circadian Loop";
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const BOX_W = 68;
const PAD = 2; // horizontal breathing room inside the border
const MAX_SUMMARY_LINES = 3;
const MAX_HELP_LINES = 22;
const HANDOFF_LINES = 2; // of the last cycle's note, on the help screen
const DEFAULT_SLEEP_S = 600;
const TICK_MS = 1000; // the countdown only needs second precision
const MIN_SLEEP_MS = 10_000; // floor when the user shortens the timer
const BOUNDARY_SETTLE_MS = 1000; // grace before a boundary stops counting as ours
const LOG_TAIL_BYTES = 262_144; // how much of the cycle log we scan for the last sleep

// How a sleep ended. "aborted" is distinct from "stopped": the user
// interrupting the run must neither shut pi down nor start a new cycle.
type SleepOutcome = "woke" | "stopped" | "aborted";

// Set while a sleep overlay is on screen. pi hides overlays on session
// invalidation without calling dispose(), so this is the only handle that can
// settle the tool call in that case.
let closeActiveOverlay: (() => void) | null = null;

// Menu actions offered on the sleep overlay. Order = display order.
type MenuAction = "wake" | "add1h" | "sub1h" | "add15m" | "sub15m" | "help" | "stop";
const MENU: { action: MenuAction; label: string }[] = [
  { action: "wake", label: "Wake now" },
  { action: "add1h", label: "+1h" },
  { action: "sub1h", label: "−1h" },
  { action: "add15m", label: "+15m" },
  { action: "sub15m", label: "−15m" },
  { action: "help", label: "Help" },
  { action: "stop", label: "Stop the loop" },
];

// Theme color keys (pi theme names, not raw ANSI). One palette, used the same
// way everywhere, so nothing shifts color between screens:
// - accent: the one emphasis color — title, spinner, wake time, bar fill.
// - body: ordinary text — summary, help content, unselected rows.
// - dim: quiet supporting text — labels, hints, the % readout.
// - border: the frame and dividers.
const C = {
  border: "border",
  accent: "accent",
  body: "text",
  dim: "dim",
  barEmpty: "borderMuted",
  warn: "warning",
} as const;

// ─── Wake mechanism: compact ───
// Stock pi gives tool code no way to open a new session (ctx.newSession() is
// command-dispatch-only), so the cycle boundary is ctx.compact() — a plain pi
// API available right on the tool context. It replaces the whole conversation
// with one short summary, and then (via onComplete) we send loop.md as the
// next user message, which starts the next cycle on that near-empty context.
// Same sessionId, but the context window is fresh — which is what the loop
// actually needs.
//
// The custom instructions below are what makes the compact usable: without
// them pi writes a detailed work summary, and the next cycle would wake with a
// head full of stale cycle details that fight with the files. All durable
// state already lives on disk, so the correct summary is close to empty — it
// must say where state lives, and nothing else.
const COMPACT_INSTRUCTIONS =
  "This is a sleep/wake boundary of a forever-loop, not a normal " +
  "compaction. ALL durable state is already checkpointed on disk: loop.md " +
  "(the loop spec, project root), .pi/loop/task.md (tasks), " +
  ".pi/loop/inbox.md (user dialogue), .pi/loop/handoff.md (the last " +
  "cycle's note), loop-results/ (deliverables). The next cycle must rely " +
  "ONLY on those files. Therefore summarize to a few lines at most: state " +
  "that a cycle just ended and was checkpointed to those files, and carry " +
  "over NOTHING else — no task details, no tool outputs, no drafts, no " +
  "reasoning, no source lists. If the previous context contains anything " +
  "not yet saved to disk that would be truly lost, note only that one " +
  "thing. Keep the summary under 100 words.";

// Sent after an UNPLANNED compaction (threshold/overflow). pi summarizes with
// its own instructions, which know nothing about this loop, so the summary can
// drop the pointer to the loop files. Compaction keeps recent messages
// (keepRecentTokens, 20k by default) so the agent is not amnesiac — this only
// needs to point it back at the files.
const REORIENT_MESSAGE =
  "Your context was just compacted. Before continuing, re-read loop.md at the " +
  "project root and .pi/loop/task.md, .pi/loop/inbox.md and " +
  ".pi/loop/handoff.md, and work from those files rather than from memory.";

export default function (pi: ExtensionAPI) {
  // True only while OUR compaction (the sleep boundary) is in flight, so the
  // session_compact handler can tell a planned boundary from an unplanned one.
  // It is cleared a beat AFTER the wake message goes out, never before:
  // session_compact can be dispatched around the compaction callbacks, and
  // clearing early would make the boundary look unplanned and stack a
  // reorientation message on top of loop.md.
  let boundaryInFlight = false;
  const beginBoundary = () => {
    boundaryInFlight = true;
  };
  const endBoundary = () => {
    setTimeout(() => {
      boundaryInFlight = false;
    }, BOUNDARY_SETTLE_MS);
  };

  // ---------------------------------------------------------------
  // Log every human-typed message. source "interactive" = the user typed it
  // themselves (a genuine intervention mid-cycle); "extension" is our own wake
  // message (loop.md) and "rpc" is API-driven, neither of which is a human
  // acting. This is the data for measuring human interventions and for
  // auditing exactly what the user said and when.
  // ---------------------------------------------------------------
  // appendCycleLog is reachable from the input and compaction handlers long
  // before the first sleep. Until the root is known it would resolve against
  // process.cwd() and create a stray .pi/loop/ in an unrelated directory.
  pi.on("session_start", async (_event: any, ctx: any) => {
    logRoot = projectRoot(ctx);
  });

  // /new, /resume and /fork tear the session down and hide any overlay
  // WITHOUT calling its dispose(). Without this the sleep tool call would
  // never return and the loop would die with a live timer attached.
  pi.on("session_shutdown", async (_event: any, _ctx: any) => {
    closeActiveOverlay?.();
  });

  pi.on("input", async (event: any, _ctx: any) => {
    if (event.source === "interactive") {
      appendCycleLog({ event: "user_message", at: nowIso(), text: event.text });
    }
    return { action: "continue" };
  });

  // ---------------------------------------------------------------
  // Guarantee layer: an unplanned compaction (context filled up mid-cycle)
  // is summarized by pi's own instructions, which know nothing about this
  // loop. Without this the agent can wake from that compaction with no idea
  // that loop.md exists. Delivered as a follow-up so it never interrupts an
  // in-flight turn or an overflow retry.
  // ---------------------------------------------------------------
  pi.on("session_compact", async (event: any, ctx: any) => {
    if (boundaryInFlight) return;
    // willRetry means pi is about to re-run the aborted turn itself. Injecting
    // a message on top of that duplicates the turn, so only log it.
    const willRetry = event?.willRetry === true;
    appendCycleLog({
      event: "unplanned_compaction",
      at: nowIso(),
      reason: event?.reason ?? null,
      willRetry: event?.willRetry ?? null,
      reoriented: !willRetry,
    });
    if (willRetry) return;
    // pi also compacts from INSIDE prompt(), before the run is marked active.
    // Sending synchronously there would start a second, concurrent agent run.
    // Deferring a tick lets the outer run register, so followUp queues behind
    // it instead of racing it.
    setTimeout(() => sendUserMessage(pi, ctx, REORIENT_MESSAGE), 0);
  });

  // ---------------------------------------------------------------
  // sleep tool
  // ---------------------------------------------------------------
  pi.registerTool({
    name: "sleep",
    label: "Sleep",
    description:
      "Sleep for a set duration. Shows a countdown screen with selectable " +
      "actions (wake now, change the timer, show loop status, or stop the " +
      "loop). When the timer expires — or the user picks Wake now — the " +
      "cycle ends and a fresh one wakes and continues from loop.md at the " +
      "project root.",
    // promptGuidelines: pi appends these bullets to the LLM's system-prompt
    // "Guidelines" section while this tool is active. This is how the agent
    // learns WHEN to call sleep — our code never reads it; pi consumes it.
    // Bullets are appended flat with no tool-name prefix, so each one must
    // name the tool ("Call sleep when…", not "Use this tool when…").
    promptGuidelines: [
      "Call sleep when you reach a stopping point. Before calling, checkpoint per loop.md: update .pi/loop/task.md, put every open question in .pi/loop/inbox.md, and OVERWRITE .pi/loop/handoff.md with one paragraph (what this cycle did, what is mid-flight, what not to redo). Never write cycle logs — sleep records the cycle automatically from your summary.",
      "Sleep is how you wait for the user; the inbox is how their answer comes back. Never leave a question buried anywhere but the inbox.",
    ],
    parameters: Type.Object({
      // summary is display-only (countdown overlay). The durable record is
      // handoff.md, which the agent writes before calling sleep.
      summary: Type.String({
        description:
          "A short status line shown on the sleep countdown screen. " +
          "Display-only — the durable record is the paragraph you already " +
          "wrote in .pi/loop/handoff.md before calling sleep.",
      }),
      durationSeconds: Type.Optional(
        Type.Number({
          description:
            "Sleep duration in seconds. Use the value from loop.md '## Sleep' " +
            "(normal, or waiting when every task waits on the user). Omitted → 600.",
        }),
      ),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      const durationS =
        typeof params.durationSeconds === "number" && params.durationSeconds > 0
          ? params.durationSeconds
          : DEFAULT_SLEEP_S;
      const root = projectRoot(ctx);

      // One line at sleep time, using pi's native APIs for every value pi
      // exposes (model, context tokens, session file/id, session start) plus
      // our own summary and timestamp. The agent never touches this file.
      writeCycleLog(ctx, root, params.summary, durationS);

      const startedAt = Date.now();

      // Headless (print/rpc/json): there is no overlay to show, but the sleep
      // must still be a sleep — otherwise the loop spins at full speed and
      // burns the budget. Wait out the timer, honouring cancellation.
      if (ctx.mode !== "tui") {
        await waitAborting(durationS * 1000, signal);
        if (signal?.aborted) {
          appendCycleLog({ event: "aborted", at: nowIso(), sleptMs: Date.now() - startedAt });
          return { content: [{ type: "text", text: "Sleep interrupted — no new cycle started." }], details: {} };
        }
        wakeByCompact(pi, ctx, root, Date.now() - startedAt, beginBoundary, endBoundary);
        return {
          content: [{ type: "text", text: `Slept ${durationS}s — compacting into a fresh cycle.` }],
          details: {},
        };
      }

      const { outcome } = await showSleepOverlay(ctx, root, params.summary, durationS * 1000, signal);
      const sleptMs = Date.now() - startedAt;

      if (outcome === "aborted") {
        // The user interrupted, or the session was torn down. Do not compact
        // and do not start a cycle — whatever they do next is theirs.
        appendCycleLog({ event: "aborted", at: nowIso(), sleptMs });
        return { content: [{ type: "text", text: "Sleep interrupted — no new cycle started." }], details: {} };
      }

      if (outcome === "stopped") {
        // "Stop the loop": end the process via pi's own ctx.shutdown() API.
        // The loop halts until the user runs `pi` again.
        appendCycleLog({ event: "stopped", at: nowIso(), sleptMs });
        ctx.shutdown();
        return { content: [{ type: "text", text: "Stopped." }], details: {}, terminate: true };
      }

      wakeByCompact(pi, ctx, root, sleptMs, beginBoundary, endBoundary);
      return { content: [{ type: "text", text: "Waking — compacting into a fresh cycle..." }], details: {} };
    },
  });
}

// Compact, then wake: when compaction finishes, inject loop.md as the next
// user message — that message starts the next cycle. onError still wakes (a
// failed compaction must never kill the loop; worse context beats no loop).
// Fire-and-forget by design: ctx.compact() aborts the current turn internally,
// so awaiting it from inside the very tool call that belongs to that turn
// would deadlock.
//
// Each wake appends its own "wake" line to the cycle log (the sleep tool
// already appended a "sleep" line), so every boundary records: whether the
// compaction succeeded, tokens before → after, how much was cut, how long the
// cycle actually slept, and the exact summary text the next cycle carries.
function wakeByCompact(
  pi: ExtensionAPI,
  ctx: any,
  root: string,
  sleptMs: number,
  onStart: () => void,
  onSettled: () => void,
): void {
  // pi invokes onComplete INSIDE its own try/catch: if onComplete throws, pi
  // then also runs onError. Without this guard that would start two cycles
  // from one boundary — two loop.md messages, two agents' worth of work.
  let woken = false;
  const wake = () => {
    if (woken) return;
    woken = true;
    const loop = read(root, LOOP_MD);
    const message =
      loop !== null
        ? loop
        : "No loop is set up yet (loop.md is missing at the project root). " +
          "Set it up by following the circadian-loop skill (its bootstrap).";
    sendUserMessage(pi, ctx, message);
  };
  // Nothing inside a compaction callback may throw — see `woken` above.
  const settle = (record: Record<string, unknown>) => {
    try {
      appendCycleLog(record);
    } catch {
      // logging is never worth losing a cycle over
    }
    wake();
    onSettled();
  };
  const startedAt = Date.now();
  onStart();
  ctx.compact({
    customInstructions: COMPACT_INSTRUCTIONS,
    onComplete: (result: { summary: string; tokensBefore: number; estimatedTokensAfter?: number }) => {
      const before = result?.tokensBefore ?? null;
      const after = result?.estimatedTokensAfter ?? null;
      settle({
        event: "wake",
        at: nowIso(),
        compaction: "ok",
        compactionMs: Date.now() - startedAt,
        sleptMs,
        tokensBefore: before,
        tokensAfter: after,
        tokensCut: before !== null && after !== null ? before - after : null,
        cutPercent:
          before !== null && after !== null && before > 0
            ? Math.round(((before - after) / before) * 100)
            : null,
        carriedSummary: result?.summary ?? null,
        sessionId: safeSessionId(ctx),
      });
    },
    onError: (error: Error) => {
      // pi rejects with "Nothing to compact (session too small)" / "Already
      // compacted" when a cycle did too little to be worth summarizing. That
      // is a normal short cycle, not a fault, and must not raise the alarm
      // the help screen shows for a genuinely failed boundary.
      const detail = error?.message ?? String(error);
      const nothingToDo = /nothing to compact|already compacted/i.test(detail);
      settle({
        event: "wake",
        at: nowIso(),
        compaction: nothingToDo ? "skipped" : "failed",
        compactionMs: Date.now() - startedAt,
        sleptMs,
        error: detail,
        // Nothing was cut, so the next cycle carries the FULL previous
        // context. Log the current size so the growth stays visible.
        contextTokens: safeContextTokens(ctx),
        sessionId: safeSessionId(ctx),
      });
    },
  });
}

// Send the message that starts the next cycle.
//
// Two things about `pi.sendUserMessage` drive this code:
//
// 1. It returns `void`, not a Promise. Internally pi does
//    `this.sendUserMessage(...).catch(err => runner.emitError(...))`, so a
//    rejection never reaches us — there is nothing to `await` and nothing to
//    `.catch`. Any "retry on rejection" logic here would be dead code.
// 2. Without `deliverAs` it throws when the agent is mid-turn, and it calls
//    `prompt()` re-entrantly when the agent is idle-but-inside-`prompt()`
//    (which is exactly where an unplanned compaction fires).
//
// So: ALWAYS pass an explicit delivery mode. `streamingBehavior` is ignored
// when the agent is idle, which makes "followUp" free — it is correct whether
// or not a turn is in flight.
//
// The try/catch below only catches a SYNCHRONOUS throw (a stale context).
// Asynchronous failures — no API key, expired auth, provider down — reject
// inside pi and surface as pi's own error banner, not here. There is no
// extension API that observes them, so `wake_failed` records the cases we can
// see and the rest are visible to the user through pi itself.
function sendUserMessage(pi: ExtensionAPI, ctx: any, message: string): void {
  try {
    pi.sendUserMessage(message, { deliverAs: "followUp" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    appendCycleLog({ event: "wake_failed", at: nowIso(), error: detail });
    try {
      ctx?.ui?.notify?.(
        `Circadian Loop could not start the next cycle: ${detail}. ` +
          `The loop has stopped — send any message to restart it.`,
        "error",
      );
    } catch {
      // notify is best-effort; the log line above is the durable record
    }
  }
}

// ─── Sleep overlay ───

// Minimal theme surface used by the card. The real pi theme satisfies this;
// bg() is optional so the card still renders against a stubbed theme in tests.
type CardTheme = {
  fg(key: string, s: string): string;
  bold(s: string): string;
  bg?(key: string, s: string): string;
};

function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return m > 0 ? `${m}m ${String(sec).padStart(2, "0")}s` : `${sec}s`;
}

// 24h HH:MM — one unambiguous, glanceable format, no locale guessing.
function fmtClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Shared box-drawing primitives. Every overlay screen is built from the same
// frame, so there is exactly one border style and one palette in this whole
// component — no screen ever floats outside a box or styles itself differently
// from another. Rows carry PAD columns of padding on each side, which is what
// keeps the card from reading as a wall of text jammed against the border.
function makeFrame(t: CardTheme, width: number) {
  const boxW = Math.max(width, 8);
  const innerW = Math.max(1, boxW - 2 - PAD * 2); // text area inside the padding
  const fg = (key: string, s: string): string => t.fg(key, s);
  const side = fg(C.border, "│");
  const gap = " ".repeat(PAD);
  const dash = (n: number): string => "─".repeat(Math.max(0, n));

  const shell = (body: string, plainW: number, bg?: (s: string) => string): string => {
    const padded = gap + body + " ".repeat(Math.max(0, innerW - plainW)) + gap;
    return side + (bg ? bg(padded) : padded) + side;
  };

  // Segments are truncated in order so the combined row can never exceed
  // innerW — the same guarantee a single-string row gets.
  const rowSegs = (
    segs: { s: string; color: string; bold?: boolean }[],
    bg?: (s: string) => string,
  ): string => {
    let remaining = innerW;
    let plainW = 0;
    const parts: string[] = [];
    for (const seg of segs) {
      if (remaining <= 0) break;
      const text = visibleWidth(seg.s) <= remaining ? seg.s : sliceByColumn(seg.s, 0, remaining, true);
      parts.push(fg(seg.color, seg.bold ? t.bold(text) : text));
      const w = visibleWidth(text);
      plainW += w;
      remaining -= w;
    }
    return shell(parts.join(""), plainW, bg);
  };

  const row = (plain: string, color: string, bold = false): string =>
    rowSegs([{ s: plain, color, bold }]);

  // left text, right text, flushed to opposite edges of the inner area.
  const rowSplit = (
    left: { s: string; color: string; bold?: boolean },
    right: { s: string; color: string; bold?: boolean },
  ): string => {
    // Reserve one column for the gap so the two halves can never sum past
    // innerW — on a very narrow terminal the right half alone could fill it.
    const rightText = truncateToWidth(right.s, Math.max(0, innerW - 1), "…");
    const leftRoom = Math.max(0, innerW - visibleWidth(rightText) - 1);
    const leftText = truncateToWidth(left.s, leftRoom, "…");
    const spacer = Math.max(1, innerW - visibleWidth(leftText) - visibleWidth(rightText));
    const body =
      fg(left.color, left.bold ? t.bold(leftText) : leftText) +
      " ".repeat(spacer) +
      fg(right.color, right.bold ? t.bold(rightText) : rightText);
    return shell(body, visibleWidth(leftText) + spacer + visibleWidth(rightText));
  };

  return {
    innerW,
    top: fg(C.border, "╭" + dash(boxW - 2) + "╮"),
    bottom: fg(C.border, "╰" + dash(boxW - 2) + "╯"),
    blank: row("", C.body),
    divider: shell(fg(C.border, dash(innerW)), innerW),
    row,
    rowSegs,
    rowSplit,
    shell,
  };
}

// One header row shared by every screen: spinner (or a static dot once paused
// on the help screen) + title on the left, the wake clock on the right.
function headerRow(f: ReturnType<typeof makeFrame>, spin: string, wakeAtMs: number): string {
  return f.rowSplit(
    { s: `${spin}  ${TITLE}`, color: C.accent, bold: true },
    { s: `waking at ${fmtClock(wakeAtMs)}`, color: C.dim },
  );
}

// The selected menu row: a full-width highlight bar, using the theme's own
// selection background when it has one, so the selection reads at a glance
// instead of hiding behind a small arrow.
function menuRow(
  f: ReturnType<typeof makeFrame>,
  t: CardTheme,
  label: string,
  selected: boolean,
): string {
  if (!selected) return f.rowSegs([{ s: "  " + label, color: C.body }]);
  const bg = t.bg ? (s: string) => t.bg!("selectedBg", s) : undefined;
  return f.rowSegs([{ s: "▸ " + label, color: C.accent, bold: true }], bg);
}

// Slim progress bar. Half-height blocks read as a rule rather than a wall of
// filled cells, which is what let the old full-block bar dominate the card.
function progressRow(f: ReturnType<typeof makeFrame>, pct: number): string {
  const barW = f.innerW;
  const filled = Math.max(0, Math.min(barW, Math.round(barW * pct)));
  return f.rowSegs([
    { s: "━".repeat(filled), color: C.accent },
    { s: "━".repeat(barW - filled), color: C.barEmpty },
  ]);
}

// Pure, testable render of the sleep menu screen. Every returned line's
// visible width is guaranteed to equal `width` (wide chars counted as 2 cells).
export function buildSleepCard(
  t: CardTheme,
  args: { summary: string; remaining: number; durationMs: number; spin: string; selected: number },
  width: number,
): string[] {
  const f = makeFrame(t, width);
  const elapsed = Math.max(0, args.durationMs - args.remaining);
  const pct = args.durationMs > 0 ? Math.min(1, elapsed / args.durationMs) : 1;
  const wakeAtMs = Date.now() + args.remaining;

  const wrapped = wrapTextWithAnsi(sanitize(args.summary).trim() || "(no summary)", f.innerW);
  const shown = wrapped.slice(0, MAX_SUMMARY_LINES);
  if (wrapped.length > MAX_SUMMARY_LINES && shown.length > 0) {
    const last = shown.length - 1;
    shown[last] = truncateToWidth(shown[last] + " …", f.innerW, "…");
  }

  const lines = [
    f.top,
    f.blank,
    headerRow(f, args.spin, wakeAtMs),
    f.blank,
    progressRow(f, pct),
    f.rowSplit(
      { s: fmtDuration(args.remaining) + " left", color: C.body },
      { s: `${Math.round(pct * 100)}%`, color: C.dim },
    ),
    f.blank,
    ...shown.map((l) => f.row(l, C.body)),
    f.blank,
    ...MENU.map((m, i) => menuRow(f, t, m.label, i === args.selected)),
    f.blank,
    f.row("↑↓ select · enter apply", C.dim),
    f.bottom,
  ];

  return lines.map((l) => fitLine(l, width));
}

// ─── Help screen ───

// A plain-language answer to "what is this thing doing right now?", for
// someone who just walked up to the terminal. Everything here is derived from
// files the loop already maintains plus the cycle log the extension writes —
// nothing new is asked of the agent.
export type LoopStatus = {
  cycle: number | null;
  mission: string | null;
  handoff: string | null;
  openTasks: number;
  waitingTasks: number;
  doneTasks: number;
  nextTask: string | null;
  openQuestions: number;
  unreadMessages: number;
  lastCycle: { tokens: number | null; costUsd: number | null; toolCalls: number | null; minutes: number | null };
  warnings: string[];
};

export function readLoopStatus(root: string): LoopStatus {
  const loop = read(root, LOOP_MD);
  const task = read(root, TASK_MD);
  const inbox = read(root, INBOX_MD);
  const handoff = read(root, HANDOFF_MD);
  const warnings: string[] = [];

  if (loop === null) warnings.push("loop.md is missing — the next cycle has no spec to wake into.");
  if (task === null) warnings.push("task.md is missing — the loop has no task list.");
  if (inbox === null) warnings.push("inbox.md is missing — the user has no way to reach the agent.");

  const taskLines = (task ?? "").split("\n").map((l) => l.trim());
  const open = taskLines.filter((l) => /^-\s*\[\s\]/.test(l));
  const waiting = taskLines.filter((l) => l.includes("[🟡]"));
  const done = taskLines.filter((l) => l.includes("[✅]"));
  if (task !== null && open.length === 0 && waiting.length === 0) {
    warnings.push("No open tasks left — the loop will wake with nothing queued.");
  }

  // "### Q3 · …" entries whose "Your answer:" line is still empty. HTML
  // comments are stripped first: the shipped inbox template documents the
  // question format inside a comment, and without this every pristine loop
  // reports a phantom unanswered question forever.
  const questionBlocks = (inbox ?? "").replace(/<!--[\s\S]*?-->/g, "").split(/^###\s+/m).slice(1);
  const unanswered = questionBlocks.filter((block) => {
    // Only the remainder of the "Your answer:" LINE counts. With the /s flag
    // this swallowed every following line, so any question with a trailing
    // note read as answered.
    const answer = /^[^\S\n]*Your answer:(.*)$/m.exec(block);
    return !answer || answer[1]!.trim() === "";
  });
  if (unanswered.length > 0) {
    warnings.push(`${unanswered.length} question(s) waiting on you in the inbox.`);
  }

  // Bullets sitting in the message box the agent has not filed under Done yet.
  const messageBox = /##\s*[^\n]*message box([\s\S]*?)(?=\n##\s|$)/i.exec(inbox ?? "");
  const unread = (messageBox?.[1] ?? "")
    .split("\n")
    .filter((l) => /^\s*-\s+\S/.test(l) && !l.trim().startsWith("<!--")).length;

  const log = readCycleLog(root);
  const lastSleep = [...log].reverse().find((r) => r.event === "sleep");
  const cycleNo = log.filter((r) => r.event === "sleep").length || null;
  const failed = [...log].reverse().find((r) => r.event === "wake_failed");
  if (failed) warnings.push("The last wake failed to send — check .pi/loop/cycles.jsonl.");
  const lastWake = [...log].reverse().find((r) => r.event === "wake");
  if (lastWake?.compaction === "failed") {
    warnings.push("The last compaction failed — this cycle carries a full context.");
  }

  const cycleStats = (lastSleep?.cycle ?? null) as Record<string, any> | null;
  return {
    cycle: cycleNo,
    mission: section(loop, "Mission"),
    handoff: handoff ? sanitize(handoff).trim().split("\n").filter(Boolean).join(" ") : null,
    openTasks: open.length,
    waitingTasks: waiting.length,
    doneTasks: done.length,
    nextTask: open[0] ? sanitize(open[0].replace(/^-\s*\[\s\]\s*/, "")) : null,
    openQuestions: unanswered.length,
    unreadMessages: unread,
    lastCycle: {
      tokens: num(cycleStats?.tokens),
      costUsd: num(cycleStats?.costUsd),
      toolCalls: num(cycleStats?.toolCalls),
      minutes: cycleStats?.wallClockMs != null ? Math.round(cycleStats.wallClockMs / 60000) : null,
    },
    warnings,
  };
}

export function buildHelpCard(
  t: CardTheme,
  args: { remaining: number; status: LoopStatus },
  width: number,
): string[] {
  const f = makeFrame(t, width);
  const s = args.status;

  const field = (label: string, value: string): string =>
    f.rowSplit({ s: label, color: C.dim }, { s: value, color: C.body });

  const out = [
    f.top,
    f.blank,
    headerRow(f, "◦", Date.now() + args.remaining),
    f.blank,
    f.divider,
    f.blank,
    f.row(s.cycle !== null ? `Cycle ${s.cycle} just finished` : "No cycle has finished yet", C.accent, true),
    f.blank,
  ] as string[];

  if (s.handoff) {
    const wrapped = wrapTextWithAnsi(s.handoff, f.innerW);
    const shown = wrapped.slice(0, HANDOFF_LINES);
    if (wrapped.length > HANDOFF_LINES && shown.length > 0) {
      shown[shown.length - 1] = truncateToWidth(shown[shown.length - 1] + " …", f.innerW, "…");
    }
    for (const l of shown) out.push(f.row(l, C.body));
    out.push(f.blank);
  }

  const value = Math.floor(f.innerW * 0.72);
  if (s.mission) out.push(field("Working on", truncateToWidth(s.mission, value, "…")));
  out.push(field("Tasks", `${s.openTasks} open · ${s.waitingTasks} waiting · ${s.doneTasks} done`));
  if (s.nextTask) out.push(field("Next up", truncateToWidth(s.nextTask, value, "…")));
  out.push(field("Your inbox", `${s.unreadMessages} message(s) · ${s.openQuestions} question(s) open`));

  const lc = s.lastCycle;
  const stat = [
    lc.minutes !== null ? `${lc.minutes} min` : null,
    lc.toolCalls !== null ? `${lc.toolCalls} tool calls` : null,
    lc.tokens !== null ? `${fmtTokens(lc.tokens)} tokens` : null,
    lc.costUsd !== null ? `$${lc.costUsd.toFixed(2)}` : null,
  ].filter(Boolean);
  if (stat.length > 0) out.push(field("Last cycle", stat.join(" · ")));

  if (s.warnings.length > 0) {
    out.push(f.blank, f.row("Needs your attention", C.warn, true));
    for (const w of s.warnings.slice(0, 3)) {
      out.push(f.row(truncateToWidth("· " + w, f.innerW, "…"), C.body));
    }
  }

  out.push(f.blank, f.row("esc back", C.dim), f.bottom);
  // Never let the help screen outgrow the terminal.
  const capped = out.length > MAX_HELP_LINES ? [...out.slice(0, MAX_HELP_LINES - 2), f.row("esc back", C.dim), f.bottom] : out;
  return capped.map((l) => fitLine(l, width));
}

async function showSleepOverlay(
  ctx: any,
  root: string,
  summary: string,
  durationMs: number,
  signal: AbortSignal | undefined,
): Promise<{ outcome: SleepOutcome }> {
  return ctx.ui.custom(
    (tui: any, theme: any, _kb: any, done: (result: { outcome: SleepOutcome }) => void) => {
      const start = Date.now();
      let endAt = start + durationMs; // mutable: the +/- actions shift this
      let timer: ReturnType<typeof setInterval> | null = null;
      let finished = false;
      let tick = 0;
      let outcome: SleepOutcome = "woke";

      // menu / help state
      let mode: "menu" | "help" = "menu";
      let selected = 0;
      // Read from disk once, when the help screen opens — never inside
      // render(), which runs on every tick.
      let status: LoopStatus | null = null;

      const finish = (result: SleepOutcome) => {
        if (finished) return;
        finished = true;
        outcome = result;
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        signal?.removeEventListener("abort", onAbort);
        closeActiveOverlay = null;
        done({ outcome });
      };
      const wake = () => finish("woke");

      // The user aborted the run (ctrl-C, /stop). Nothing in pi hides an
      // overlay on abort, so without this the countdown stays on screen with a
      // live timer and later resolves into a compaction on top of whatever the
      // user has since started doing. Aborting is NOT "Stop the loop": it must
      // not shut pi down and must not start a new cycle.
      const onAbort = () => finish("aborted");

      if (signal?.aborted) {
        // Already aborted: settle immediately and never start the interval.
        finished = true;
        outcome = "aborted";
        done({ outcome });
      } else {
        signal?.addEventListener("abort", onAbort, { once: true });
        // pi hides the overlay without calling dispose() when the session is
        // invalidated (/new, /resume, /fork). Registering here is what stops
        // the tool call hanging forever in that case — see session_shutdown.
        closeActiveOverlay = () => finish("aborted");
        timer = setInterval(() => {
          tick++;
          if (Date.now() >= endAt) {
            wake();
            return;
          }
          tui.requestRender();
        }, TICK_MS);
      }

      const remainingMs = () => Math.max(0, endAt - Date.now());
      const totalMs = () => Math.max(MIN_SLEEP_MS, endAt - start);

      // Apply a menu action. Returns true if it ends the overlay (wake/stop).
      // Every action the human picks on the sleep screen is a data point, so
      // log it regardless of which one it is.
      const apply = (action: MenuAction): boolean => {
        appendCycleLog({
          event: "sleep_overlay_action",
          at: nowIso(),
          action,
          remainingMsBefore: remainingMs(),
        });
        switch (action) {
          case "wake":
            wake();
            return true;
          case "stop":
            finish("stopped");
            return true;
          case "add1h":
            endAt += 3_600_000;
            break;
          case "sub1h":
            endAt = Math.max(Date.now() + MIN_SLEEP_MS, endAt - 3_600_000);
            break;
          case "add15m":
            endAt += 900_000;
            break;
          case "sub15m":
            endAt = Math.max(Date.now() + MIN_SLEEP_MS, endAt - 900_000);
            break;
          case "help":
            status = readLoopStatus(root);
            mode = "help";
            break;
        }
        tui.requestRender();
        return false;
      };

      return {
        render: (width: number): string[] =>
          mode === "menu"
            ? buildSleepCard(
                theme,
                {
                  summary,
                  remaining: remainingMs(),
                  durationMs: totalMs(),
                  spin: SPINNER[tick % SPINNER.length]!,
                  selected,
                },
                width,
              )
            : buildHelpCard(theme, { remaining: remainingMs(), status: status ?? readLoopStatus(root) }, width),
        invalidate: () => {},
        // pi hides the overlay without resolving our promise on /reload, /new
        // and session invalidation. Without dispose() the tool call would hang
        // forever — the loop would silently die — and the interval would keep
        // firing against a detached component.
        dispose: () => finish("aborted"),
        handleInput: (data: string): void => {
          if (mode === "menu") {
            if (matchesKey(data, Key.up)) {
              selected = (selected - 1 + MENU.length) % MENU.length;
              tui.requestRender();
            } else if (matchesKey(data, Key.down)) {
              selected = (selected + 1) % MENU.length;
              tui.requestRender();
            } else if (matchesKey(data, Key.enter)) {
              apply(MENU[selected]!.action);
            }
          } else if (matchesKey(data, Key.escape)) {
            mode = "menu";
            tui.requestRender();
          }
          // A focused overlay receives ctrl-c itself; if we ignored it the
          // terminal would be locked for the whole countdown, which for a
          // multi-hour sleep is indistinguishable from a hang.
          if (matchesKey(data, Key.ctrl("c"))) {
            finish("aborted");
          }
        },
      };
    },
    {
      overlay: true,
      // Request exactly BOX_W columns (not a terminal percentage) so
      // render(width) is never handed more space than the box actually draws —
      // there is then no leftover gap for old terminal content to show
      // through. maxHeight keeps the card inside short terminals.
      overlayOptions: { width: BOX_W, minWidth: 46, maxHeight: "90%", anchor: "center", margin: 1 },
    },
  );
}

// ─── Small helpers ───

// Text from the model (the sleep summary) or from files the user edits can
// contain control characters and raw escape sequences. `\r` measures as one
// column but returns the cursor to column 0, and a stray CSI can clear the
// screen — either corrupts every row the overlay composited. Strip them
// before anything is measured or drawn.
function sanitize(text: string): string {
  return text
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .replace(/\r\n?/g, "\n");
}

function nowIso(): string {
  return new Date().toISOString();
}

// ctx accessors used inside compaction callbacks, where a throw would make pi
// run onError after onComplete and start the cycle twice.
function safeSessionId(ctx: any): string | null {
  try {
    return ctx?.sessionManager?.getSessionId?.() ?? null;
  } catch {
    return null;
  }
}

function safeContextTokens(ctx: any): number | null {
  try {
    return ctx?.getContextUsage?.()?.tokens ?? null;
  } catch {
    return null;
  }
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

// Pad or trim an already-styled line so its visible width is exactly `width`,
// preserving ANSI escape sequences. Exact width matters for overlays: a short
// line leaves a gap for whatever was on the terminal underneath.
function fitLine(line: string, width: number): string {
  const w = visibleWidth(line);
  if (w === width) return line;
  if (w < width) return line + " ".repeat(width - w);
  return sliceByColumn(line, 0, width, true) + "\x1b[0m";
}

// Wait `ms`, resolving early if the tool call is aborted.
function waitAborting(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(finish, ms);
    signal?.addEventListener("abort", finish, { once: true });
    function finish(): void {
      clearTimeout(timer);
      resolve();
    }
  });
}

// Pull one "## Heading" section's body out of a markdown document.
function section(doc: string | null, heading: string): string | null {
  if (!doc) return null;
  // NB: JavaScript has no \Z anchor — using one here silently truncated the
  // section at the first letter "z". End on the next heading or end-of-input.
  const re = new RegExp(`^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, "mi");
  const body = re.exec(doc)?.[1]?.trim();
  return body ? sanitize(body).split("\n").filter(Boolean).join(" ") : null;
}

// ─── Disk ───
// Every path is resolved against the session's cwd rather than the process
// cwd, so the loop files are found no matter where pi was launched from.

function projectRoot(ctx: any): string {
  return ctx?.sessionManager?.getCwd?.() ?? process.cwd();
}

function read(root: string, rel: string): string | null {
  try {
    return fs.readFileSync(path.resolve(root, rel), "utf8");
  } catch {
    return null;
  }
}

// Append one JSON line to the cycle log. Best-effort: a failed log write must
// never block sleep or wake.
let logRoot: string = process.cwd();

function appendCycleLog(record: Record<string, unknown>): void {
  try {
    const dir = path.resolve(logRoot, LOOP_DIR);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.resolve(logRoot, CYCLE_LOG), JSON.stringify(record) + "\n");
  } catch {
    // swallow — logging is never worth breaking the loop over
  }
}

// Read back the tail of the cycle log. Used by the help screen and to compute
// per-cycle deltas; malformed lines are skipped rather than thrown on.
function readCycleLog(root: string): Record<string, any>[] {
  try {
    const file = path.resolve(root, CYCLE_LOG);
    const size = fs.statSync(file).size;
    const from = Math.max(0, size - LOG_TAIL_BYTES);
    const fd = fs.openSync(file, "r");
    let read = 0;
    const buf = Buffer.alloc(size - from);
    try {
      read = fs.readSync(fd, buf, 0, buf.length, from);
    } finally {
      fs.closeSync(fd);
    }
    const raw = buf.toString("utf8", 0, read);
    // A tail read almost always starts mid-line; drop that fragment.
    const text = from > 0 ? raw.slice(raw.indexOf("\n") + 1) : raw;
    const out: Record<string, any>[] = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        // skip a torn line rather than lose the whole log
      }
    }
    return out;
  } catch {
    return [];
  }
}

// ─── Cycle log ───

// Walk the session's current branch and aggregate everything pi records about
// it — message/turn/tool activity, token usage, cost, cache traffic, errors,
// compactions, wall-clock time.
//
// NOTE: getBranch() walks from the ROOT of the branch, so these totals are
// CUMULATIVE across the whole session, not per-cycle. writeCycleLog therefore
// records them under `cumulative` and derives the per-cycle numbers by
// subtracting the previous sleep's `cumulative`. Reading `cumulative` as a
// cycle measurement is the mistake this split exists to prevent.
//
// Fully defensive: any surprise in the entry shape degrades to nulls, never
// throws.
function sessionStats(sm: any): Record<string, any> | null {
  try {
    const entries: any[] = sm?.getBranch?.() ?? [];
    const stats = {
      entries: entries.length,
      userMessages: 0,
      assistantTurns: 0,
      toolCalls: 0,
      toolCallsByName: {} as Record<string, number>,
      toolErrors: 0,
      llmErrors: 0,
      aborted: 0,
      compactions: 0,
      usage: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, costTotal: 0 },
      firstEntryAt: null as string | null,
      lastEntryAt: null as string | null,
      wallClockMs: null as number | null,
    };
    let firstTs: number | null = null;
    let lastTs: number | null = null;

    for (const entry of entries) {
      if (entry?.type === "compaction") stats.compactions++;
      const msg = entry?.message;
      if (!msg) continue;
      if (typeof msg.timestamp === "number") {
        if (firstTs === null || msg.timestamp < firstTs) firstTs = msg.timestamp;
        if (lastTs === null || msg.timestamp > lastTs) lastTs = msg.timestamp;
      }
      if (msg.role === "user") stats.userMessages++;
      if (msg.role === "toolResult" && msg.isError) stats.toolErrors++;
      if (msg.role === "assistant") {
        stats.assistantTurns++;
        if (msg.stopReason === "error") stats.llmErrors++;
        if (msg.stopReason === "aborted") stats.aborted++;
        for (const part of msg.content ?? []) {
          if (part?.type === "toolCall") {
            stats.toolCalls++;
            const name = part.name ?? "unknown";
            stats.toolCallsByName[name] = (stats.toolCallsByName[name] ?? 0) + 1;
          }
        }
        const u = msg.usage;
        if (u) {
          stats.usage.input += u.input ?? 0;
          stats.usage.output += u.output ?? 0;
          stats.usage.reasoning += u.reasoning ?? 0;
          stats.usage.cacheRead += u.cacheRead ?? 0;
          stats.usage.cacheWrite += u.cacheWrite ?? 0;
          stats.usage.costTotal += u.cost?.total ?? 0;
        }
      }
    }
    if (firstTs !== null) stats.firstEntryAt = new Date(firstTs).toISOString();
    if (lastTs !== null) stats.lastEntryAt = new Date(lastTs).toISOString();
    if (firstTs !== null && lastTs !== null) stats.wallClockMs = lastTs - firstTs;
    return stats;
  } catch {
    return null;
  }
}

// This cycle's own numbers: cumulative totals minus the previous sleep's
// cumulative totals. These are the numbers an evaluation should quote.
export function cycleDelta(
  cumulative: Record<string, any> | null,
  previous: Record<string, any> | null | undefined,
  sleepEndedAt: string | null,
  previousEndedAt: string | null | undefined,
  // How long the PREVIOUS cycle spent asleep. Boundary-to-boundary elapsed
  // time includes that sleep, so without subtracting it a 6-hour rhythm
  // reports every cycle as ~6 hours of work.
  previousSleptMs?: number | null,
): Record<string, any> | null {
  if (!cumulative) return null;
  const prev = previous ?? null;
  const sub = (a: number | undefined, b: number | undefined): number => (a ?? 0) - (b ?? 0);
  const u = cumulative.usage ?? {};
  const pu = prev?.usage ?? {};
  const elapsed =
    sleepEndedAt && previousEndedAt
      ? Date.parse(sleepEndedAt) - Date.parse(previousEndedAt)
      : (cumulative.wallClockMs ?? null);
  const slept = typeof previousSleptMs === "number" && previousSleptMs > 0 ? previousSleptMs : 0;
  const wall = elapsed !== null && Number.isFinite(elapsed) ? Math.max(0, elapsed - slept) : null;
  return {
    userMessages: sub(cumulative.userMessages, prev?.userMessages),
    assistantTurns: sub(cumulative.assistantTurns, prev?.assistantTurns),
    toolCalls: sub(cumulative.toolCalls, prev?.toolCalls),
    toolErrors: sub(cumulative.toolErrors, prev?.toolErrors),
    llmErrors: sub(cumulative.llmErrors, prev?.llmErrors),
    // `reasoning` is a SUBSET of `output` (pi-ai Usage docs) — adding it would
    // double-count thinking tokens. Reported separately instead.
    tokens: sub(u.input, pu.input) + sub(u.output, pu.output),
    reasoningTokens: sub(u.reasoning, pu.reasoning),
    costUsd: Math.max(0, sub(u.costTotal, pu.costTotal)),
    cacheReadTokens: sub(u.cacheRead, pu.cacheRead),
    cacheWriteTokens: sub(u.cacheWrite, pu.cacheWrite),
    // Time this cycle spent WORKING: boundary-to-boundary minus the sleep.
    wallClockMs: wall,
    // Boundary to boundary, sleep included. Kept so the two are never confused.
    elapsedMs: elapsed !== null && Number.isFinite(elapsed) ? elapsed : null,
  };
}

// The "sleep" line of the pair (the "wake" line is written by wakeByCompact
// when compaction settles). Values are read from pi's native ExtensionContext
// APIs (model, context tokens/window/percent, session header/file/id, full
// branch stats); summary and end timestamp come from this sleep call.
// contextTokens here is the context size the cycle ENDED with — compare it
// against the next "wake" line's tokensAfter to see what the boundary cut.
function writeCycleLog(ctx: any, root: string, summary: string, durationSeconds: number): void {
  logRoot = root;
  const sm = ctx?.sessionManager;
  const header = sm?.getHeader?.() ?? null;
  const usage = ctx?.getContextUsage?.() ?? undefined;
  const model = ctx?.model;
  const cumulative = sessionStats(sm);
  const log = readCycleLog(root);
  const previous = [...log].reverse().find((r) => r.event === "sleep");
  // Logs written before the cycle/cumulative split stored the same totals under
  // `stats`. Without this fallback the first cycle after an upgrade reports the
  // entire session's totals as one cycle.
  const previousTotals = previous?.cumulative ?? previous?.stats ?? null;
  // The wake that closed the previous cycle records how long it actually slept.
  const previousSleptMs = [...log].reverse().find((r) => r.event === "wake")?.sleptMs ?? null;
  const endedAt = nowIso();
  appendCycleLog({
    event: "sleep",
    endedAt,
    startedAt: header?.timestamp ?? null,
    summary,
    durationSeconds,
    model: model
      ? {
          provider: model.provider,
          id: model.id,
          name: model.name,
          contextWindow: model.contextWindow ?? null,
          maxTokens: model.maxTokens ?? null,
        }
      : null,
    contextTokens: usage?.tokens ?? null,
    contextWindow: usage?.contextWindow ?? null,
    contextPercent: usage?.percent ?? null,
    sessionName: sm?.getSessionName?.() ?? null,
    sessionFile: sm?.getSessionFile?.() ?? null,
    sessionId: sm?.getSessionId?.() ?? null,
    cwd: sm?.getCwd?.() ?? null,
    // This cycle alone. Quote these.
    cycle: cycleDelta(cumulative, previousTotals, endedAt, previous?.endedAt, previousSleptMs),
    // Session-to-date totals. Not a per-cycle measurement.
    cumulative,
    // The old name for the same object, kept so anything already reading
    // `stats` keeps working. Deprecated — read `cycle` or `cumulative`.
    stats: cumulative,
  });
}
