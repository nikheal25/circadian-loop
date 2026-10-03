# Security Policy

## Reporting a vulnerability

Report suspected vulnerabilities through GitHub private vulnerability
reporting on this repository. Do not post exploit details, secrets, or
proof-of-concept payloads in public issues or pull requests.

If private reporting is unavailable for your account, open a minimal public
issue asking for a private contact path, without technical details.

## What this package does with your data

- `.pi/loop/cycles.jsonl` is only written when you launch with `CIRCADIAN_DEBUG=1`. It records
  per-cycle metrics and every message you type interactively. It stays on your machine and is never
  transmitted anywhere by this package. Installing the package does not add
  anything to your project's `.gitignore`, so add `.pi/loop/` to it yourself
  before committing a project that runs a loop.
- The extension makes no network calls and spawns no processes. Its own
  filesystem access is narrower than the loop's: it reads `loop.md`,
  `.pi/loop/task.md`, `.pi/loop/inbox.md`, `.pi/loop/handoff.md` and
  `.pi/loop/cycles.jsonl`, and the
  only file it ever writes is `.pi/loop/cycles.jsonl`. Every other file the
  loop produces — the task list, the inbox, the handoff, everything in
  `loop-results/` — is written by the agent's ordinary file tools, which you
  approve like any other write.

## Supported versions

The latest released minor version receives security fixes.
