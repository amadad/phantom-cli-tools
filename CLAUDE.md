# Phantom Loom CLI

Brand content pipeline: **intel → generate → eval → post**

## Commands

CLI design system docs: `docs/cli/overview.md`

```bash
cd agent
# Atomic primitives (agent-composable, each returns JSON with --json)
npx tsx src/cli.ts copy <brand> "topic"         # Generate platform copy + eval
npx tsx src/cli.ts image <brand> "topic"        # Generate brand image (--knockout for transparent)
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

# Tokens
npx tsx src/cli.ts token check [brand]          # Check all token statuses
npx tsx src/cli.ts token refresh [brand]        # Refresh expiring tokens
npx tsx src/cli.ts token refresh --all [brand]  # Force refresh all tokens

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
# --knockout for transparent PNG (bg removed via sharp threshold)

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
├── core/       brand, visual, paths, types, json, http, slop, r2
├── intel/      pipeline, enrich-apify, detect-outliers, extract-hooks
├── generate/   copy, image, classify, upscale, providers/
├── video/      video pipeline, conform, providers/ (replicate/kling)
├── eval/       grader, image-grader, learnings
├── composite/  poster, layouts, renderer/ (canvas compositor)
├── publish/    social, meta-graph, twitter/linkedin/facebook/youtube, rate-limit, token-refresh
├── cli/        args, index, registry, types, errors
├── commands/   explore, copy-cmd, image-cmd, poster-cmd, enqueue-cmd, intel, post, video, queue, brand, token
└── queue/      per-brand file-based queue

brands/<name>/
├── <name>-brand.yml   # Voice, visual, platforms
├── <name>-rubric.yml  # Eval dimensions + threshold
├── queue.json         # Per-brand post queue
├── assets/            # logo.svg, fonts/
├── styles/            # Style reference images (visual direction)
├── intel/             # hooks.json, outliers.json, influencers.json
└── learnings.json     # Aggregated feedback loop

output/
├── YYYY-MM-DD/        # Daily sessions
│   └── topic-slug/
│       ├── selected.png   # Generated image (transparent if --knockout)
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
| Image | Topic → Classify → Brand prompt (visual.image / prompt_system) → Generate → [Knockout] → [Upscale] |
| Poster | Image + Headline → Named layout → Platform-specific ratios |
| Enqueue | Copy.json + Image → Queue item (stage: review) |
| Post | Queue → Rate limit → Platform API → Done/Failed |
| Video | Brief → Images → Kling animation → TTS → Conform → Stitch |

## Shared Internals

Commands share logic via exported functions, not abstraction layers:

```typescript
import { generateBrandImage } from './commands/image-cmd'    // Self-contained: takes brand name
import { generateAndGradeCopy } from './commands/copy-cmd'   // Copy + eval retry loop
import { generateFinals } from './commands/poster-cmd'       // Self-contained: takes brand name
import { extractBrandTopic } from './cli/args'                // Shared arg parser
import { createSessionDir, slugify } from './core/paths'     // Session dir helper
import { loadBrandVisual } from './core/visual'               // BrandVisual config loader
import { buildVoiceContext } from './core/brand'             // Copy writing context
import { checkTokens, refreshTokens, preflightTokenCheck } from './publish/token-refresh'
```

## Visual System

Single source of truth: `visual:` section in brand YAML. No build step, no tokens pipeline.

```typescript
import { loadBrandVisual } from './core/visual'
const v = loadBrandVisual('givecare')
// → { palette, typography, logo, layouts, density, alignment, background, paletteRotation, variants }
```

### Named Layouts
Brand YAML drives a deterministic style plan:
- `layouts` and `variants.layoutWeights` choose the layout
- `variants.density`, `variants.alignment`, `variants.background` choose design style
- fallback defaults stay from top-level `density`, `alignment`, `background`

| Layout | Image | Text | Use |
|--------|-------|------|-----|
| `split` | Side/stacked | md-lg headline | Default image+text |
| `overlay` | Full canvas, dimmed | lg headline floats | High-impact |
| `type-only` | None | display headline | Text-forward |
| `card` | Top portion | Headline below | Image-dominant |
| `full-bleed` | Full canvas | Small label | Image IS the post |

### Rendering Pipeline
`composite/renderer/` — 4-layer node-canvas compositor:
1. **GraphicLayer** — background fill, gradient strip
2. **ImageLayer** — content image placed in layout zone
3. **Logo** — brand logo (drawn after image for z-order)
4. **TypeLayer** — headline text with brand typography

### Brand Visual Config
```yaml
visual:
  palette: { background, primary, accent, secondary, warm, dark, light }
  typography:
    headline: { font, fontFile, weight, lineHeight, sizes: { sm, md, lg, display } }
  logo: { light, dark, colorOnLight, colorOnDark }
  layouts: [split, overlay, type-only, card]
  density: moderate     # relaxed | moderate | tight
  alignment: center     # center | left | asymmetric
  background: warm      # light | dark | warm
  paletteRotation: 4
  variants:
    layoutWeights:
      split: 2
      overlay: 1
      card: 1
      full-bleed: 1
      type-only: 1
    density: [moderate]
    alignment: [center]
    background: [warm]
  image:                # Image generation prompt config
    style: "..."        # Core aesthetic description
    mood: "..."         # Emotional tone
    avoid: [...]        # Hard exclusions (text, logos, etc.)
    prefer: [...]       # Soft preferences (textures, forms, etc.)
    palette_instructions: "..."  # Color usage guidance
  prompt_system:        # Optional modular prompt system (SCTY)
    core_aesthetic: [...]
    subject_types: { abstract, symbol, grid, conceptual_diagram, celestial, ... }
    form_modes: { geometric, typographic, duotone, collage, cosmic, ... }
    texture_modes: { halftone, photocopy, overprint, crosshatch, ... }
```

### Image Generation
Prompt-only — brand YAML `visual.image` + `visual.prompt_system` drive the aesthetic. No reference images needed.

- **Generic brands**: `buildGenericPrompt()` composes from `image.style`, `image.mood`, `image.prefer`, `image.avoid`
- **SCTY**: `buildSctyPrompt()` randomly selects from curated subject/form/texture pools per image type
- **`--knockout`**: Prompts for solid white background, then sharp threshold removes it → transparent PNG

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
1. `brands/<name>/<name>-brand.yml` - voice, visual (including `image:` config), platforms
2. `brands/<name>/<name>-rubric.yml` - eval dimensions
3. `brands/<name>/assets/logo.svg` + fonts/
4. Env vars: `TWITTER_<NAME>_API_KEY`, etc.

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
import { createSessionDir, slugify } from './core/paths'
const dir = createSessionDir(slugify('caregiver burnout'), '-quick')
// → output/2026-02-18/caregiver-burnout-quick/
```

## Session End

```bash
cd agent && npx tsc --noEmit  # typecheck
git add <files> && git commit -m "feat: description"
```

## Token Lifecycle

| Platform | Expiry | Auto-refresh | Manual re-auth |
|----------|--------|-------------|----------------|
| Twitter | Never (OAuth 1.0a) | N/A | N/A |
| Facebook | Never (page tokens) | N/A | N/A |
| Instagram | 60 days | `token refresh` (must be valid) | Meta Developer Console > Use cases > Instagram API > Generate access tokens |
| Threads | 60 days | `token refresh` (must be valid) | Meta Developer Console > Use cases > Threads API > User Token Generator |
| LinkedIn | 60 days | Not available | `cd agent && npx tsx scripts/linkedin-auth.ts <brand>` |

The `post` command runs a pre-flight token check automatically. If a token is expired but refreshable, it refreshes it. If not, it skips that platform and warns you.

Run `token refresh` proactively (e.g., weekly) to extend Instagram/Threads tokens before they expire. Once expired, they can't be refreshed via API — you must re-auth manually in the Meta Developer Console.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Twitter 403 | Remove URL from tweet; spam filter |
| Instagram fail | Needs public URL; use R2 upload |
| Token expired | `token check` to diagnose, `token refresh` to fix, or re-auth manually |
| Wrong queue item | Specify brand explicitly |
| Type errors | Check QueueItem.brand field exists |
