---
name: content-pipeline
description: Brand content pipeline for phantom-loom - intel, generate, eval, post
triggers:
  - generate post
  - create content for
  - post to
  - intel for
  - hooks for
  - grade this
  - explore topic
  - video brief
  - queue status
---

# Content Pipeline Skill

Brand content automation: **intel → generate → eval → post**

## Commands

All commands run from `agent/` directory:

```bash
cd agent
```

### Intel (Weekly)
Scrape influencers → detect outliers (50x+ median) → extract hooks

```bash
npx tsx src/cli.ts intel <brand>
```

Output: `brands/<brand>/intel/hooks.json`, `outliers.json`

### Explore/Generate
Generate copy + image for a topic → grade → add to queue

```bash
npx tsx src/cli.ts explore <brand> "topic"
```

Options:
- `--style=<style>` - Use specific style reference
- `--no-logo` - Skip logo on images

Output: `output/YYYY-MM-DD/<topic>/` with copy.md, selected.png, platform finals

### Grade
Score content against brand rubric

```bash
npx tsx src/cli.ts grade <brand> "text to evaluate"
```

Returns score 0-100 with dimension breakdown. Threshold: 70+

### Learn
Aggregate learnings from eval-log into brand config

```bash
npx tsx src/cli.ts learn <brand>
```

Updates: `brands/<brand>/learnings.json`

### Post
Publish next queue item to platforms

```bash
npx tsx src/cli.ts post <brand>
npx tsx src/cli.ts post <brand> --all              # All platforms
npx tsx src/cli.ts post <brand> --platforms=twitter,linkedin
npx tsx src/cli.ts post <brand> --id=<queue-id>   # Specific item
npx tsx src/cli.ts post <brand> --dry-run         # Preview only
```

### Queue
View queue status

```bash
npx tsx src/cli.ts queue
```

Queues are per-brand at `brands/<brand>/queue.json`

### Video
Generate video from brief (Kling animation + Cartesia TTS)

```bash
npx tsx src/cli.ts video <brand> "topic"
```

Or run from brief file:
```bash
npx tsx run-pipeline-v5.ts
```

Output: `output/<brief-name>/` with scene clips and final.mp4

## Data Flow

```
Intel:    Influencers → Apify → Outliers (50x+) → Hooks
Generate: Topic → Classify → Voice + Hooks + Learnings → Gemini → Queue
Eval:     Content → Grade → Log → Aggregate → Inject into prompts
Post:     Queue → Rate limit → Platform API → Done/Failed
```

## Environment Variables

Required:
- `GEMINI_API_KEY` - Image generation
- `APIFY_API_TOKEN` - Intel scraping
- `REPLICATE_API_TOKEN` - Video animation (Kling)
- `CARTESIA_API_KEY` - TTS voice generation

Per-brand credentials:
- `TWITTER_<BRAND>_API_KEY`, `TWITTER_<BRAND>_ACCESS_TOKEN`
- `LINKEDIN_<BRAND>_ACCESS_TOKEN`, `LINKEDIN_<BRAND>_ORG_ID`
- `INSTAGRAM_<BRAND>_ACCESS_TOKEN`, `INSTAGRAM_<BRAND>_USER_ID`
- `THREADS_<BRAND>_ACCESS_TOKEN`, `THREADS_<BRAND>_USER_ID`
- `FACEBOOK_<BRAND>_ACCESS_TOKEN`, `FACEBOOK_<BRAND>_PAGE_ID`

## Common Workflows

### Generate and post
```bash
npx tsx src/cli.ts explore <brand> "topic"
# Review output, then:
npx tsx src/cli.ts post <brand> --all
```

### Weekly intel refresh
```bash
npx tsx src/cli.ts intel <brand>
```

### Manual posting with custom content
If you've manually edited copy/images in a session directory:
1. Update `brands/<brand>/queue.json` with the new content
2. Or post directly using the platform functions

### Video production
1. Create/edit brief at `agent/src/video/briefs/<name>.yml`
2. Generate images: `npx tsx test-all-images.ts`
3. Review images, iterate prompts
4. Run full pipeline: `npx tsx run-pipeline-v5.ts`
5. Add subtitles in CapCut

## Image Style Guidelines

Use reference images in `brands/<brand>/styles/` and keep brand-specific visual rules in `<brand>-brand.yml`.

## Troubleshooting

**Twitter 403 error**: URL in tweet may be flagged. Try without URL or use "link in bio".

**Instagram needs public URL**: Images must be uploaded to R2 first. The post flow handles this automatically.

**Wrong content posted**: Queues are now per-brand. Always specify brand: `post <brand>` not just `post`.

**Image style inconsistent**: Use the reference images in `brands/<brand>/styles/` and enforce in prompts.
