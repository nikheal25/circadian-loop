import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import * as path from "node:path";

const modulePath = path.resolve(process.cwd(), ".pi/extensions/circadian-loop/index.ts");

// A minimal stand-in for pi: records the sleep tool and event handlers, and
// logs the order of compact() and sendUserMessage() calls.
async function setup() {
  const mod = await import(`file://${modulePath}?wake`);
  const handlers: Record<string, (e: any, c: any) => Promise<void>> = {};
  let tool: any;
  const calls: string[] = [];
  const pi: any = {
    on: (name: string, fn: any) => (handlers[name] = fn),
    registerTool: (t: any) => (tool = t),
    sendUserMessage: () => calls.push("send"),
  };
  mod.default(pi);
  const ctx: any = {
    mode: "print",
    sessionManager: { getCwd: () => process.cwd() },
    compact: (o: any) => {
      calls.push("compact");
      o.onComplete({ summary: "s", tokensBefore: 10 });
    },
  };
  return { handlers, tool, calls, ctx };
}

describe("sleep wake", () => {
  it("returns terminate:true and does not compact inside the tool call", async () => {
    const { tool, calls, ctx } = await setup();
    const result = await tool.execute("id", { summary: "x", durationSeconds: 0.01 }, undefined, undefined, ctx);
    assert.equal(result.terminate, true);
    assert.deepEqual(calls, []);
  });

  it("compacts, then sends the wake message, once the run has settled", async () => {
    const { handlers, tool, calls, ctx } = await setup();
    await tool.execute("id", { summary: "x", durationSeconds: 0.01 }, undefined, undefined, ctx);
    await handlers.agent_settled!({}, ctx);
    assert.deepEqual(calls, ["compact", "send"]);
    await handlers.agent_settled!({}, ctx); // armed once only
    assert.deepEqual(calls, ["compact", "send"]);
  });

  it("does nothing on settle when no sleep was armed", async () => {
    const { handlers, calls, ctx } = await setup();
    await handlers.agent_settled!({}, ctx);
    assert.deepEqual(calls, []);
  });

  it("an aborted sleep arms nothing", async () => {
    const { handlers, tool, calls, ctx } = await setup();
    const ac = new AbortController();
    const p = tool.execute("id", { summary: "x", durationSeconds: 60 }, ac.signal, undefined, ctx);
    ac.abort();
    const result = await p;
    assert.equal(result.terminate, undefined);
    await handlers.agent_settled!({}, ctx);
    assert.deepEqual(calls, []);
  });
});
