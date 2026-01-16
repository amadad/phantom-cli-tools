# Viral Content Playbook

A data-driven system for identifying and replicating viral content patterns.

**Source:** @casualhyped's viral methodology, adapted for brand-safe execution.

---

## Core Concept

Instead of guessing what will perform, **systematically scrape, detect, and reverse-engineer** content that has already proven to go viral.

```
Scrape → Detect Outliers → Extract Hooks → Amplify → Deploy
```

---

## The Pipeline

### 1. Build Your Watchlist

Create a spreadsheet of 100+ accounts in your niche (or adjacent niches with transferable formats):

| Column | Purpose |
|--------|---------|
| Handle | @username |
| Platform | instagram, tiktok, youtube, twitter |
| Niche | caregiving, AI, health tech |
| Format | talking head, carousel, text overlay |
| Avg Views | Baseline for outlier detection |
| Notes | Why this account is worth watching |

**Key insight:** Don't just watch competitors. Watch adjacent niches with formats that could work in yours.

---

### 2. Scrape Continuously

Set up automated scraping to capture post-level data:

- **Frequency:** Every 2 minutes (via AWS Lambda or cron)
- **Freshness:** Only content < 3 days old
- **Data captured:**
  - Views, likes, comments, shares
  - Caption/hook text
  - Media type
  - Posted timestamp

**Tools:**
- RapidAPI → "Instagram API" or "TikTok API"
- Apify actors (instagram-profile-scraper, tiktok-scraper)
- Custom scrapers via Puppeteer/Playwright

---

### 3. Detect Outliers

Not all viral content is equal. Use multipliers to tier outliers:

```
outlier_tier = max(
  k for k in [5, 10, 50, 100]
  if video_views >= k * median_account_views
)
```

| Tier | Meaning | Priority |
|------|---------|----------|
| 100x | Mega-viral, breakout | Highest |
| 50x | Strong viral | High |
| 10x | Above average | Medium |
| 5x | Slight overperform | Low |

**Storage:** Tag outliers with `multiplied: 100` (or 50, 10, 5) in your database.

---

### 4. Extract Patterns (50x+ only)

For high-multiplier content, manually or via AI extract:

| Element | What to capture |
|---------|-----------------|
| **Hook** | First 1-3 seconds / first line |
| **Retention** | What keeps people watching/reading |
| **CTA** | Call to action (if any) |
| **Format** | Talking head, carousel, duet, etc. |
| **Emotion** | Curiosity, controversy, transformation |

---

### 5. Amplify Hooks

The key insight: **Make hooks 10x more extreme.**

| Original | Amplified |
|----------|-----------|
| "3 tips for caregivers" | "The ONE thing that saved my sanity as a caregiver" |
| "How I use AI" | "The AI workflow that replaced my entire team" |
| "Dementia care guide" | "What NOBODY tells you about dementia (until it's too late)" |

Hook patterns that work:
- **Curiosity gap:** "The reason nobody talks about..."
- **Controversy:** "This is going to upset people, but..."
- **Transformation:** "How I went from X to Y in Z days"
- **Secret:** "The hack that [authority figures] don't want you to know"
- **Listicle with twist:** "5 things, but #3 will shock you"

---

### 6. Deploy at Scale

Test 20-30 variations across accounts:

1. Same hook, different formats
2. Same format, different hooks
3. A/B test posting times
4. Track which combinations hit

**Important:** This is data-driven creativity, not spam. Quality still matters.

---

## Implementation in Phantom Loom

This playbook is implemented via the intelligence pipeline:

| Module | Function |
|--------|----------|
| `enrich-apify.ts --include-posts` | Scrape post-level data |
| `detect-outliers.ts` | Identify 5x/10x/50x/100x content |
| `extract-hooks.ts` | Gemini extracts hooks from outliers |
| `hook-bank.ts` | Store proven patterns by category |
| `generate.ts` | Inject hooks into content generation |

### Commands

```bash
cd agent

# View current influencer landscape
npx tsx src/intelligence/view-landscape.ts <brand>

# Enrich with post-level data (for outlier detection)
npx tsx src/intelligence/enrich-apify.ts <brand> --include-posts

# Detect outliers
npx tsx src/intelligence/detect-outliers.ts <brand>

# Extract hooks from 50x+ content
npx tsx src/intelligence/extract-hooks.ts <brand> --min-multiplier=50

# View hook bank
npx tsx src/intelligence/hook-bank.ts <brand> --list
```

---

## Ethical Considerations

This system is for **learning patterns**, not copying content:

✅ Study why hooks work, create original versions
✅ Adapt formats to your brand voice
✅ Use as inspiration, not templates
✅ Credit sources when appropriate

❌ Copy-paste hooks verbatim
❌ Steal visual formats exactly
❌ Ignore brand guidelines for virality
❌ Sacrifice quality for quantity

---

## Key Metrics

Track what matters:

| Metric | Why |
|--------|-----|
| Outlier detection rate | How often your content hits 5x+ |
| Hook-to-engagement correlation | Which hook categories perform |
| Time-to-viral | How quickly posts hit thresholds |
| Replication success rate | % of adapted hooks that work |

---

## References

- Original methodology: @casualhyped
- Implementation: Phantom Loom `agent/src/intelligence/`
- Hook patterns: `data/hooks/[brand]-hooks.json`
