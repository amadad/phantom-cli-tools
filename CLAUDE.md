# Phantom Loom CLI

Brand content pipeline: **intel → generate → eval → post**

## Commands

CLI design system docs: `docs/cli/overview.md`

```bash
cd agent
# Atomic primitives (agent-composable, each returns JSON with --json)
npx tsx src/cli.ts copy <brand> "topic"         # Generate platform copy + eval
npx tsx src/cli.ts image <brand> "topic"        # Generate brand image
npx tsx src/cli.ts poster <brand> --image <path> --headline "text"  # Platform posters
npx tsx src/cli.ts enqueue <brand> --topic "t" --copy <p> --image <p>  # Add to queue
npx tsx src/cli.ts grade <brand> "text"         # Eval: score against rubric

# Convenience wrapper (chains the primitives)
npx tsx src/cli.ts explore <brand> "topic"      # image + copy + grade + poster + enqueue

# Intel
npx tsx src/cli.ts intel <brand>                # Weekly: scrape → outliers → hooks

# Queue & publish
npx tsx src/cli.ts post <brand> [--dry-run]     # Publish queue items
npx tsx src/cli.ts post <brand> --all           # Post to all platforms
npx tsx src/cli.ts queue list [brand]           # View queue items
npx tsx src/cli.ts queue show <id> [brand]      # Show a queue item

# Other
npx tsx src/cli.ts learn <brand>                # Aggregate learnings from eval-log
npx tsx src/cli.ts video <brand> <brief>        # Generate short-form video
npx tsx src/cli.ts brand init <name>            # Scaffold a new brand
```

## Agent Workflow

Each primitive returns structured JSON with `--json`. Agent orchestrates:

```bash
# Steps 1a + 1b run in parallel
phantom copy givecare "topic" --json        # → { headline, twitter, linkedin, ... }
phantom image givecare "topic" --quick --json # → { imagePath, style, model }

# Sequential steps
phantom grade givecare "text" --json         # → { score, passed, dimensions }
phantom poster givecare --image ... --headline ... --json  # → { outputs }
phantom enqueue givecare --topic ... --copy copy.json --image ... --json  # → { queueId }
phantom post givecare --id gen_... --json    # → { posted, failed }
```

Copy and image are parallelizable. Failure is isolated — if image gen fails, copy is preserved. Each step writes to disk for checkpointing.

## Structure

```
agent/src/
├── core/       brand, paths, session, types, json, http
├── intel/      pipeline, enrich-apify, detect-outliers, extract-hooks
├── generate/   copy, image, classify, style-selection, upscale
├── video/      video pipeline, conform, providers/ (replicate/kling)
├── eval/       grader, image-grader, learnings
├── composite/  poster, templates
├── publish/    social, twitter/linkedin/facebook/instagram/threads
├── cli/        args, flags, output, registry, schemas, errors
├── commands/   explore, copy-cmd, image-cmd, poster-cmd, enqueue-cmd, intel, post, video, queue, brand
└── queue/      per-brand file-based queue

brands/<name>/
├── <name>-brand.yml   # Voice, visual, platforms
├── <name>-rubric.yml  # Eval dimensions + threshold
├── queue.json         # Per-brand post queue
├── assets/            # logo.svg, fonts/
├── styles/            # Reference images for style transfer
├── intel/             # hooks.json, outliers.json, influencers.json
└── learnings.json     # Aggregated feedback loop

output/
├── YYYY-MM-DD/        # Daily sessions
│   └── topic-slug/
│       ├── selected.png   # Generated image
│       ├── copy.md        # Human-readable copy
│       ├── copy.json      # Machine-readable copy (for enqueue)
│       ├── twitter.png    # Platform poster
│       ├── instagram.png
│       └── story.png
└── eval-log.jsonl     # All evaluations
```

## Data Flow

| Stage | Flow |
|-------|------|
| Intel | Influencers → Apify → Outliers (50x+ median) → Hooks |
| Copy | Topic → Classify → Voice + Hooks + Learnings → Gemini → Eval → Retry |
| Image | Topic → Load refs → Style selection → Generate → Upscale |
| Poster | Image + Headline → Template → Platform-specific ratios |
| Enqueue | Copy.json + Image → Queue item (stage: review) |
| Post | Queue → Rate limit → Platform API → Done/Failed |
| Video | Brief → Images → Kling animation → TTS → Conform → Stitch |

## Shared Internals

Commands share logic via exported functions, not abstraction layers:

```typescript
import { generateBrandImage } from './commands/image-cmd'    // Self-contained: takes brand name
import { generateAndGradeCopy } from './commands/copy-cmd'   // Copy + eval retry loop
import { generateFinals } from './commands/poster-cmd'       // Self-contained: takes brand name
import { parseArgs } from './cli/args'                       // Shared arg parser
import { createSessionDir, slugify } from './core/session'   // Session dir helper
import { resolvePalette } from './core/brand'                // Palette fallback logic
```

## Env

```bash
GEMINI_API_KEY         # Required - copy + image generation
APIFY_API_TOKEN        # Intel scraping
REPLICATE_API_TOKEN    # Image upscale + video animation
CARTESIA_API_KEY       # TTS voice generation

# Per-brand platform creds: TWITTER_<BRAND>_*, LINKEDIN_<BRAND>_*, etc.
```

## Adding Brand

```bash
npx tsx src/cli.ts brand init <name>
```

Then edit:
1. `brands/<name>/<name>-brand.yml` - voice, visual, platforms
2. `brands/<name>/<name>-rubric.yml` - eval dimensions
3. `brands/<name>/styles/` - reference images
4. `brands/<name>/assets/logo.svg`
5. Env vars: `TWITTER_<NAME>_API_KEY`, etc.

Template lives at `brands/_template/`.

## Key Patterns

### Per-Brand Queues
Queues are stored at `brands/<brand>/queue.json`. Always specify brand:
```bash
npx tsx src/cli.ts post <brand>  # NOT just "post"
```

### Brand Discovery
```typescript
import { discoverBrands } from './core/paths'
const brands = discoverBrands()  // ['brand-a', 'brand-b']
```

### Session Output
```typescript
import { createSessionDir, slugify } from './core/session'
const dir = createSessionDir(slugify('caregiver burnout'), '-quick')
// → output/2026-02-18/caregiver-burnout-quick/
```

## Session End

```bash
cd agent && npx tsc --noEmit  # typecheck
git add <files> && git commit -m "feat: description"
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Twitter 403 | Remove URL from tweet; spam filter |
| Instagram fail | Needs public URL; use R2 upload |
| Wrong queue item | Specify brand explicitly |
| Type errors | Check QueueItem.brand field exists |
