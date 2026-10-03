# Troubleshooting

Open **Help** on the countdown screen first. Anything wrong shows under **Needs your attention**.

| Symptom | Cause | Fix |
|---|---|---|
| The agent never goes to sleep | `sleep` is a tool the agent chooses to call. A model that ignores `loop.md` won't loop. | Tell it "follow loop.md". Stronger models hold the protocol better. |
| Nothing happens after quitting pi | The loop only runs while pi runs. | In the loop's folder, run `/skill:circadian-loop`. With `loop.md` present it resumes. |
| Help says the loop file is missing | `loop.md` isn't at the project root. | Run `/skill:circadian-loop` to set it up. |
| Help says no tasks are left, or all are waiting | The task list is empty or blocked on you. | Add a message in `.pi/loop/inbox.md` under **Your message box**, or answer the open question. |
| A question is still open | It's waiting for your answer. | Type it after `Your answer:` in `.pi/loop/inbox.md`. The next cycle resumes that task first. |
| Help flags a failed compaction | The boundary compaction failed. The loop woke anyway, on a fuller context. | Read `.pi/loop/handoff.md` to see what the agent recorded. Relaunch with `CIRCADIAN_DEBUG=1` to log the reason. |
| The loop stopped with no message | Something went wrong at a boundary. | Relaunch with `CIRCADIAN_DEBUG=1`. `.pi/loop/cycles.jsonl` records `wake_failed`, `unplanned_compaction`, `aborted` and `stopped` events. |
| Costs are higher than expected | The loop runs while you're away. | Check the last cycle's cost on Help. Add a rule under `## User rules`, or lengthen `## Sleep`, in `loop.md`. |
| Large session file | A boundary is a compaction inside one session, so the file grows even though the context doesn't. | Expected for very long loops. |
| `cycles.jsonl` stopped showing old cycles | Help reads only the last 256 KB. | Expected. The file itself keeps everything. |

Headless modes (`--print`, `rpc`, `json`) sleep correctly, but the countdown screen and Help are terminal-only.
