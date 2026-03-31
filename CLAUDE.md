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
npx tsx src/cli.ts ops health --json
npx tsx src/cli.ts brand validate givecare --json
npx tsx src/cli.ts run social.post --brand givecare --topic "caregiver benefits gap" --json
npx tsx src/cli.ts run social.post --brand givecare --format infographic --topic "caregiver workforce" --json
npx tsx src/cli.ts run social.post --brand givecare --pillar care-economy --topic "$470B unpaid care labor" --json
npx tsx src/cli.ts run blog.post --brand givecare --pillar policy --topic "paid leave" --json
npx tsx src/cli.ts review list --json
npx tsx src/cli.ts review approve <run_id> --variant social-main --json
npx tsx src/cli.ts publish <run_id> --platforms twitter,linkedin --dry-run --json
npx tsx src/cli.ts inspect run <run_id> --json
npx tsx src/cli.ts retry <run_id> --from draft --json
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
    generate/    copy drafts, explore grid, source image
    publish/     social platform adapters (Twitter, LinkedIn, Meta, Threads)
    render/      Gemini- or canvas-based per-platform social asset rendering
    runtime/     SQLite-backed run engine + step definitions

brands/
  <name>/brand.yml    pillars, voice, visual system, image_prompt, playbooks

state/          generated at runtime, gitignored
archive/        archived legacy implementation
```

## Image Generation

The `social.post` workflow includes AI-powered image generation:

- **Explore step**: generates a 3x3 visual direction grid with Gemini
- **Image step**: writes an image brief and only generates a source image when the canvas fallback path is needed
- **Render step**: generates per-platform social assets with Gemini or falls back to deterministic canvas rendering

Requires `GEMINI_API_KEY` or `GOOGLE_API_KEY` (either works). Preferred model: `gemini-3.1-flash-image-preview`. Without keys, the runtime falls back to deterministic canvas art.

Each brand.yml includes an `image_prompt` field with a complete generation directive and `[SUBJECT]` slot. SCTY uses a damaged-reproduction process system. GiveCare uses a grounded-fragment with single-intervention system.

## Content Pillars

Each brand defines content pillars in `brand.yml` with `perspective`, `signals`, `format`, and `frequency` fields. The runtime loads those pillars into the brand foundation, includes the selected pillar in the brief, uses that perspective in social/blog draft generation, and accepts `--pillar <id>` as workflow input when you want to force a specific angle.

## Output Formats

Workflows support per-brand output formats via `--format <id>`. Format resolution:

1. Explicit `--format infographic` flag
2. Selected pillar's `default_format` (e.g., care-economy defaults to infographic)
3. `standard` (existing behavior)

Each brand defines available formats in `brand.yml` under `formats:`. Format changes which steps run — an infographic skips explore/image and uses a data-extraction draft + infographic renderer.

| Brand | Formats |
| --- | --- |
| GiveCare | `standard`, `infographic`, `quote-card` |
| SCTY | `standard`, `signal-card`, `primer` |

Infographic renderer lives in `runtime/src/render/infographic.ts` with Gemini + canvas fallback.

## Runtime Safety

- failed runs are persisted with the failing step and error message
- published runs cannot be reviewed again
- explicit publish targets must already be configured for the brand
- `inspect artifact` is limited to files under `state/artifacts/`

## Verification

```bash
cd runtime
npx vitest run
npx tsc --noEmit
```

## Archive

The old content-pipeline implementation is preserved in `archive/legacy-20260325/`.
