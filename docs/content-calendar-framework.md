# Content Calendar Framework

Autonomous daily posting: hooks + themes + brand voice.

## System Overview

```
brand.yml      →  voice, visual, guardrails (constant)
calendar.yml   →  monthly themes (constant)
hooks.json     →  viral hooks (refreshed weekly by intel)
queue.json     →  posts ready to publish (seeded + generated)
                       ↓
                 daily post
```

## Files

| File | Purpose | Changes |
|------|---------|---------|
| `brands/<brand>.yml` | Brand identity | Rarely |
| `brands/<brand>/calendar.yml` | Monthly themes | Yearly |
| `output/intel/hooks.json` | Viral hooks from intel | Weekly |
| `output/queue/queue.json` | Posts to publish | Daily |

## Daily Flow (Autonomous)

```
1. Post from queue (if any)
2. Generate new post: hook + theme + brand voice
3. Add to queue
4. Repeat tomorrow
```

No human decision needed. System runs daily.

## Weekly Flow

```
Intel runs:
  1. Scan influencers for viral content
  2. Detect outliers (10x+ engagement)
  3. Extract hooks from outliers
  4. Save to hooks.json
```

Hooks are the fuel for daily generation.

## Queue

Simple JSON file: `output/queue/queue.json`

```json
[
  {
    "id": "2025-01-02-abc",
    "stage": "review",
    "source": { "type": "seeded", "topic": "Shipped assessment v2" },
    "content": {
      "topic": "Shipped assessment v2",
      "twitter": { "text": "...", "hashtags": [...] },
      "linkedin": { "text": "...", "hashtags": [...] }
    },
    "image": { "url": "...", "prompt": "..." }
  }
]
```

### Two sources:

| Source | Who adds | When |
|--------|----------|------|
| **Seeded** | You | Product announcements, founder thoughts |
| **Generated** | System | Daily, from hooks + theme |

### Stages:

| Stage | Meaning |
|-------|---------|
| `review` | Ready to post (default) |
| `done` | Posted successfully |
| `failed` | Post failed |

## Seeding Content

Add product or founder posts manually:

```bash
# Generate and add to queue
npx tsx src/cli.ts gen givecare "Shipped assessment v2"

# Or directly edit queue.json
```

Seeded posts get posted before generated ones (FIFO).

## Calendar

`brands/givecare/calendar.yml`:

```yaml
brand: givecare
frequency: daily
platforms: [instagram, threads, linkedin]

themes:
  february: "structural gaps"
  may: "caregiver mental health"
  june: "male caregivers"
  september: "alzheimer's caregiving"
  november: "invisible labor"
  december: "care as rights"
```

That's it. Monthly themes, applied to all posts that month.

## CLI Commands

```bash
# Intel (weekly)
npx tsx src/cli.ts intel givecare

# Generate (daily, or manual seed)
npx tsx src/cli.ts gen givecare "topic"

# Post (daily)
npx tsx src/cli.ts post givecare

# View queue
npx tsx src/cli.ts queue
```

## Automation (Phase II)

GitHub Actions for scheduled runs:

```yaml
# Weekly intel (Monday 6am)
- cron: '0 6 * * 1'
  run: npx tsx src/cli.ts intel givecare

# Daily generate + post (9am)
- cron: '0 9 * * *'
  run: |
    npx tsx src/cli.ts gen givecare --from-hooks
    npx tsx src/cli.ts post givecare
```

For now: manual CLI execution.
