# Phantom Loom

Autonomous brand-driven content: **hooks + themes → generate → post**

## System Overview

```
brand.yml      →  voice, visual, guardrails (constant)
calendar.yml   →  monthly themes (constant)
hooks.json     →  viral hooks (weekly intel)
queue.json     →  posts to publish (seeded + generated)
                       ↓
                 daily post
```

## Quick Start

```bash
cd agent && npm install

# Intel (weekly) - scan influencers, detect viral, extract hooks
npx tsx src/cli.ts intel givecare

# Generate - create content from hooks + theme
npx tsx src/cli.ts gen givecare "topic"       # manual topic
npx tsx src/cli.ts gen givecare --auto        # uses calendar or hooks

# Post - publish from queue
npx tsx src/cli.ts post givecare

# Queue - view pending posts
npx tsx src/cli.ts queue
```

## File Structure

```
phantom-loom/
├── agent/                    # CLI + pipeline
│   └── src/
│       ├── cli.ts            # Main entry point
│       ├── commands/         # intel, gen, post
│       ├── core/             # generate, brand, image, types
│       ├── social/           # Platform posting (direct APIs)
│       └── intelligence/     # Influencer + viral detection
├── brands/
│   ├── givecare.yml          # Brand identity
│   ├── givecare/
│   │   ├── calendar.yml      # Monthly themes
│   │   └── styles/           # Reference images
│   └── scty.yml
├── docs/
│   └── content-calendar-framework.md
├── output/                   # Generated content (gitignored)
│   ├── queue/queue.json      # Post queue
│   └── intel/hooks.json      # Viral hooks
└── .env                      # API keys (gitignored)
```

## Cadence

| Task | Frequency | Command |
|------|-----------|---------|
| Intel | Weekly | `intel givecare` |
| Generate | Daily | `gen givecare "topic"` or `gen givecare --from-hooks` |
| Post | Daily | `post givecare` |

## Content Sources

| Source | Who | When |
|--------|-----|------|
| **Seeded** | You | Product, founder thoughts |
| **Generated** | System | Hooks + monthly theme |

Queue is FIFO. Seeded posts before generated.

## Platform Support

| Platform | Auth | Content |
|----------|------|---------|
| Twitter | OAuth 1.0a | Text + Images |
| LinkedIn | OAuth 2.0 | Text + Images |
| Facebook | Graph API | Text + Images |
| Instagram | Platform API | Images (required) |
| Threads | Threads API | Text + Images |
| YouTube | Google OAuth | Videos/Shorts |

## Content Formats

Four post format types:

| Format | Description |
|--------|-------------|
| `image` | Static singular — 1 image |
| `carousel` | Static slideshow — multiple images |
| `video` | Animated singular — 1 video/motion graphic |
| `video-carousel` | Animated slideshow — multiple videos or mixed |

### Format Support Matrix

| Format | IG | FB | LI | X | Threads | TikTok | YT Shorts |
|--------|:--:|:--:|:--:|:-:|:-------:|:------:|:---------:|
| image | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| carousel | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❌ |
| video | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| video-carousel | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |

### Carousel Limits

| Platform | Max Slides | Notes |
|----------|:----------:|-------|
| Instagram | 20 | Images + videos mixed |
| Facebook | 10 | Images + videos mixed |
| LinkedIn | 10 | PDF document carousel only |
| Twitter/X | 4 | Images only, no swipe UI |
| Threads | 20 | Images + videos mixed |
| TikTok | 35 | Images only |

### Image Specs

| Platform | Square | Portrait | Landscape |
|----------|--------|----------|-----------|
| Instagram | 1080×1080 | 1080×1350 (4:5) | 1080×566 |
| Facebook | 1080×1080 | 1080×1350 | 1200×630 |
| LinkedIn | 1080×1080 | 1080×1350 | 1200×628 (1.91:1) |
| Twitter/X | 1080×1080 | 1080×1350 | 1200×675 (16:9) |
| Threads | 1080×1080 | 1080×1920 (9:16) | — |
| TikTok | 1080×1080 | 1080×1920 (9:16) | — |

### Video Specs

| Platform | Format | Max Size | Max Length | Recommended |
|----------|--------|:--------:|:----------:|-------------|
| Instagram Reels | MP4/MOV | 4GB | 90s | 1080×1920, 30fps |
| Instagram Feed | MP4/MOV | 4GB | 60s | 1080×1350, 30fps |
| Facebook | MP4/MOV | 4GB | 240min | 1080×1920, 30fps |
| LinkedIn | MP4/MOV | 200MB | 30min | 1920×1080, 30fps |
| Twitter/X | MP4/MOV | 512MB | 140s | 1280×720, 30fps |
| Threads | MP4 | — | 5min | 1080×1920, 30fps |
| TikTok | MP4/MOV | 4GB | 10min | 1080×1920, 30fps |
| YouTube Shorts | MP4 | — | 60s | 1080×1920, 30fps |

### GIF Support

| Platform | Native GIF | Recommendation |
|----------|:----------:|----------------|
| Instagram | ❌ | Export as MP4 |
| Facebook | ✅ | Native or MP4 |
| LinkedIn | ✅ | Native or MP4 |
| Twitter/X | ✅ | Converts to MP4 |
| Threads | ❌ | Export as MP4 |
| TikTok | ❌ | Export as MP4 |

**Best practice**: Export all animations as MP4 (H.264) for universal support. 85% of users watch without sound — text-based motion graphics ideal.

## Video Generation Pricing

Using Replicate API with Kling 2.5 Turbo Pro (recommended).

### Per-Video Cost

| Duration | Cost | Notes |
|----------|------|-------|
| 5s | $0.35 | $0.07/sec |
| 10s | $0.70 | Max duration |

### Cost Per Post (All Channels)

| Strategy | Videos | Cost |
|----------|--------|------|
| One size, crop/letterbox | 1 | $0.35 |
| One per aspect ratio | 3 | **$1.05** |
| One per platform | 7 | $2.45 |

**Recommended**: 3 videos per post ($1.05)
- 1:1 → Instagram Feed, Facebook, Threads
- 9:16 → Instagram Reels, TikTok, YouTube Shorts
- 16:9 → Twitter/X, LinkedIn

### Model Comparison (Replicate)

| Model | Cost/sec | 5s Cost | Quality |
|-------|----------|---------|---------|
| Kling 2.5 Turbo Pro | $0.07 | $0.35 | Best |
| Hailuo 02 | $0.054 | $0.27 | Good |
| WAN 2.2 | $0.03 | $0.15 | Budget |

### Budget Calculator

| Budget | Posts (3 videos) | Posts (1 video) |
|--------|------------------|-----------------|
| $10 | 9 | 28 |
| $50 | 47 | 142 |
| $100 | 95 | 285 |
| $127 | 121 | 363 |

## Environment Variables

```bash
# Required
GEMINI_API_KEY=...            # Content + image generation

# Intel
APIFY_API_TOKEN=...           # Influencer enrichment
EXA_API_KEY=...               # Discovery (optional)

# Posting (per-brand, per-platform)
TWITTER_GIVECARE_API_KEY=...
TWITTER_GIVECARE_API_SECRET=...
TWITTER_GIVECARE_ACCESS_TOKEN=...
TWITTER_GIVECARE_ACCESS_SECRET=...

LINKEDIN_GIVECARE_ACCESS_TOKEN=...
LINKEDIN_GIVECARE_ORG_ID=...

# See .env.example for full list
```

## Brand Configuration

`brands/givecare.yml`:
- `voice` - tone, style, rules, writing_system, avoid_phrases
- `visual` - palette, style, reference_styles
- `platforms` - per-platform settings
- `guardrails` - pursue, reject, never

`brands/givecare/calendar.yml`:
- `frequency` - daily
- `platforms` - [instagram, threads, linkedin]
- `themes` - monthly awareness themes

## Template System

Templates render typography-driven images using Satori + Sharp.

| Template | Purpose | Grid |
|----------|---------|------|
| `kunz` | Layered typography (Willi Kunz inspired) | A (6-col) + B (5-col) + M (12x12 marks) |
| `render` | Standard DesignSpec → PNG | Simple vertical stack |
| `instax-social` | Polaroid aesthetic | Flash photography + bg removal |

### Kunz Grid Reference

```
A1-A6: Primary 6-column grid (typography alignment)
B1-B5: Secondary 5-column grid (offset tension)
M1-M12: Mark grid (12x12 for glyphs/patterns)
```

### Mark Vocabulary

| Mark | Semantic |
|------|----------|
| `*` `†` | Footnote, invisible labor |
| `+` `×` | Accumulation, growth |
| `:` `/` `~` | Ratio, transformation |
| `—` `\|` | Time, duration |
| `%` `#` | Measurement |
| `.` `●` `○` | Points, presence |

### Usage

```typescript
import { renderKunz } from './templates/kunz'

const buffer = await renderKunz({
  rows: [{ content: "The unsung hours", size: 72, col: "A1" }],
  marks: [{ glyph: "*", mode: "pattern", col: 9, row: 9, spanCols: 4, spanRows: 4 }],
  contrast: "loud-quiet",
  logo: { col: "A1", position: "bottom" },
  ratio: "1:1"
})
```

## Token Expiration

| Platform | Lifetime | Refresh |
|----------|----------|---------|
| Twitter | Never | N/A |
| LinkedIn | ~60 days | Re-run auth |
| Facebook | ~60 days | Re-run auth |
| Instagram | ~60 days | Re-run auth |
| Threads | ~60 days | Re-run auth |
| YouTube | ~1 hour | Auto-refresh |
