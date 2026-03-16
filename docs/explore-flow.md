# Content Generation Flow

Generate brand-consistent social content. Available as atomic primitives or a single `explore` wrapper.

## Atomic Workflow (Agent-Driven)

```bash
cd agent

# Step 1: Generate copy (gives imageDirection for step 2)
npx tsx src/cli.ts copy <brand> "weekend self-care reset" --json

# Step 2: Generate image
npx tsx src/cli.ts image <brand> "weekend self-care reset" --quick --json

# Step 2 alt: Generate knockout image (transparent background)
npx tsx src/cli.ts image <brand> "weekend self-care reset" --quick --knockout --json

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
# Full explore (copy → image → poster → enqueue → notify)
npx tsx src/cli.ts explore <brand> "weekend self-care reset"

# Quick mode (skip upscale)
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --quick

# Nano mode — Gemini single-shot poster generation + pixel sort post-processing
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --nano --pixel-sort

# Use Gemini 3 Pro for higher quality
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --pro

# Texture mode — p5.brush generative background (no API cost, ~5s)
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --texture=editorial
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --texture=architectural

# Gradient mode — mesh gradient background (no API cost, ~1s)
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --gradient=blush-silk

# Force a specific layout (overlay, split, type-only, card, full-bleed)
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --texture=editorial --layout overlay
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
| `--texture [style]` | Use p5.brush texture instead of AI image (editorial, expressive, architectural, gestural, layered) |
| `--gradient [preset]` | Use mesh gradient instead of AI image |
| `--layout <name>` | Force layout (overlay, split, type-only, card, full-bleed) |

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

`explore` is a thin orchestrator that calls these — ~200 LOC.

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

## Nano Poster Mode

Single-shot Gemini image generation (`--nano`). Gemini renders image + typography + layout in one call. Post-processing stack:

1. **Pixel sort** (`--pixel-sort`) — horizontal brightness-threshold sorting, masked to protect upper 35% (typography zone)
2. **Film grain** — per-pixel luminance noise via seeded PRNG
3. **Ordered dither** — Bayer 4x4 matrix for print-like texture

Preset: `GIVECARE_FULL` — threshold 0.08, streak 220, intensity 0.8, grain 0.18, dither 0.10.

### Content Pillars → Visual Identity

Each pillar drives the poster's accent color, eyebrow label, and image direction:

| Pillar | Eyebrow | Accent | Image Direction |
|--------|---------|--------|-----------------|
| shipped | TOOLS | `#FF9F00` orange | constructed, architectural, precise |
| learned | FIELD NOTES | `#2855AE` cobalt | observational, close study, quiet details |
| amplify | SIGNAL | `#84531E` sage | wide perspective, horizon, distance |
| broken | OUTLOOK | `#DF7900` rust | tension, erosion, absence |

Accent color flows through: eyebrow text color, geometric accent shapes, image color hints.

### Review

```bash
# Open gallery for latest session
npx tsx src/cli.ts review latest

# Open gallery for specific directory
npx tsx src/cli.ts review ./output/2026-03-09/topic-slug/
```

Self-contained HTML with approve/reject per image. Exports `review.json`.

## Environment Variables

```bash
GEMINI_API_KEY        # Required (copy + image generation)
REPLICATE_API_TOKEN   # Required for upscaling
```
