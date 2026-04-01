# Loom Runtime

Autonomous brand communications agent. brand.yml is the operating spec — pillars are lenses for evaluating signals, voice constrains copy, visual drives rendering, offers define CTAs. The runtime executes the spec.

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
npx tsx src/cli.ts lab render --brand givecare --figure statement --gravity high --ground cream --platform linkedin --headline "Care is infrastructure" --body "63M provide unpaid care." --image watershed --json
```

## CLI Rules

Agentic CLI contract:

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
    core/        paths, env helpers
    domain/      workflow/run/artifact types
    generate/    copy drafts, explore grid, source image
    publish/     social platform adapters (Twitter, LinkedIn, Meta, Threads)
    render/
      card.ts      deterministic proportional card renderer (lab)
      social.ts    two-phase social renderer (Gemini art + canvas text)
      dither.ts    procedural art subjects + Bayer 4×4 dithering
      colors.ts    shared color math (hexToRgb, muted)
      fonts.ts     shared font registration (idempotent)
    runtime/     SQLite-backed run engine + step definitions

brands/
  <name>/brand.yml         agent operating spec (see below)
  <name>/learnings.json    card vocabulary, visual system learnings

state/          generated at runtime, gitignored
archive/        archived legacy + generate-card.sh
```

## Brand Spec (brand.yml)

brand.yml is the agent's operating instructions:

- **pillars** — what the agent talks about + from what angle (lenses, not calendar)
- **voice** — tone, style, do/don't rules for copy generation
- **visual** — palette, typography, image_prompt (Agnes Martin for GiveCare), style
- **offers** — products with `url` and `cta` (e.g., "Sign up at pulse.givecareapp.com")
- **channels** — where content goes, `platforms` list, `default_offer` for CTA resolution

CTA resolution: `channels.social.default_offer` → matches `offers[].id` → uses that offer's `cta` field. No hallucinated CTAs.

## Social Post Pipeline

Two-phase rendering (social.ts):

1. **Gemini generates art-only image** — uses `brand.visual.image_prompt` with `[SUBJECT]` slot. No text, no logos, no brand names in generated image.
2. **Canvas composites text + logo on top** — deterministic typography, hard split layout, brand logo from `brands/<name>/logo.png`.

Pipeline steps: `signal → brief → draft → explore → image → render`

Requires `GEMINI_API_KEY` or `GOOGLE_API_KEY`. Without keys, falls back to solid-color canvas with text overlay.

## Card Renderer (lab render)

Proportional typographic system for the interactive card lab. Three inputs → PNG:

- **Figure**: `statement` (headline), `stat` (big number), `passage` (quote), `index` (stacked list)
- **Gravity**: `high`, `center`, `low` — shifts content within Renner margin ratios (2:3:4:6)
- **Ground**: 12 color schemes (cream, warm, slate, sage, grounded, mute, ink, dusk, dawn, ember, fog, storm)

All sizes from √2 modular scale. Dithered abstract imagery (topography, watershed, strata, grid-erosion, root-system, threshold) on right side, non-overlapping with text. Outputs to `state/cards/`.

```bash
npx tsx src/cli.ts lab render --brand givecare --figure stat --gravity center --ground grounded --platform linkedin --stat-num '$1T' --stat-label 'unpaid care labor' --image strata --json
```

## Content Pillars

Each brand defines pillars with `perspective`, `signals`, `format`, and `frequency`. The runtime uses these as lenses — matching signals to pillars, injecting perspective into copy, and accepting `--pillar <id>` to force an angle.

## Output Formats

Per-brand formats via `--format <id>`. Resolution: explicit flag → pillar's `default_format` → `standard`.

Each format can define `prompt_overlay` for copy generation variation (e.g., infographic format extracts stats).

## Runtime Safety

- failed runs persisted with step and error message
- published runs cannot be reviewed again
- explicit publish targets must be configured for the brand
- `inspect artifact` limited to files under `state/artifacts/`

## Verification

```bash
cd runtime
npx vitest run
npx tsc --noEmit
```

## Archive

Legacy content-pipeline: `archive/legacy-20260325/`. Standalone generate-card.sh: `archive/generate-card.sh`.
