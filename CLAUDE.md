# Phantom Loom

Brand-driven content generation: **intel → generate → post**

## Commands

```bash
cd agent

# Intel (weekly)
npx tsx src/cli.ts intel givecare
npx tsx src/cli.ts intel givecare --skip-enrich --dry-run

# Generate (daily)
npx tsx src/cli.ts gen givecare "topic"
npx tsx src/cli.ts gen givecare --auto          # calendar theme or hooks
npx tsx src/cli.ts gen givecare "topic" --save-image

# Post (daily)
npx tsx src/cli.ts post givecare --dry-run      # preview first
npx tsx src/cli.ts post givecare
npx tsx src/cli.ts post givecare --platforms=twitter,linkedin
npx tsx src/cli.ts post givecare --all

# Queue
npx tsx src/cli.ts post list
```

## Architecture

```
agent/src/
├── cli.ts                 # Entry point, command routing
├── commands/
│   ├── intel.ts           # Run intelligence pipeline
│   ├── gen.ts             # Generate content
│   └── post.ts            # Publish to platforms
├── core/
│   ├── types.ts           # Central type definitions
│   ├── brand.ts           # Load YAML, detect frames, build voice context
│   ├── calendar.ts        # Monthly themes with fallback
│   ├── generate.ts        # Topic → copy + image → queue
│   └── image.ts           # Gemini image generation + style transfer
├── intelligence/
│   ├── pipeline.ts        # Orchestrates enrich → detect → extract
│   ├── enrich-apify.ts    # Fetch live metrics via Apify
│   ├── detect-outliers.ts # Flag posts >= 5x median views
│   ├── extract-hooks.ts   # Gemini analysis of viral patterns
│   └── hook-bank.ts       # Store/retrieve proven hooks
├── social/
│   ├── index.ts           # Unified routing, credential validation
│   ├── twitter-direct.ts  # OAuth 1.0a
│   ├── linkedin-direct.ts # OAuth 2.0
│   ├── facebook-direct.ts # Graph API
│   ├── instagram-direct.ts
│   ├── threads-direct.ts
│   └── youtube-direct.ts  # Stub
├── queue/
│   └── index.ts           # File-based queue (review → done/failed)
└── templates/
    ├── kunz/              # Layered typography system
    ├── instax-social.ts   # Polaroid aesthetic
    └── brand-system.ts    # SCTY modular prompts
```

## Data Flow

```
INTEL PIPELINE (weekly)
Influencers DB → Apify scrape → Outlier detection → Hook extraction → Hook Bank

GENERATION PIPELINE (daily)
Topic → Frame detection → Voice context → Hook matching →
Style selection → Gemini (copy + image) → Queue

POSTING PIPELINE
Queue item → Per-platform text → Direct API → Post results
```

## Key Files

| File | Purpose |
|------|---------|
| `brands/givecare.yml` | Voice, visual, platforms, guardrails |
| `brands/givecare/calendar.yml` | Monthly themes |
| `output/queue/queue.json` | Pending/published items |
| `agent/src/intelligence/data/givecare-hooks.json` | Viral hook patterns |

## Brand Configuration

`brands/givecare.yml` structure:

```yaml
voice:
  tone, style, rules          # Core voice
  product_rules               # Product-specific voice
  writing_system              # Anti-AI-slop constraints
  frames                      # Content type structures
  avoid_phrases               # Never-use words

visual:
  palette                     # Colors
  reference_styles            # 7 visual modes with mood keywords
  image_generation            # Model, aspect ratio, resolution

guardrails:
  pursue, reject, never       # Quality controls
```

## Frame Types

Auto-detected from topic keywords:

| Frame | Keywords | Voice Mode |
|-------|----------|------------|
| announcement | release, launch, ship | Product |
| event | conference, summit | Product |
| partnership | partner, collaborat | Founder |
| weekly_update | this week, working on | Product |
| practical_tip | tip, how-to, self-care | Brand (warm) |
| thought | (default) | Writing system |

## Hook Categories

| Category | Pattern |
|----------|---------|
| curiosity | "I tried X for 30 days..." |
| controversy | Hot takes, counterintuitive |
| transformation | Before/after, journey |
| secret | "Nobody talks about..." |
| listicle | "5 things I wish..." |
| story | Narrative hooks |
| question | Rhetorical questions |
| statistic | Data-driven hooks |

## Queue Stages

```
review → publishing → done
                   → failed
```

## Environment Variables

```bash
# Required
GEMINI_API_KEY

# Intel
APIFY_API_TOKEN

# Per-brand credentials (example for givecare)
TWITTER_GIVECARE_API_KEY
TWITTER_GIVECARE_API_SECRET
TWITTER_GIVECARE_ACCESS_TOKEN
TWITTER_GIVECARE_ACCESS_SECRET

LINKEDIN_GIVECARE_ACCESS_TOKEN
LINKEDIN_GIVECARE_ORG_ID

FACEBOOK_GIVECARE_PAGE_ACCESS_TOKEN
FACEBOOK_GIVECARE_PAGE_ID

INSTAGRAM_GIVECARE_ACCESS_TOKEN
INSTAGRAM_GIVECARE_USER_ID

THREADS_GIVECARE_ACCESS_TOKEN
THREADS_GIVECARE_USER_ID
```

## Token Lifetimes

| Platform | Lifetime | Refresh |
|----------|----------|---------|
| Twitter | Never | N/A |
| LinkedIn | ~60 days | Manual re-auth |
| Facebook/Instagram | ~60 days | Manual re-auth |
| Threads | ~60 days | Manual re-auth |
| YouTube | ~1 hour | Auto-refresh |

## Template System

| Template | Purpose | When to Use |
|----------|---------|-------------|
| `kunz` | Layered typography | Bold text-driven posts |
| `instax-social` | Polaroid aesthetic | Lifestyle content |
| `brand-system` | SCTY modular prompts | Abstract visuals |

### Kunz Grid

```
A1-A6: Primary 6-column grid (typography)
B1-B5: Secondary 5-column grid (offset tension)
M1-M12: Mark grid (12x12 for glyphs)
```

### Mark Vocabulary

| Mark | Semantic |
|------|----------|
| `*` `†` | Footnote, invisible labor |
| `+` `×` | Accumulation, growth |
| `:` `/` `~` | Ratio, transformation |
| `—` `\|` | Time, duration |

## Platform Specs

### Image Dimensions

| Platform | Square | Portrait | Landscape |
|----------|--------|----------|-----------|
| Instagram | 1080×1080 | 1080×1350 | 1080×566 |
| Facebook | 1080×1080 | 1080×1350 | 1200×630 |
| LinkedIn | 1080×1080 | 1080×1350 | 1200×628 |
| Twitter/X | 1080×1080 | 1080×1350 | 1200×675 |
| Threads | 1080×1080 | 1080×1920 | — |

### Character Limits

| Platform | Max | Hashtags |
|----------|-----|----------|
| Twitter | 280 | 3 |
| LinkedIn | 3000 | 5 |
| Facebook | 63206 | 3 |
| Instagram | 2200 | 5-10 |
| Threads | 500 | 2-3 |

## Known Issues

- YouTube video upload is stub only
- No scheduling (manual trigger)
- File-based queue (no concurrent access protection)
- Token refresh is manual
- SCTY brand incomplete (220 vs 740 LOC)
- Calendar only has 6/12 months

## Development

```bash
cd agent

# Type check
npx tsc --noEmit

# Run specific command
npx tsx src/cli.ts <command> [args]
```
