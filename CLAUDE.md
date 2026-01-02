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
npx tsx src/cli.ts gen givecare "topic"

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
- `visual` - palette, style, design_system, reference_styles
- `platforms` - per-platform settings
- `guardrails` - pursue, reject, never

`brands/givecare/calendar.yml`:
- `frequency` - daily
- `platforms` - [instagram, threads, linkedin]
- `themes` - monthly awareness themes

## Token Expiration

| Platform | Lifetime | Refresh |
|----------|----------|---------|
| Twitter | Never | N/A |
| LinkedIn | ~60 days | Re-run auth |
| Facebook | ~60 days | Re-run auth |
| Instagram | ~60 days | Re-run auth |
| Threads | ~60 days | Re-run auth |
| YouTube | ~1 hour | Auto-refresh |
