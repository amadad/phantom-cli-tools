# Loom Runtime

First-principles rebuild of the repo as a brand communications runtime.

## Scope

The active runtime supports four workflows:

- `social.post`
- `blog.post`
- `outreach.touch`
- `respond.reply`

Everything flows through the same primitives:

1. signal
2. brief
3. draft
4. review
5. publish

## Commands

The runtime ships as a `loom` binary (esbuild bundle, `bin` entry in `runtime/package.json`). Build with `pnpm --filter loom-runtime build` (or `cd runtime && npm run build`), then invoke via `loom` once linked. Both forms are supported:

```bash
# Installed binary
loom help
loom doctor --json                                     # precheck env + runtime health
loom ops health --json
loom brand validate givecare --json
loom run social.post --brand givecare --topic "caregiver benefits gap" --json
loom run blog.post --brand givecare --pillar policy --topic "paid leave" --json
loom review list --limit 25 --offset 0 --json          # narrow {id, status, workflow, brand, createdAt}
loom review list --full --json                         # include full run records
loom review approve <run_id> --variant social-main --dry-run --json
loom review approve <run_id> --variant social-main --yes --json
loom review reject  <run_id> --reason "off-brand" --yes --json
loom inspect run <run_id> --json
loom publish <run_id> --platforms twitter,linkedin --dry-run --json

# Or from source during development
cd runtime
npx tsx src/cli.ts help
```

`lab render` and `lab card` echo the written output path to stderr so the JSON envelope on stdout stays pipe-clean.

## Architecture

- `runtime/src/domain/` — typed workflow, run, and artifact model
- `runtime/src/brands/` — brand foundation loader
- `runtime/src/runtime/` — SQLite-backed runtime and workflow engine
- `runtime/src/commands/` — public CLI commands
- `brands/<brand>/brand.yml` — brand foundations, including pillars, visual system, handles, and playbooks
- `state/` — runtime database, artifacts, and exports, generated on demand and gitignored

## Principles

- one runtime, four workflows
- typed artifacts between every step
- SQLite-backed state
- resumable runs
- explicit failed-run state with stored error messages
- approval before publish
- fail-fast validation at command boundaries
- no legacy content pipeline assumptions in the active code path

## Notes

The previous implementation has been archived under `archive/legacy-20260325/`.
Legacy outputs and unused package leftovers were moved under `archive/legacy-20260325/legacy-artifacts/`.
