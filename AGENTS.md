# Agent Instructions

Instructions for Codex agents working on phantom-loom.

## Quick Reference

```bash
cd agent
npx tsx src/cli.ts intel <brand>                # scrape → outliers → hooks
npx tsx src/cli.ts explore <brand> "topic"      # copy + image → queue
npx tsx src/cli.ts grade <brand> "text"         # score against rubric
npx tsx src/cli.ts learn <brand>                # aggregate learnings
npx tsx src/cli.ts post <brand> --dry-run       # preview post
npx tsx src/cli.ts post <brand> --all           # post to all platforms
npx tsx src/cli.ts queue list [brand]           # view queue items
npx tsx src/cli.ts queue show <id> [brand]      # inspect queue item
npx tsx src/cli.ts video <brand> <brief>        # generate video
npx tsx src/cli.ts brand init <name>            # scaffold a new brand
```

## Architecture

| Stage | Purpose |
|-------|---------|
| core | brand, paths, types, http |
| intel | pipeline, hooks, outliers |
| generate | copy, image, classify, providers |
| video | video pipeline, conform |
| eval | grader, learnings |
| composite | poster, templates |
| publish | platform APIs |

## Key Patterns

### Per-Brand Queues
Queues are stored at `brands/<brand>/queue.json`. Always specify brand:
```bash
npx tsx src/cli.ts post <brand>  # NOT just "post"
```

### Brand Discovery
Brands are discovered dynamically from `brands/` directory:
```typescript
import { discoverBrands } from './core/paths'
const brands = discoverBrands()  // ['brand-a', 'brand-b']
```

### Image Providers
Primary: Gemini (`generate/providers/gemini.ts`)
Fallback: Reve (`generate/providers/reve.ts`)

### Video Pipeline
```
Brief (YAML) → Scene images → Kling animation → TTS → Conform → Stitch
```
Briefs at: `agent/src/video/briefs/`

## Session End

```bash
cd agent && npx tsc --noEmit  # typecheck
git add <files> && git commit -m "feat: description"
```

## Guardrails

- Queues are per-brand: never mix content between brands
- Always run typecheck before committing
- Use `trash` not `rm` for deletions
- Check `git status` before edits to confirm repo state
- Files should be <500 LOC; split if larger

## Common Issues

| Issue | Fix |
|-------|-----|
| Twitter 403 | Remove URL from tweet; spam filter |
| Instagram fail | Needs public URL; use R2 upload |
| Wrong queue item | Specify brand explicitly |
| Type errors | Check QueueItem.brand field exists |
