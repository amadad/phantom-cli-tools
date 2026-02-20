# Content Generation Flow

Generate brand-consistent social content. Available as atomic primitives or a single `explore` wrapper.

## Atomic Workflow (Agent-Driven)

```bash
cd agent

# Step 1a: Generate copy (can run in parallel with 1b)
npx tsx src/cli.ts copy <brand> "weekend self-care reset" --json

# Step 1b: Generate image (can run in parallel with 1a)
npx tsx src/cli.ts image <brand> "weekend self-care reset" --quick --json

# Step 1b alt: Generate knockout image (transparent background)
npx tsx src/cli.ts image <brand> "weekend self-care reset" --quick --knockout --json

# Step 2: Grade copy quality
npx tsx src/cli.ts grade <brand> "$(cat output/.../copy.md)" --json

# Step 3: Generate platform posters
npx tsx src/cli.ts poster <brand> --image output/.../selected.png --headline "Your brain is running 20 tabs" --json

# Step 4: Enqueue for publishing
npx tsx src/cli.ts enqueue <brand> --topic "weekend self-care reset" --copy output/.../copy.json --image output/.../selected.png --json

# Step 5: Publish
npx tsx src/cli.ts post <brand> --id gen_... --json
```

Each step is independently retriable. Agent inspects JSON, decides next step.

## One-Shot Wrapper

```bash
# Full explore (generate → upscale → copy → grade → poster → enqueue)
npx tsx src/cli.ts explore <brand> "weekend self-care reset"

# Quick mode (skip upscale)
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --quick

# Use Gemini 3 Pro for higher quality
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --pro
```

## Image Generation

Prompt-only — no reference images needed. Brand visual config drives the aesthetic:

- **Generic brands**: `visual.image` config (style, mood, prefer, avoid, palette_instructions)
- **SCTY**: Modular `visual.prompt_system` — subject types, form modes, texture modes composed per-run with random rotation for variety

| Flag | Effect |
|------|--------|
| `--quick` | Skip upscale step |
| `--pro` | Use Gemini 3 Pro model |
| `--knockout` | Remove background → transparent PNG |

### SCTY Prompt System

Each generation randomly selects from curated pools per image type:

| Image Type | Subject Pool | Form Pool | Texture Pool |
|------------|-------------|-----------|--------------|
| photo | symbol, conceptual_diagram, celestial, iconic_silhouette | techno, cosmic, duotone, vector | photocopy, crosshatch, overprint, future |
| poster | grid, mass, iconic_silhouette, conceptual_diagram | geometric, duotone, collage, cosmic | halftone, overprint, risograph, crosshatch |
| abstract | abstract, celestial, letterform, conceptual_diagram | gestural, collage, cosmic, halftone | risograph, ink_bleed, overprint, paper |

When `duotone` form is selected, color constraint relaxes to single spot color + black.

## Pipeline

```
INPUT: topic + brand
         |
    +---------+       +---------+
    |  IMAGE  |       |  COPY   |     (parallel)
    +---------+       +---------+
         |                 |
    Classify topic     Classify topic
    Build prompt       Build voice context
    from brand YAML    Generate per-platform
    Generate           Grade + retry
    [Knockout]
    [Upscale]
         |                 |
         +--------+--------+
                  |
             +---------+
             | POSTER  |
             +---------+
                  |
             Named layout + headline + logo
             Platform-specific ratios
                  |
             +---------+
             | ENQUEUE |
             +---------+
                  |
             Queue item (stage: review)
                  |
OUTPUT: output/YYYY-MM-DD/topic-slug/
        ├── selected.png       (content image, or transparent if --knockout)
        ├── copy.md            (human-readable)
        ├── copy.json          (machine-readable)
        ├── twitter.png        (banner, 1200x675)
        ├── instagram.png      (portrait, 1080x1350)
        └── story.png          (story, 1080x1920)
```

## Shared Functions

The atomic commands export self-contained functions for reuse:

```typescript
// Takes brand name, handles all setup internally
import { generateBrandImage } from './commands/image-cmd'
import { generateAndGradeCopy } from './commands/copy-cmd'
import { generateFinals } from './commands/poster-cmd'
import { loadBrandVisual } from './core/visual'        // Visual config loader
import { buildStylePlan, canRenderWithImage, computeLayout } from './composite/layouts'
```

`explore` is a thin orchestrator that calls these — ~160 LOC.

## Named Layouts

Layout is selected deterministically from topic hash using brand `layoutWeights` (or uniform fallback over allowed layouts).

| Layout | Image | Text | Use |
|--------|-------|------|-----|
| `split` | Side-by-side or stacked | md-lg headline | Default image+text |
| `overlay` | Full canvas, dimmed | lg headline floats | High-impact |
| `type-only` | None | display headline | Text-forward |
| `card` | Top portion | Headline below | Image-dominant |
| `full-bleed` | Full canvas | Small label | Image IS the post |

Platform ratios: `twitter: landscape`, `instagram: portrait`, `story: story`

## Environment Variables

```bash
GEMINI_API_KEY        # Required (copy + image generation)
REPLICATE_API_TOKEN   # Required for upscaling
```
