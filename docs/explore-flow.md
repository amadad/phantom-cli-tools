# Content Generation Flow

Generate brand-consistent social content. Available as atomic primitives or a single `explore` wrapper.

## Atomic Workflow (Agent-Driven)

```bash
cd agent

# Step 1a: Generate copy (can run in parallel with 1b)
npx tsx src/cli.ts copy <brand> "weekend self-care reset" --json

# Step 1b: Generate image (can run in parallel with 1a)
npx tsx src/cli.ts image <brand> "weekend self-care reset" --quick --json

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
# Full explore (moodboard → select → upscale → copy → grade → poster → enqueue)
npx tsx src/cli.ts explore <brand> "weekend self-care reset"

# Quick mode (agent picks from refs → 1 generation)
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --quick

# Force specific style (skip selection entirely)
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --style style04

# Use Gemini 3 Pro for higher quality
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --pro
```

## Image Modes

| Mode | Flag | Flow | Speed | Cost |
|------|------|------|-------|------|
| Full | (default) | 8 variations → moodboard → agent picks → upscale | ~60s | ~$0.003 (flash) |
| Quick | `--quick` | Agent picks from refs → 1 generation → upscale | ~20s | ~$0.001 |
| Style | `--style NAME` | Use specified style → 1 generation → upscale | ~15s | ~$0.001 |

Combine with `--pro` for Gemini 3 Pro quality (+~$0.04/generation).

## Pipeline

```
INPUT: topic + brand
         |
    +---------+       +---------+
    |  IMAGE  |       |  COPY   |     (parallel)
    +---------+       +---------+
         |                 |
    Load refs         Classify topic
    Style select      Build voice context
    Generate          Generate per-platform
    Upscale           Grade + retry
         |                 |
         +--------+--------+
                  |
             +---------+
             | POSTER  |
             +---------+
                  |
             Template + headline + logo
             Platform-specific ratios
                  |
             +---------+
             | ENQUEUE |
             +---------+
                  |
             Queue item (stage: review)
                  |
OUTPUT: output/YYYY-MM-DD/topic-slug/
        ├── moodboard.png      (full mode only)
        ├── selected.png       (upscaled content image)
        ├── copy.md            (human-readable)
        ├── copy.json          (machine-readable)
        ├── twitter.png        (banner, 1200x675)
        ├── instagram.png      (polaroid, 1080x1080)
        └── story.png          (polaroid, 1080x1920)
```

## Shared Functions

The atomic commands export self-contained functions for reuse:

```typescript
// Takes brand name, handles all setup internally
import { generateBrandImage } from './commands/image-cmd'
import { generateAndGradeCopy } from './commands/copy-cmd'
import { generateFinals } from './commands/poster-cmd'
```

`explore` is a thin orchestrator that calls these — ~160 LOC.

## Cost

| Mode | Per Run | Notes |
|------|---------|-------|
| Flash (default) | ~$0.003 | Experimental model, free variations |
| Pro (--pro) | ~$0.25 | Higher quality, $0.04/variation |

## Style References

Located in `brands/<brand>/styles/`:

| File | Style |
|------|-------|
| ref_07_style03.png | Organic, calming textures |
| ref_08_style04.png | Matisse paper cutouts |
| ref_09_style05.png | Abstract textile art |
| ref_10_style06.png | Warm minimalist |
| ref_12_style08.png | Wire sculpture |
| ref_13_style09.png | Editorial portrait |

Archived styles in `styles/archive/`.

## Templates

| Template | Use Case | Ratios |
|----------|----------|--------|
| polaroid | Instagram, Story | square, portrait, story |
| banner | Twitter, LinkedIn | landscape, wide |
| quote | Text-heavy | square, portrait, story |
| editorial | Magazine style | square, portrait, landscape |
| split | Balanced layout | square, portrait, landscape |
| minimal | Clean, modern | square, portrait |

## Environment Variables

```bash
GEMINI_API_KEY        # Required (copy + image generation)
REPLICATE_API_TOKEN   # Required for upscaling
```
