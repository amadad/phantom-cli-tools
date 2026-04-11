# AGENTS.md

Instructions for AI agents working on this codebase.

## Project

Loom is a brand communications runtime. The active CLI source lives at `runtime/src/cli.ts` and ships as an installable `loom` binary via the `bin` entry in `runtime/package.json` (esbuild bundle at `runtime/dist/cli.js`). Build with `npm run build` inside `runtime/`. Prefer invoking `loom <command>` in docs and examples; `npx tsx src/cli.ts` still works for source-mode development.

Primary workflows:

- `social.post`
- `blog.post`
- `outreach.touch`
- `respond.reply`

The previous content-pipeline implementation is archived under `archive/legacy-20260325/`.

## Architecture

### Runtime
- `runtime/src/domain/types.ts` — core workflow, run, step, and artifact types
- `runtime/src/brands/load.ts` — brand foundation loader for `brands/<name>/brand.yml`
- `runtime/src/runtime/db.ts` — SQLite initialization
- `runtime/src/runtime/runtime.ts` — run engine, artifact writing, review, publish, retry
- `runtime/src/commands/` — CLI command handlers
- `runtime/src/cli/index.ts` — command dispatch and help output

### Brand Foundations
- `brands/<name>/brand.yml` — positioning, audiences, offers, pillars, voice, handles, channel objectives, playbooks, image prompts, visual palette
- `brand validate <name>` checks the foundation shape and referenced assets like logos
- do not recreate the old `*-brand.yml`, queue, rubric, or visual-pipeline structure in active code

### Runtime State
- `state/` is generated at runtime
- `state/loom.sqlite` stores runs and artifact indexes
- runs can end in `failed` and store `error_message` for retry/debug flows
- `state/artifacts/` stores artifact payloads
- `state/exports/` stores publish/export outputs
- do not check `state/` into git

## CLI Contract

This CLI is meant to work well for agents:

- non-interactive by default
- all meaningful inputs must be passable as flags
- every command should support `--json`
- `--help` should stay example-heavy
- failures should be actionable, immediate, and machine-readable under `--json`
- side effects should be idempotent or explicitly resumable
- destructive commands (`review approve`, `review reject`) gate on `--dry-run` / `--yes`
- `loom doctor` precheck covers env vars, paths, and runtime health probe
- list commands paginate with `--limit` / `--offset` and return narrow summaries by default; pass `--full` to include the entire run record
- human-readable side-channel output (e.g. file paths written by `lab render` / `lab card`) goes to stderr so stdout stays a clean JSON envelope

## Conventions

- TypeScript, strict mode
- keep workflows explicit and low-complexity
- prefer typed artifacts between steps over implicit file coupling
- side effects belong at publish time, not draft time
- do not reintroduce the archived monolithic `explore` pattern into active code

## Testing

```bash
cd runtime
npx vitest run
npx tsc --noEmit
```

## Common Tasks

### Add a workflow
1. Add the workflow name in `runtime/src/domain/types.ts`
2. Define its step sequence in `runtime/src/runtime/runtime.ts`
3. Reuse or add step builders that emit typed artifacts
4. Add or update tests in `runtime/src/runtime/runtime.test.ts`

### Add a brand
```bash
loom brand init <name>
```

Then edit `brands/<name>/brand.yml` and run:

```bash
loom brand validate <name> --json
```

(During source-mode development, `cd runtime && npx tsx src/cli.ts brand init <name>` still works.)

### Add a command
1. Add a command handler in `runtime/src/commands/`
2. Register it in `runtime/src/cli/index.ts`
3. Keep the command non-interactive and machine-readable
