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

```bash
cd runtime
npx tsx src/cli.ts help
npx tsx src/cli.ts run social.post --brand givecare --topic "caregiver benefits gap"
npx tsx src/cli.ts review list
npx tsx src/cli.ts review approve <run_id> --variant social-main
npx tsx src/cli.ts publish <run_id>
```

## Architecture

- `runtime/src/domain/` — typed workflow, run, and artifact model
- `runtime/src/brands/` — brand foundation loader
- `runtime/src/runtime/` — SQLite-backed runtime and workflow engine
- `runtime/src/commands/` — public CLI commands
- `brands/<brand>/brand.yml` — brand foundations
- `state/` — runtime database, artifacts, and exports, generated on demand and gitignored

## Principles

- one runtime, four workflows
- typed artifacts between every step
- SQLite-backed state
- resumable runs
- approval before publish
- no legacy content pipeline assumptions in the active code path

## Notes

The previous implementation has been archived under `archive/legacy-20260325/`.
Legacy outputs and unused package leftovers were moved under `archive/legacy-20260325/legacy-artifacts/`.
