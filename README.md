# Phantom Loom

Brand-driven social content pipeline with viral pattern learning.

```
WEEKLY                              DAILY
Influencers → Outliers → Hooks      Topic → Copy + Image → Grade → Queue → Post
                                          ↑                    ↓
                                   Learnings ←────── Eval Log
```

## Quick Start

```bash
cd agent && npm install
cp .env.example .env  # Add GEMINI_API_KEY, REPLICATE_API_TOKEN

# One-shot generation
npx tsx src/cli.ts explore <brand> "your topic" --quick

# Or atomic steps (agent-driven)
npx tsx src/cli.ts copy <brand> "topic" --json
npx tsx src/cli.ts image <brand> "topic" --quick --json
```

## Commands

### Atomic Primitives

Each returns structured JSON with `--json`. Designed for agent orchestration — copy and image run in parallel, each step checkpoints to disk, failure is isolated.

| Command | Purpose | Key Output |
|---------|---------|------------|
| `copy <brand> "topic"` | Platform copy + eval grading | `copy.md` + `copy.json` |
| `image <brand> "topic"` | Brand-consistent image | `selected.png` |
| `poster <brand> --image <p> --headline "text"` | Platform posters | `twitter.png`, `instagram.png`, `story.png` |
| `enqueue <brand> --topic "t" --copy <p> --image <p>` | Add to queue | Queue item (stage: review) |
| `grade <brand> "text"` | Score against rubric | `{ score, passed, dimensions }` |

### Convenience Wrapper

```bash
npx tsx src/cli.ts explore <brand> "topic"          # Full: image + copy + grade + poster + enqueue
npx tsx src/cli.ts explore <brand> "topic" --quick   # Skip moodboard
npx tsx src/cli.ts explore <brand> "topic" --pro     # Gemini Pro quality
```

### Pipeline

```bash
npx tsx src/cli.ts intel <brand>              # Weekly: scrape → outliers → hooks
npx tsx src/cli.ts post <brand> [--dry-run]   # Publish queue items
npx tsx src/cli.ts queue list [brand]         # View queue
npx tsx src/cli.ts learn <brand>              # Aggregate eval learnings
```

### Utility

```bash
npx tsx src/cli.ts brand init <name>          # Scaffold new brand
npx tsx src/cli.ts video <brand> <brief>      # Short-form video
npx tsx src/cli.ts brief <brand>              # Daily research digest
npx tsx src/cli.ts blog <brand> "topic"       # Long-form blog post
```

## Agent Workflow

All commands return `{ status: "ok", command, data }` or `{ status: "error", command, error }` with `--json`.

```bash
# Parallel
phantom copy givecare "burnout" --json &
phantom image givecare "burnout" --quick --json &
wait

# Sequential
phantom grade givecare "$(cat output/.../copy.md)" --json
phantom poster givecare --image output/.../selected.png --headline "..." --json
phantom enqueue givecare --topic "burnout" --copy output/.../copy.json --image output/.../selected.png --json
phantom post givecare --id gen_... --json
```

Each step is independently retriable. Agent inspects JSON, decides next step.

## Structure

```
agent/src/
├── commands/   explore, copy-cmd, image-cmd, poster-cmd, enqueue-cmd, intel, post, queue, brand
├── core/       brand, visual, paths, session, types, json
├── cli/        args, flags, output, registry, schemas, errors
├── generate/   copy, image, classify, style-selection, upscale
├── eval/       grader, image-grader, learnings
├── composite/  poster, layouts, renderer/ (4-layer canvas)
├── publish/    twitter, linkedin, facebook, instagram, threads
├── intel/      pipeline, enrich-apify, detect-outliers, extract-hooks
├── queue/      per-brand file-based queue
└── video/      video pipeline, providers/

brands/<name>/
├── <name>-brand.yml     # Voice, visual, platforms
├── <name>-rubric.yml    # Eval dimensions + threshold
├── queue.json           # Post queue
├── styles/              # Reference images for style transfer
├── assets/              # logo.svg, fonts/
├── intel/               # hooks.json, outliers.json
└── learnings.json       # Aggregated feedback

output/YYYY-MM-DD/topic-slug/
├── selected.png         # Generated image (upscaled)
├── copy.md / copy.json  # Platform copy (human + machine)
├── twitter.png          # Platform posters
├── instagram.png
└── story.png
```

## Visual System

All visual config lives in the brand YAML `visual:` section. Single source of truth — no build step, no token pipeline.

```yaml
visual:
  palette: { background, primary, accent, secondary, warm, dark, light }
  typography:
    headline: { font, fontFile, weight, lineHeight, sizes: { sm, md, lg, display } }
  logo: { light, dark, colorOnLight, colorOnDark }
  layouts: [split, overlay, type-only, card]
  density: moderate        # relaxed | moderate | tight
  alignment: center        # center | left | asymmetric
  background: warm         # light | dark | warm
```

### Named Layouts

| Layout | Image | Text |
|--------|-------|------|
| `split` | Side-by-side or stacked | md-lg headline |
| `overlay` | Full canvas, dimmed | lg headline floats |
| `type-only` | None | display headline |
| `card` | Top portion | Headline below |
| `full-bleed` | Full canvas | Small label |

Layout selected deterministically from topic hash over brand's allowed layouts. Rendered via 4-layer node-canvas compositor (GraphicLayer → ImageLayer → Logo → TypeLayer).

## Adding a Brand

```bash
npx tsx src/cli.ts brand init <name>
```

Then configure:
1. `brands/<name>/<name>-brand.yml` — voice, visual style, platforms
2. `brands/<name>/<name>-rubric.yml` — eval dimensions + pass threshold
3. `brands/<name>/styles/` — reference images for style transfer
4. `brands/<name>/assets/logo.svg`
5. Env vars: `TWITTER_<NAME>_API_KEY`, `LINKEDIN_<NAME>_ACCESS_TOKEN`, etc.

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | Copy + image generation |
| `REPLICATE_API_TOKEN` | Yes | Image upscaling |
| `APIFY_API_TOKEN` | Intel only | Influencer scraping |
| `CARTESIA_API_KEY` | Video only | TTS voice generation |

Per-brand platform credentials: `TWITTER_<BRAND>_API_KEY`, `LINKEDIN_<BRAND>_ACCESS_TOKEN`, etc.

## Development

```bash
cd agent
npx vitest run           # Tests
npx vitest --watch       # Watch mode
npx tsc --noEmit         # Typecheck
```

## Docs

- [Architecture](docs/architecture.md) — system overview, core modules, data flow
- [Content Generation Flow](docs/explore-flow.md) — atomic workflow, pipeline, cost
- [CLI Overview](docs/cli/overview.md) — design principles, command taxonomy
- [CLI Command Spec](docs/cli/command-spec.md) — full command reference
- [CLI Output Contract](docs/cli/output.md) — JSON response formats
- [CLI Errors](docs/cli/errors.md) — exit codes, error formats

## Platform Support

| Platform | Auth | Status |
|----------|------|--------|
| Twitter | OAuth 1.0a | Full |
| LinkedIn | OAuth 2.0 | Full |
| Facebook | Graph API | Full |
| Instagram | Graph API | Full |
| Threads | Meta API | Full |
| YouTube | Google OAuth | Stub |
