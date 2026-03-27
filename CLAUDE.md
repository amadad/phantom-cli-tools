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
    generate/    copy drafts, explore grid, source image (fal.ai Flux / Gemini)
    publish/     social platform adapters (Twitter, LinkedIn, Meta, Threads)
    render/      canvas-based typographic compositing per platform
    runtime/     SQLite-backed run engine + step definitions

brands/
  <name>/brand.yml    pillars, voice, visual system, image_prompt, playbooks

state/          generated at runtime, gitignored
archive/        archived legacy implementation
```

## Image Generation

The `social.post` workflow includes AI-powered image generation:

- **Explore step**: generates a 3x3 visual direction grid via fal.ai Flux Pro 1.1
- **Image step**: generates a full-res source image via API (canvas fallback when no key)
- **Render step**: composites headline, body, brand name onto source image per platform

Requires `GEMINI_API_KEY` or `GOOGLE_API_KEY` (either works). Preferred model: `gemini-3.1-flash-image-preview`. Without keys, image falls back to deterministic canvas art.

Each brand.yml includes an `image_prompt` field with a complete generation directive and `[SUBJECT]` slot. SCTY uses a damaged-reproduction process system. GiveCare uses a grounded-fragment with single-intervention system.

## Content Pillars

Each brand defines 3 content pillars in `brand.yml` with `perspective`, `signals`, `format`, and `frequency` fields. The `signals` array connects to external signal sources (e.g. last30days) for topical content routing.

## Verification

```bash
cd runtime
npx vitest run
npx tsc --noEmit
```

## Archive

The old content-pipeline implementation is preserved in `archive/legacy-20260325/`.
