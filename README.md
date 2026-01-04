# Phantom Loom

Brand-driven content generation: **intel → generate → post**

## What It Does

Phantom Loom generates platform-specific social content while maintaining brand voice and visual consistency. It learns what works by analyzing viral patterns in your niche, then applies those patterns to your content.

```
WEEKLY                          DAILY
Influencers → Viral Detection   Topic → Copy + Image → Queue → Post
     ↓                               ↓
Hook Bank                       Twitter, LinkedIn, Facebook,
(proven patterns)               Instagram, Threads, YouTube
```

## Core Value

| Feature | Benefit |
|---------|---------|
| Hook extraction | Content based on signal, not gut |
| Frame system | Consistent structure across content types |
| Multi-platform gen | One topic → 5 platforms in 30 seconds |
| Style transfer | Visual consistency without a designer |
| Brand YAML | Portable, version-controlled identity |

## Quick Start

```bash
cd agent && npm install

# Set up environment
cp .env.example .env
# Add: GEMINI_API_KEY, APIFY_API_TOKEN, platform credentials

# Intel (weekly) - find viral patterns
npx tsx src/cli.ts intel givecare

# Generate (daily) - create content
npx tsx src/cli.ts gen givecare "caregiving burnout"
npx tsx src/cli.ts gen givecare --auto  # uses calendar theme or hooks

# Post (daily) - publish to platforms
npx tsx src/cli.ts post givecare --dry-run  # preview first
npx tsx src/cli.ts post givecare
```

## How It Works

### Intelligence Pipeline (Weekly)

```
1. ENRICH: Apify scrapes live Instagram/TikTok metrics
2. DETECT: Flag posts with views >= 5x median (outliers)
3. EXTRACT: Gemini analyzes why posts went viral
4. STORE: Hook patterns indexed by category, theme, multiplier
```

Hook categories: `curiosity`, `controversy`, `transformation`, `secret`, `listicle`, `story`, `question`, `statistic`

### Generation Pipeline (Daily)

```
1. FRAME: Auto-detect content type (announcement, tip, thought)
2. VOICE: Load brand rules, writing system, guardrails
3. HOOKS: Match topic to proven patterns
4. STYLE: Select reference images for visual consistency
5. GENERATE: Gemini creates copy + image
6. QUEUE: Store for review/posting
```

### Posting Pipeline

```
1. LOAD: Get next queue item
2. ADAPT: Platform-specific text (char limits, hashtags)
3. POST: Direct API calls (OAuth, no SDKs)
4. TRACK: Record success/failure, post URLs
```

## Architecture

```
phantom-loom/
├── agent/src/
│   ├── commands/          # intel, gen, post
│   ├── core/              # types, brand, calendar, generate, image
│   ├── intelligence/      # enrich, detect-outliers, extract-hooks
│   ├── social/            # twitter, linkedin, facebook, instagram, threads
│   ├── queue/             # file-based queue manager
│   └── templates/         # kunz, instax, design systems
├── brands/
│   ├── givecare.yml       # voice, visual, platforms, guardrails
│   └── givecare/
│       ├── calendar.yml   # monthly themes
│       └── styles/        # reference images
└── output/
    ├── queue/queue.json   # pending/published items
    └── intel/             # hooks, outliers, influencers
```

## Brand Configuration

`brands/givecare.yml` defines everything:

```yaml
voice:
  tone: "Warm, direct, honest"
  rules: [...]              # 10 core voice rules
  writing_system: {...}     # anti-AI-slop constraints
  frames: {...}             # content type structures
  avoid_phrases: [...]      # never-use words

visual:
  palette: {...}
  reference_styles: [...]   # 7 visual modes with mood keywords
  image_generation: {...}   # model, aspect ratio, resolution

guardrails:
  pursue: [...]             # qualities we seek
  reject: [...]             # qualities we avoid
  never: [...]              # hard stops
```

## Platform Support

| Platform | Auth | Content | Status |
|----------|------|---------|--------|
| Twitter | OAuth 1.0a | Text + Image | Full |
| LinkedIn | OAuth 2.0 | Text + Image | Full |
| Facebook | Graph API | Text + Image | Full |
| Instagram | Graph API | Image required | Full |
| Threads | Meta API | Text + Image | Full |
| YouTube | Google OAuth | Video | Stub |

## Environment Variables

```bash
# Required
GEMINI_API_KEY=...

# Intel
APIFY_API_TOKEN=...

# Per-brand, per-platform
TWITTER_GIVECARE_API_KEY=...
TWITTER_GIVECARE_API_SECRET=...
TWITTER_GIVECARE_ACCESS_TOKEN=...
TWITTER_GIVECARE_ACCESS_SECRET=...

LINKEDIN_GIVECARE_ACCESS_TOKEN=...
LINKEDIN_GIVECARE_ORG_ID=...

# See .env.example for full list
```

## Strengths

- **Anti-AI-slop writing system**: Core rules, trauma-informed language, guardrails
- **Hook-driven ideation**: Viral patterns from real data with multiplier scoring
- **Per-platform optimization**: Each platform gets tailored copy
- **Style transfer**: Reference images + mood keywords = visual consistency
- **Brand as config**: Single YAML, easy to version control and fork

## Known Limitations

- No scheduling (manual trigger only)
- File-based queue (won't scale, no concurrent access protection)
- Token refresh is manual (LinkedIn/Facebook expire in ~60 days)
- No analytics feedback loop
- YouTube video upload incomplete

## License

MIT
