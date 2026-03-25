# Loom Runtime

Brand communications runtime for agent-friendly workflows.

## Active Surface

The active CLI lives in `runtime/src/cli.ts`.

Supported workflows:

- `social.post`
- `blog.post`
- `outreach.touch`
- `respond.reply`

Core commands:

```bash
cd runtime
npx tsx src/cli.ts help
npx tsx src/cli.ts run social.post --brand givecare --topic "caregiver benefits gap"
npx tsx src/cli.ts review list
npx tsx src/cli.ts review approve <run_id> --variant social-main
npx tsx src/cli.ts publish <run_id>
npx tsx src/cli.ts inspect run <run_id>
npx tsx src/cli.ts retry <run_id> --from draft
```

## CLI Rules

This repo is being rebuilt around an agentic CLI contract:

- non-interactive by default
- all inputs available via flags
- `--json` for machine-readable results
- useful `--help` with examples
- fail fast with actionable messages
- idempotent or resumable side effects

## Structure

```text
runtime/
  src/
    brands/      brand foundation loader
    cli/         command dispatch
    commands/    public command handlers
    domain/      workflow/run/artifact types
    runtime/     SQLite-backed run engine

brands/
  <name>/brand.yml

state/          generated at runtime, gitignored
archive/        archived legacy implementation
```

## Verification

```bash
cd runtime
npx vitest run
npx tsc --noEmit
```

## Archive

The old content-pipeline implementation is preserved in `archive/legacy-20260325/`.
