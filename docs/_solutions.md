# Solutions Log

## 2026-03-30 — CLI failures now stay machine-readable
- Problem: CLI commands could return plain stderr text on failure even when `--json` was requested, which broke agent workflows and made invalid input harder to recover from automatically.
- Fix: centralized CLI error handling now returns JSON error envelopes, and command boundaries validate workflows, steps, variants, artifact paths, and requested publish platforms before side effects begin.

## 2026-03-30 — Failed runs are persisted instead of looking reviewable
- Problem: a workflow step could throw after a run record was created, leaving partial state that still looked like a normal in-review run.
- Fix: runtime execution now marks runs as `failed`, stores the failing step plus `error_message`, reports failed counts in `ops health`, and blocks review on failed runs until the operator retries.

## 2026-03-30 — Brand and publish validation fail fast on unsafe config
- Problem: bad brand config and unsafe publish requests were accepted too late or silently, including unsupported handle keys, missing logo assets, explicit publish targets without configured auth, and re-initializing an existing brand.
- Fix: brand loading now validates supported social handles, `brand validate` checks referenced assets, `brand init` refuses to overwrite an existing foundation, and explicit publish targets must already be configured for the brand unless the command is a dry run.
