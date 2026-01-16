# Phantom Loom CLI

Brand-driven content pipeline with feedback loop: **intel → generate → eval → post**

## What It Does

Generate platform-specific social content while maintaining brand voice and visual consistency. Learn what works by analyzing viral patterns, grade content against rubrics, and inject learnings back into generation.

```
WEEKLY                              DAILY
Influencers → Outliers → Hooks      Topic → Copy + Image → Grade → Queue → Post
                                           ↑                    ↓
                                    Learnings ←────── Eval Log
```

## Quick Start

```bash
cd agent && npm install
cp .env.example .env  # Add GEMINI_API_KEY, platform creds

# Intel (weekly)
npx tsx src/cli.ts intel <brand>

# Generate (daily)
npx tsx src/cli.ts explore <brand> "topic"

# Post
npx tsx src/cli.ts post <brand> --dry-run
npx tsx src/cli.ts post <brand> --all

# Help
npx tsx src/cli.ts --help
```

## Brand Scaffold

```bash
npx tsx src/cli.ts brand init <name>
```

## CLI

The CLI is the primary interface. See the design system in `docs/cli/overview.md`.

Examples:

```bash
# Default brand for a session
npx tsx src/cli.ts --brand <brand> explore "topic"

# JSON output
npx tsx src/cli.ts queue --json

# Via npm script
cd agent && npm run cli -- --help
```

## Architecture

```
agent/src/
├── core/       Foundation (brand, paths, types, http)
├── intel/      Intelligence (pipeline, enrich-apify, detect-outliers, hooks)
├── generate/   Content (copy, image, classify, providers/)
├── video/      Video pipeline (conform, providers/replicate)
├── eval/       Evaluation (grader, image-grader, learnings)
├── composite/  Poster generation (poster, templates)
├── publish/    Social APIs (twitter, linkedin, facebook, instagram, threads)
├── cli/        CLI system (flags, output, registry)
├── commands/   Command handlers (intel, explore, post, video, queue, brand)
└── queue/      Per-brand file-based queue

brands/<name>/
├── <name>-brand.yml   # Voice, visual, platforms
├── <name>-rubric.yml  # Eval dimensions (threshold, banned phrases)
├── queue.json         # Per-brand post queue
├── assets/            # logo.svg, fonts/
├── styles/            # Reference images for style transfer
├── intel/             # hooks.json, outliers.json, influencers.json
└── learnings.json     # Aggregated weak dimensions, avoid/prefer lists

output/
├── YYYY-MM-DD/        # Daily generation sessions
└── eval-log.jsonl     # All evaluation history
```

## Pipelines

### Intel (Weekly)

| Step | Action |
|------|--------|
| Enrich | Apify scrapes Instagram/Twitter metrics |
| Detect | Flag posts with views >= 50x median |
| Extract | Gemini analyzes why posts went viral |
| Store | Hook patterns indexed by category, multiplier |

### Generate

| Step | Action |
|------|--------|
| Classify | Detect content type (warm, product, thought) |
| Voice | Load brand rules + writing system |
| Hooks | Match topic to proven patterns |
| Style | Select reference images for visual consistency |
| Generate | Gemini creates copy + image |
| Grade | Score against rubric, retry if below threshold |
| Queue | Store in per-brand queue |

### Video (Experimental)

| Step | Action |
|------|--------|
| Brief | Load YAML brief with scenes, voice config |
| Images | Gemini generates 9:16 scene images |
| Animate | Kling (via Replicate) adds motion |
| Voice | Cartesia TTS generates narration |
| Conform | FFmpeg normalizes to 1080x1920 H.264 |
| Stitch | Combine scenes + audio into final video |

### Eval (Feedback Loop)

| Step | Action |
|------|--------|
| Grade | Score content on brand-specific dimensions |
| Log | Append to eval-log.jsonl |
| Learn | Aggregate weak dimensions, derive avoid/prefer |
| Inject | Learnings added to generation prompts |

### Post

| Step | Action |
|------|--------|
| Load | Get next item from brand queue |
| Adapt | Platform-specific text (char limits, hashtags) |
| Post | Direct API calls (OAuth) |
| Track | Record success/failure, post URLs |

## Platform Support

| Platform | Auth | Status |
|----------|------|--------|
| Twitter | OAuth 1.0a | Full |
| LinkedIn | OAuth 2.0 | Full |
| Facebook | Graph API | Full |
| Instagram | Graph API | Full |
| Threads | Meta API | Full |
| YouTube | Google OAuth | Stub |

## Environment

```bash
GEMINI_API_KEY         # Required - image generation
APIFY_API_TOKEN        # Intel scraping
REPLICATE_API_TOKEN    # Video animation (Kling)
CARTESIA_API_KEY       # TTS voice generation

# Per-brand, per-platform
TWITTER_<BRAND>_API_KEY
TWITTER_<BRAND>_API_SECRET
TWITTER_<BRAND>_ACCESS_TOKEN
TWITTER_<BRAND>_ACCESS_SECRET
LINKEDIN_<BRAND>_ACCESS_TOKEN
LINKEDIN_<BRAND>_ORG_ID
# See .env.example for full list
```

## Adding a Brand

```bash
npx tsx src/cli.ts brand init <name>
```

Then edit:
1. `brands/<name>/<name>-brand.yml` - voice, visual, platforms
2. `brands/<name>/<name>-rubric.yml` - eval dimensions
3. `brands/<name>/styles/` - reference images
4. `brands/<name>/assets/logo.svg`
5. Env vars: `TWITTER_<NAME>_API_KEY`, etc.

Template lives at `brands/_template/`.

## Strengths

- **Feedback loop**: Learnings from evals injected back into generation
- **Hook-driven**: Content based on viral patterns with multiplier scoring
- **Multi-platform**: One topic → 5 platforms with platform-specific copy
- **Style transfer**: Reference images → visual consistency
- **Brand as config**: YAML-based, version-controlled identity
- **Per-brand queues**: Isolated content streams prevent cross-posting

## Known Limitations

- No scheduling (manual trigger)
- File-based queue (no concurrent access)
- Token refresh manual (LinkedIn/Facebook ~60 days)
- No analytics feedback yet
- Video pipeline experimental

## License

MIT
