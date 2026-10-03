import { strict as assert } from "node:assert";
import { after, describe, it } from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// DEBUG and the log root are read when the module loads, so each case imports
// a fresh copy (cache-busted by query string) from its own throwaway cwd.
const roots: string[] = [];
const startCwd = process.cwd();
const startFlag = process.env.CIRCADIAN_DEBUG;
const modulePath = path.resolve(startCwd, ".pi/extensions/circadian-loop/index.ts");

after(() => {
  process.chdir(startCwd);
  if (startFlag === undefined) delete process.env.CIRCADIAN_DEBUG;
  else process.env.CIRCADIAN_DEBUG = startFlag;
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

async function loadIn(flag: string | undefined, tag: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "circadian-debug-"));
  roots.push(root);
  process.chdir(root);
  if (flag === undefined) delete process.env.CIRCADIAN_DEBUG;
  else process.env.CIRCADIAN_DEBUG = flag;
  const mod = await import(`file://${modulePath}?${tag}`);
  return { root, appendCycleLog: mod.appendCycleLog as (r: Record<string, unknown>) => void };
}

describe("cycle log debug flag", () => {
  for (const flag of [undefined, "", "0", "true"]) {
    it(`writes nothing and creates no folder when CIRCADIAN_DEBUG=${JSON.stringify(flag)}`, async () => {
      const { root, appendCycleLog } = await loadIn(flag, `off-${String(flag)}`);
      appendCycleLog({ event: "user_message", text: "hi" });
      assert.equal(fs.existsSync(path.join(root, ".pi")), false);
    });
  }

  it("creates the folder and appends a line when CIRCADIAN_DEBUG=1", async () => {
    const { root, appendCycleLog } = await loadIn("1", "on");
    appendCycleLog({ event: "user_message", text: "hi" });
    appendCycleLog({ event: "sleep" });
    const lines = fs
      .readFileSync(path.join(root, ".pi/loop/cycles.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    assert.deepEqual(lines, [{ event: "user_message", text: "hi" }, { event: "sleep" }]);
  });
});
