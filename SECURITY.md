# Security Policy

## Reporting a vulnerability

Report suspected vulnerabilities through GitHub private vulnerability
reporting on this repository. Do not post exploit details, secrets, or
proof-of-concept payloads in public issues or pull requests.

If private reporting is unavailable for your account, open a minimal public
issue asking for a private contact path, without technical details.

## What this package does with your data

- `.pi/loop/cycles.jsonl` records every message you type interactively,
  along with per-cycle metrics. It stays on your machine and is never
  transmitted anywhere by this package. The shipped `.gitignore` excludes
  `.pi/loop/`, so review yours before committing a project that uses this.
- The extension makes no network calls and spawns no processes. It reads and
  writes only under the project root: `loop.md`, `.pi/loop/`, and
  `loop-results/`.

## Supported versions

The latest released minor version receives security fixes.
