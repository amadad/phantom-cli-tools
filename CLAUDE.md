# Phantom Loom CLI

Brand content pipeline: **intel → generate → eval → post**

## Commands

CLI design system docs: `docs/cli/overview.md`

```bash
cd agent
npx tsx src/cli.ts intel <brand>                # Weekly: scrape → outliers → hooks
npx tsx src/cli.ts explore <brand> "topic"      # Generate: copy + image → queue
npx tsx src/cli.ts grade <brand> "text"         # Eval: score against rubric
npx tsx src/cli.ts learn <brand>                # Aggregate learnings from eval-log
npx tsx src/cli.ts post <brand> [--dry-run]     # Publish queue items
npx tsx src/cli.ts post <brand> --all           # Post to all platforms
npx tsx src/cli.ts queue list [brand]           # View queue items
npx tsx src/cli.ts queue show <id> [brand]      # Show a queue item
npx tsx src/cli.ts video <brand> <brief>        # Generate short-form video
npx tsx src/cli.ts brand init <name>            # Scaffold a new brand
```

## Structure

```
agent/src/
├── core/       brand, paths, types, json, http
├── intel/      pipeline, enrich-apify, detect-outliers, extract-hooks
├── generate/   copy, image, classify, providers/ (gemini, reve)
├── video/      video pipeline, conform, providers/ (replicate/kling)
├── eval/       grader, image-grader, learnings
├── composite/  poster, templates
├── publish/    social, twitter/linkedin/facebook/instagram/threads
├── cli/        flags, output, registry
├── commands/   intel, explore, post, video, queue, brand
└── queue/      per-brand file-based queue

brands/<name>/
├── <name>-brand.yml   # Voice, visual, platforms
├── <name>-rubric.yml  # Eval dimensions + threshold
├── queue.json         # Per-brand post queue
├── assets/            # logo.svg, fonts/
├── styles/            # Reference images for style transfer
├── intel/             # hooks.json, outliers.json, influencers.json
└── learnings.json     # Aggregated feedback loop

output/
├── YYYY-MM-DD/        # Daily sessions
└── eval-log.jsonl     # All evaluations
```

## Data Flow

| Stage | Flow |
|-------|------|
| Intel | Influencers → Apify → Outliers (50x+ median) → Hooks |
| Generate | Topic → Classify → Voice + Hooks + Learnings → Gemini → Queue |
| Eval | Content → Grade → Log → Aggregate → Inject into prompts |
| Post | Queue → Rate limit → Platform API → Done/Failed |
| Video | Brief → Images → Kling animation → TTS → Conform → Stitch |

## Env

```bash
GEMINI_API_KEY         # Required - image generation
APIFY_API_TOKEN        # Intel scraping
REPLICATE_API_TOKEN    # Video animation (Kling)
CARTESIA_API_KEY       # TTS voice generation

# Per-brand platform creds: TWITTER_<BRAND>_*, LINKEDIN_<BRAND>_*, etc.
```

## Adding Brand

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

## Troubleshooting

- **Twitter 403**: URL in tweet may be flagged. Try without URL or use "link in bio"
- **Instagram needs public URL**: Images uploaded to R2 automatically
- **Wrong content posted**: Queues are per-brand. Always specify brand: `post <brand>`
