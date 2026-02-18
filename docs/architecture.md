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

### core/session.ts — Session Directory Management
```typescript
slugify(text, maxLen?)        // → "caregiver-burnout"
createSessionDir(slug, suffix?) // → output/2026-02-18/caregiver-burnout-quick/
```

### core/brand.ts — Brand Configuration
```typescript
loadBrand(name?)         // Loads YAML, mtime-cached
resolvePalette(brand)    // visual.palette vs style.colors fallback
getPromptOverride(brand) // visual.prompt_override vs style.prompt_override
buildBrandContext(brand)  // Short context string for AI prompts
detectFrameType(topic)   // announcement | tip | thought | event
buildVoiceContext(brand, frameType) // Full voice prompt
```

Cache invalidation: checks file mtime on each load, reloads if changed.

### cli/args.ts — Shared Argument Parser
```typescript
parseArgs(args, knownFlags?)
// → { brand, topic, flags: Record<string,string>, booleans: Set<string> }
```

All commands use this instead of hand-rolling arg parsers.

### rate-limit.ts — API Protection
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
Topic + Brand → loadBrand() → resolvePalette()
            → loadReferences(brand) → style refs
            → [force|quick|full] mode selection
            → generateVariation() via Gemini
            → upscaleImage() via Replicate
            → write selected.png
```

### Poster Generation (`poster-cmd.ts`)
```
Image + Headline + Brand → loadBrand()
                        → resolveLogoPath()
                        → resolvePosterStyle()
                        → generatePoster() per platform
                        → write twitter.png, instagram.png, story.png
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
     ├─ instagram-direct.ts (Graph API, requires public URL)
     ├─ threads-direct.ts   (Graph API)
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
