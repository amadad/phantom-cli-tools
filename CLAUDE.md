# Phantom Loom

Brand-driven content: **intel → generate → post**

## Commands

```bash
cd agent

# Intel (weekly)
npx tsx src/cli.ts intel givecare

# Generate (daily)
npx tsx src/cli.ts gen givecare "topic"
npx tsx src/cli.ts gen givecare --auto

# Post
npx tsx src/cli.ts post givecare --dry-run
npx tsx src/cli.ts post givecare

# Queue
npx tsx src/cli.ts post list
```

## Architecture

```
agent/src/
├── cli.ts              # Entry point
├── commands/           # intel, gen, post
├── core/               # types, brand, calendar, generate, image
├── intelligence/       # enrich, detect-outliers, extract-hooks, hook-bank
├── social/             # twitter, linkedin, facebook, instagram, threads (direct APIs)
├── queue/              # File-based queue
└── templates/          # kunz, instax, brand-system

brands/
├── givecare.yml        # Voice, visual, platforms, guardrails
└── givecare/
    ├── calendar.yml    # Monthly themes
    └── styles/         # Reference images

output/
├── queue/queue.json    # Pending/published
└── intel/              # Hooks, outliers
```

## Data Flow

```
INTEL:   Influencers → Apify → Outliers → Hooks
GEN:     Topic → Frame → Voice → Hooks → Gemini → Queue
POST:    Queue → Per-platform text → API → Done/Failed
```

## Key Concepts

- **Frame**: Auto-detected content type (announcement, tip, thought)
- **Hook**: Viral pattern with category + multiplier
- **Reference style**: Visual mode with mood keywords for style transfer
- **Queue stages**: review → done | failed

## Environment

```bash
GEMINI_API_KEY              # Required
APIFY_API_TOKEN             # Intel
TWITTER_GIVECARE_*          # Per-brand, per-platform
LINKEDIN_GIVECARE_*
```

## Known Issues

- YouTube stub only
- No scheduling
- File-based queue
- Token refresh manual
- SCTY brand incomplete
- Calendar 6/12 months
