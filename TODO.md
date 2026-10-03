# TODO

## Nick to do — ship circadian-loop v0.1.0

- [ ] Push the repo to GitHub and tag the release. If a premature `v0.1.0` tag or release already exists, delete it first (`gh release delete v0.1.0 --yes --cleanup-tag`) so the tag matches the npm version. The banner URL, `git:` install and README images only work after the push.
- [ ] Fresh-laptop test: `pi install npm:circadian-loop`, restart pi, run a loop for 3+ cycles. Confirm `sleep` ends the session, `/wake` resumes with the handoff, and the agent recovers after a compaction.
- [ ] Announce: link the release in the Substack and LinkedIn articles.

## Rollback

Fresh install fails to load the extension or skill, `/wake` does not resume, or a secret appears in the package: `npm deprecate circadian-loop@0.1.0 "<reason>"` (unpublish is time-limited) and revert the GitHub release.

## Done

- [x] Typecheck, 32/32 tests, `npm audit` clean, `npm pack` contents checked
- [x] Published `circadian-loop@0.1.0` to npm; clean-room `pi install npm:circadian-loop -l` works; pi.dev package page is live
