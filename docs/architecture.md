# Phantom Loom Architecture

## System Overview

```
                          PHANTOM LOOM
       Brand-driven social content pipeline with viral pattern learning

        ┌─────────┐        ┌─────────┐        ┌─────────┐
        │  INTEL  │──────▶ │   GEN   │──────▶ │  POST   │
        │ weekly  │        │  daily  │        │  daily  │
        └─────────┘        └─────────┘        └─────────┘
             │                   │                  │
             ▼                   ▼                  ▼
        hooks.json          queue.json         platform APIs
        outliers.json       + images
```

## CLI Primitives

The generation pipeline is decomposed into atomic, agent-consumable commands:

```
                    ┌──────────┐
                    │  EXPLORE │  (convenience wrapper)
                    └──────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │  IMAGE  │    │  COPY   │    │  GRADE  │
    │ (async) │    │ (async) │    │         │
    └─────────┘    └─────────┘    └─────────┘
         │               │               │
         └───────┬───────┘               │
                 ▼                        │
           ┌──────────┐                   │
           │  POSTER  │◀──────────────────┘
           └──────────┘
                 │
                 ▼
           ┌──────────┐
           │ ENQUEUE  │
           └──────────┘
                 │
                 ▼
           ┌──────────┐
           │   POST   │
           └──────────┘
```

Image and copy can run in parallel. Each returns structured JSON with `--json`.

## Core Modules

### core/paths.ts — Centralized Path Management
```typescript
getProjectRoot()      // Auto-detects project root
getBrandsDir()        // → {root}/brands
getOutputDir()        // → {root}/output
discoverBrands()      // Scans brands/*.yml
validateBrand(name)   // Throws if unknown
```

### core/paths.ts — Session Directory Management
`slugify()` and `createSessionDir()` are in `paths.ts` (inlined from former `session.ts`):
```typescript
slugify(text, maxLen?)        // → "caregiver-burnout"
createSessionDir(slug, suffix?) // → output/2026-02-18/caregiver-burnout-quick/
```

### core/visual.ts — Brand Visual System
```typescript
loadBrandVisual(name)    // Loads visual: from brand YAML, applies defaults, resolves paths
```

Single source of truth for all visual config. No build step.

`BrandVisual` includes: palette, typography (headline font + sizes), logo paths, allowed layouts, density, alignment, background mode, palette rotation count.

### core/brand.ts — Brand Configuration
```typescript
loadBrand(name?)         // Loads YAML, mtime-cached
detectFrameType(topic)   // announcement | tip | thought | event
buildVoiceContext(brand, frameType) // Full voice prompt
```

Cache invalidation: checks file mtime on each load, reloads if changed.

### cli/args.ts — Shared Argument Parser
```typescript
extractBrandTopic(args, knownFlags?)
// → { brand, topic, flags: Record<string,string>, booleans: Set<string> }
```

All commands use this instead of hand-rolling arg parsers.

### publish/rate-limit.ts — API Protection
```typescript
checkRateLimit(platform, brand)  // → { allowed, waitMs, remaining }
```

Platform limits:
- Twitter: 15 requests / 15 min
- LinkedIn: 100 / day
- Facebook: 200 / hour
- Instagram: 25 / day
- Threads: 250 / day

### json.ts — Safe JSON Parsing
```typescript
extractJson<T>(text, context?)      // Finds JSON in LLM response
validateJsonStructure(data, keys)   // Schema validation
```

## Intelligence Pipeline

```
Step 1: ENRICH (enrich-apify.ts)
  Load influencers.json → Apify scraper → Update stats

Step 2: DETECT (detect-outliers.ts)
  For posts where views >= 50x median → outliers.json

Step 3: EXTRACT (hook-bank.ts)
  For unanalyzed outliers → Gemini extracts hook → hooks.json
```

### Outlier Tiers
| Tier | Meaning |
|------|---------|
| 5x   | Mild outlier |
| 10x  | Notable |
| 50x  | Viral |
| 100x | Extremely viral |

### Hook Categories
- `curiosity` — "I tried X for 30 days..."
- `controversy` — Hot takes, counterintuitive claims
- `transformation` — Before/after, journey stories
- `secret` — "Nobody talks about this..."
- `listicle` — "5 things I wish I knew..."
- `story` — Narrative hooks
- `question` — Rhetorical questions
- `statistic` — Data-driven hooks

## Generation Pipeline

Decomposed into atomic commands. Each is independently callable.

### Copy Generation (`copy-cmd.ts`)
```
Topic → classify(topic) → contentType
     → loadRubric(brand) → threshold
     → getHookForTopic(brand, topic) → hookPattern
     → generateCopy(topic, brand, contentType, hookPattern)
     → grade(copy.linkedin.text, brand) → evalResult
     → retry if !passed (up to max_retries)
     → write copy.md + copy.json
```

### Image Generation (`image-cmd.ts`)
```
Topic + Brand → classify(topic) → imageType
            → buildPrompt(imageType, direction, brand)
              → SCTY: modular prompt_system (random preset rotation)
              → Generic: visual.image config (style, mood, prefer, avoid)
            → generateImage() via provider (Gemini/Reve)
            → [--knockout] knockoutBackground() via sharp threshold
            → [!--quick] upscaleImage() via Replicate
            → write selected.png
```

### Poster Generation (`poster-cmd.ts`)
```
Image + Headline + Brand → loadBrandVisual()
                        → generatePoster() per platform ratio
                          → buildStylePlan() from visual + variants
                          → computeLayout() → zones
                          → resolve logo path from planned background (`visual.logo.dark`/`visual.logo.light`)
                          → renderComposition() (4-layer canvas)
                        → write twitter.png, instagram.png, story.png
```

### Rendering Pipeline (`composite/renderer/`)
```
renderComposition()
  → loadBrandVisual() + registerFont()
  → buildStylePlan(visual, topic, hasImage)
  → computeLayout(layoutName, w, h, visual, topic)
  → BrandFrame (4-layer canvas):
    L1: GraphicLayer (bg fill, gradient strip)
    L2: ImageLayer (content image in zone)
    L3: Logo (brand mark, z-above image)
    L4: TypeLayer (headline text)
  → PNG buffer
```

## Social Posting

```
postToPlatform(platform, brand, text, imageUrl?)
  │
  ├─ Check rate limit → error if exceeded
  │
  └─ Route to platform handler:
     ├─ twitter-direct.ts   (OAuth 1.0a, media upload)
     ├─ linkedin-direct.ts  (OAuth 2.0, v2 API)
     ├─ facebook-direct.ts  (Graph API v21.0)
     ├─ meta-graph.ts       (Unified Instagram + Threads via Graph API)
     └─ youtube-direct.ts   (Data API v3, video only)
```

## Queue System

Per-brand at `brands/<brand>/queue.json`.

```typescript
interface QueueItem {
  id: string
  brand?: string
  source: { type: string; topic: string; brandName: string }
  stage: 'review' | 'publishing' | 'done' | 'failed'
  content: {
    topic: string
    twitter?: { text: string; hashtags: string[] }
    linkedin?: { text: string; hashtags: string[] }
    instagram?: { text: string; hashtags: string[] }
    threads?: { text: string; hashtags: string[] }
  }
  image?: { url: string; prompt: string; model: string }
  posts?: Array<{ platform: string; success: boolean; postUrl?: string; error?: string }>
}
```

Stages: `review` → `publishing` → `done` | `failed`

## Testing

```bash
cd agent
npx vitest run           # Run all tests
npx vitest --watch       # Watch mode
npx tsc --noEmit         # Typecheck
```
