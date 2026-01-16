# Phantom Loom Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                           PHANTOM LOOM                               │
│                                                                      │
│  Brand-driven social content pipeline with viral pattern learning   │
└──────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
   ┌─────────┐              ┌─────────┐              ┌─────────┐
   │  INTEL  │              │   GEN   │              │  POST   │
   │ weekly  │───────────▶  │  daily  │───────────▶  │  daily  │
   └─────────┘              └─────────┘              └─────────┘
        │                         │                         │
        ▼                         ▼                         ▼
   brands/<brand>/intel/hooks.json  brands/<brand>/queue.json  platform APIs
   outliers.json           + images
```

## Core Modules

### paths.ts - Centralized Path Management
```typescript
getProjectRoot()      // Auto-detects project root
getBrandsDir()        // → {root}/brands
getOutputDir()        // → {root}/output
discoverBrands()      // Scans brands/*.yml
validateBrand(name)   // Throws if unknown
```

### brand.ts - Brand Configuration
```typescript
loadBrand(name?)      // Loads YAML, mtime-cached
detectFrame(topic)    // announcement | tip | thought | event
selectReferenceStyle(topic, styles)  // Mood keyword matching
buildImagePrompt(topic, style, brand)
```

Cache invalidation: checks file mtime on each load, reloads if changed.

### rate-limit.ts - API Protection
```typescript
checkRateLimit(platform, brand)  // → { allowed, waitMs, remaining }
canMakeRequest(platform, brand)  // → boolean
getRateLimitStatus(platform, brand)
```

Platform limits:
- Twitter: 15 requests / 15 min
- LinkedIn: 100 / day
- Facebook: 200 / hour
- Instagram: 25 / day
- Threads: 250 / day

### http.ts - Shared HTTP Utilities
```typescript
validateUrl(url)      // SSRF protection, blocks internal IPs
downloadImage(url)    // → { data: Buffer, mimeType: string }
fetchJson<T>(url)     // With timeout
```

### json.ts - Safe JSON Parsing
```typescript
safeJsonParse<T>(str, context?)     // → { success, data } | { success, error }
extractJson<T>(text, context?)      // Finds JSON in LLM response
validateJsonStructure(data, keys)   // Schema validation
```

## Intelligence Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    pipeline.ts --fail-fast                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: ENRICH (enrich-apify.ts)                              │
│  ─────────────────────────────────                             │
│  Load influencers.json                                         │
│  → Apify instagram-profile-scraper                             │
│  → Update followers, recentPosts, medianViews                  │
│                                                                 │
│  Step 2: DETECT (detect-outliers.ts)                           │
│  ─────────────────────────────────────                         │
│  For each post where views >= 50x median:                      │
│  → Add to outliers.json with multiplier tier                   │
│                                                                 │
│  Step 3: EXTRACT (hook-bank.ts)                                │
│  ─────────────────────────────────                             │
│  For unanalyzed outliers:                                      │
│  → Gemini extracts hook pattern                                │
│  → Store in hooks.json with category + themes                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Outlier Tiers
| Tier | Meaning |
|------|---------|
| 5x   | Mild outlier |
| 10x  | Notable |
| 50x  | Viral |
| 100x | Extremely viral |

### Hook Categories
- `curiosity` - "I tried X for 30 days..."
- `controversy` - Hot takes, counterintuitive claims
- `transformation` - Before/after, journey stories
- `secret` - "Nobody talks about this..."
- `listicle` - "5 things I wish I knew..."
- `story` - Narrative hooks
- `question` - Rhetorical questions
- `statistic` - Data-driven hooks

## Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                      generate.ts                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Load brand config                                          │
│     └─ brands/{name}.yml                                       │
│                                                                 │
│  2. Detect frame from topic                                    │
│     └─ "release" → announcement                                │
│     └─ "tip" → practical_tip                                   │
│     └─ default → thought (uses writing system)                 │
│                                                                 │
│  3. Find relevant hook                                         │
│     └─ Match by theme, prefer high multiplier                  │
│     └─ Fallback: least-used high-multiplier hook               │
│                                                                 │
│  4. Build prompt with:                                         │
│     └─ Voice rules, product rules                              │
│     └─ Writing system (engines, structures)                    │
│     └─ Avoid phrases, guardrails                               │
│     └─ Platform constraints (char limits, hashtags)            │
│                                                                 │
│  5. Generate copy via Gemini                                   │
│     └─ Returns per-platform text + image description           │
│                                                                 │
│  6. Select reference style                                     │
│     └─ Match mood keywords from topic                          │
│     └─ e.g., "burnout" → organic_cellular style                │
│                                                                 │
│  7. Generate image                                             │
│     └─ gemini-3-pro-image-preview with reference images        │
│     └─ Fallback: gemini-2.5-flash-image                        │
│                                                                 │
│  8. Add to queue                                               │
│     └─ stage: "review"                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Social Posting

```
┌─────────────────────────────────────────────────────────────────┐
│                    social/index.ts                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  postToPlatform(platform, brand, text, imageUrl?)              │
│  │                                                             │
│  ├─ Check rate limit                                           │
│  │  └─ Return error if exceeded                                │
│  │                                                             │
│  └─ Route to platform handler:                                 │
│     ├─ twitter-direct.ts   (OAuth 1.0a, media upload)          │
│     ├─ linkedin-direct.ts  (OAuth 2.0, v2 API)                 │
│     ├─ facebook-direct.ts  (Graph API v21.0)                   │
│     ├─ instagram-direct.ts (Graph API, requires public URL)    │
│     ├─ threads-direct.ts   (Graph API)                         │
│     └─ youtube-direct.ts   (Data API v3, video only)           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Queue System

Queues are stored per-brand at `brands/<brand>/queue.json`.

```typescript
interface QueueItem {
  id: string
  brand?: string
  source: { type: string; topic: string; brandName: string }
  stage: 'review' | 'publishing' | 'done' | 'failed'
  createdAt: string
  updatedAt: string
  content: {
    topic: string
    twitter?: { text: string; hashtags: string[] }
    linkedin?: { text: string; hashtags: string[] }
    instagram?: { text: string; hashtags: string[] }
    threads?: { text: string; hashtags: string[] }
    youtube?: { title: string; description: string; tags: string[] }
  }
  image?: { url: string; prompt: string; model: string }
  video?: { url: string; duration: number; aspectRatio: '9:16' }
  posts?: Array<{ platform: string; success: boolean; postUrl?: string; error?: string }>
}
```

Stages:
1. `review` - Generated, awaiting approval/posting
2. `publishing` - Currently being posted
3. `done` - Successfully posted to all platforms
4. `failed` - One or more platforms failed

## Brand Configuration

```yaml
# brands/<brand>/<brand>-brand.yml

name: "<Brand>"
url: "https://example.com"

voice:
  tone: "Warm, direct, honest"
  rules:
    - "Acknowledge the hard thing first"
    - "NO empty affirmations"
  writing_system:
    engines:
      diagnostic: "symptoms → structure → stop"
      accretion: "stack observations, no thesis"
    structures:
      - name: "observation_x3"
        pattern: "Observation → Observation → Observation → stop"
  frames:
    announcement:
      structure: "Opening + features + CTA"
    practical_tip:
      structure: "Name hard thing + one concrete action"

visual:
  palette:
    primary: "#1E1B16"
    accent: "#5046E5"
  reference_styles:
    - name: "organic_cellular"
      mood_keywords: ["burnout", "exhaustion", "renewal"]
      images: ["https://..."]

platforms:
  twitter:
    max_chars: 280
    hashtags: 3

guardrails:
  never:
    phrases: ["You're allowed to", "Give yourself grace"]
```

## Testing

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

Test files:
- `src/core/json.test.ts` - JSON parsing utilities
- `src/core/rate-limit.test.ts` - Rate limiter
- `src/core/http.test.ts` - URL validation, SSRF protection

## Error Handling

### Pipeline (--fail-fast)
```bash
# Default: collect errors, continue pipeline
npx tsx src/cli.ts intel <brand>

# Fail on first error
npx tsx src/cli.ts intel <brand> --fail-fast
```

### Safe JSON Parsing
```typescript
const result = extractJson<ContentResult>(llmResponse, 'content generation')
if (!result.success) {
  throw new Error(result.error)  // Includes context + preview
}
```

### Rate Limiting
```typescript
const check = checkRateLimit('twitter', '<brand>')
if (!check.allowed) {
  return { error: `Rate limited. Wait ${check.waitMs}ms` }
}
```
