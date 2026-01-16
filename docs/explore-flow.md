# Explore Flow

Generate brand-consistent social content through an agentic creative workflow.

## Quick Start

```bash
cd agent

# Full explore (moodboard → select → upscale → finals)
npx tsx src/cli.ts explore <brand> "weekend self-care reset"

# Quick mode (agent picks from refs → 1 generation → finals)
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --quick

# Force specific style (skip selection entirely)
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --style style04

# Use Gemini 3 Pro for higher quality (~$0.25 vs free)
npx tsx src/cli.ts explore <brand> "weekend self-care reset" --pro
```

## Modes

| Mode | Flag | Flow | Speed | Cost |
|------|------|------|-------|------|
| Full | (default) | 6 generations → moodboard → agent picks → upscale → finals | ~60s | ~$0.003 (flash) |
| Quick | `--quick` | Agent picks from refs → 1 generation → upscale → finals | ~20s | ~$0.001 |
| Style | `--style NAME` | Use specified style → 1 generation → upscale → finals | ~15s | ~$0.001 |

Combine with `--pro` for Gemini 3 Pro quality (+~$0.04/generation).

## Pipeline

```
INPUT: topic + brand
         ↓
    ┌─────────────────────────────────────────┐
    │  1. GENERATE VARIATIONS                 │
    │     6 images from 6 style references    │
    │     Model: gemini-2.0-flash (free)      │
    │            gemini-3-pro (--pro, $0.04ea)│
    └─────────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────────┐
    │  2. MOODBOARD                           │
    │     Contact sheet of all variations     │
    │     Labeled by style name               │
    └─────────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────────┐
    │  3. AGENT SELECTION                     │
    │     LLM reviews moodboard + topic       │
    │     Returns: style, confidence, reason  │
    └─────────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────────┐
    │  4. UPSCALE                             │
    │     Real-ESRGAN 4x via Replicate        │
    │     ~$0.002 per image                   │
    └─────────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────────┐
    │  5. GENERATE COPY                       │
    │     Twitter, LinkedIn, Instagram        │
    │     Platform-optimized text + hashtags  │
    └─────────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────────┐
    │  6. COMPOSITE FINALS                    │
    │     Template + headline + logo          │
    │     Platform-specific ratios            │
    └─────────────────────────────────────────┘
         ↓
OUTPUT: output/YYYY-MM-DD/topic-slug/
        ├── moodboard.png      (full mode only)
        ├── selected.png       (upscaled)
        ├── copy.md            (Twitter, LinkedIn, Instagram copy)
        ├── twitter.png        (banner, 1200x675)
        ├── instagram.png      (polaroid, 1080x1080)
        └── story.png          (polaroid, 1080x1920)
```

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

## Style Guide

Brand colors and typography defined in `brands/<brand>/style.yml`:

```yaml
colors:
  dark: "#1E1B16"      # Text on light bg (not used for headlines)
  light: "#FFE8D6"     # Text on dark bg
  secondary: "#54340E" # Brown - headlines and logo on light bg
  accent: "#5046E5"    # Electric indigo

  backgrounds:
    warm: "#FCEEE3"    # Peach cream
    cream: "#FDFBF7"   # Off-white
    dark: "#1E1B16"    # Dark mode

typography:
  headline:
    font: "Alegreya"
    weight: 700
    scale:
      large: 0.04      # 4% of canvas height
      medium: 0.032
      small: 0.025

logo:
  svg: "public/gc-logo.svg"
  colors:
    onLight: "#54340E" # Brown
    onDark: "#FFE8D6"  # Cream
```

## Prompt Engineering

Variations use this prompt pattern:

```
Study the reference image and identify its ESSENCE:
- What makes this style distinctive? (materials, forms, techniques)
- What is the visual language? (geometric, organic, photographic, sculptural)
- What is the color relationship and mood?

Now create a NEW, ORIGINAL image for this topic: "{topic}"

CRITICAL RULES:
- DO NOT recreate or copy the reference image
- Extract the aesthetic DNA and apply it to a fresh composition
- Different subject, different perspective, different arrangement
- Same visual spirit, completely new execution
- NO text, NO words, NO letters

COLOR PALETTE to use:
- #FDFBF7 cream (background/negative space)
- #1E1B16 deep brown (primary forms)
- #5046E5 indigo (accent)

The result should feel like it belongs in the same gallery as the reference, but be a distinct piece.
```

## Environment Variables

```bash
GEMINI_API_KEY        # Required
REPLICATE_API_TOKEN   # Required for upscaling
```

## File Structure

```
agent/src/
├── commands/
│   └── explore.ts      # Main explore command
├── gen/
│   ├── poster.ts       # Template compositing
│   ├── templates.ts    # Template definitions
│   ├── copy.ts         # Copy generation (Twitter, LinkedIn, etc.)
│   └── classify.ts     # Content type classification
└── core/
    └── brand.ts        # Brand + style loading

brands/<brand>/
├── <brand>.yml        # Voice, platforms
├── style.yml           # Colors, typography, logo
└── styles/
    ├── ref_*.png       # Style references
    └── archive/        # Unused references

output/
└── YYYY-MM-DD/
    └── topic-slug[-mode]/
        ├── moodboard.png   # Full mode only
        ├── selected.png    # Upscaled content image
        ├── copy.md         # Platform copy + hashtags
        ├── twitter.png     # 1200x675
        ├── instagram.png   # 1080x1080
        └── story.png       # 1080x1920
```
