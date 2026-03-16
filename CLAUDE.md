# Phantom Loom CLI

Brand content pipeline: **generate → poster → enqueue → post**

## CLI Contract Baseline

- CLI is the primary automation surface; every command should stay composable.
- Global contract:
  - `--brand <name>` defaults brand for brand-aware commands.
  - `--json` emits structured output for machine consumers.
  - `--quiet` suppresses non-error output.
  - `--help` renders usage.
- Shared parser contract:
- `extractBrandTopic(args, valueFlags, booleanFlags)` in `agent/src/cli/args.ts`.
- Unknown flags are treated as value flags when followed by a token, unless explicitly marked boolean.
- This is the expected behavior for `--volume`, `--pro`, `--quick`, and `--no-logo` style flag sets.
## Commands

CLI design system docs: `docs/cli/overview.md`

```bash
cd agent
# Atomic primitives (agent-composable, each returns JSON with --json)
npx tsx src/cli.ts copy <brand> "topic"         # Generate platform copy + eval
npx tsx src/cli.ts image <brand> "topic"        # Generate brand image (--knockout for transparent)
npx tsx src/cli.ts poster <brand> --image <path> --headline "text"  # Platform posters
npx tsx src/cli.ts enqueue <brand> --topic "t" --copy <p> --image <p>  # Add to queue

# Convenience wrapper (chains the primitives)
npx tsx src/cli.ts explore <brand> "topic"      # copy + image + poster + enqueue + notify

# Queue & publish
npx tsx src/cli.ts post <brand> [--dry-run]     # Publish queue items
npx tsx src/cli.ts post <brand> --all           # Post to all platforms
npx tsx src/cli.ts queue list [brand]           # View queue items
npx tsx src/cli.ts queue show <id> [brand]      # Show a queue item

# Tokens
npx tsx src/cli.ts token check [brand]          # Check all token statuses
npx tsx src/cli.ts token refresh [brand]        # Refresh expiring tokens
npx tsx src/cli.ts token refresh --all [brand]  # Force refresh all tokens

# Nano poster (single-shot Gemini generation + pixel sort post-processing)
npx tsx src/cli.ts explore <brand> "topic" --nano --pixel-sort
npx tsx src/cli.ts poster <brand> --headline "text" --nano --pixel-sort --eyebrow "FIELD NOTES"

# Review
npx tsx src/cli.ts review latest                # Open visual gallery for latest session
npx tsx src/cli.ts review ./output/dir/         # Open gallery for specific directory

# Texture (p5.brush via Pinch Tab — no API cost)
npx tsx src/cli.ts texture <brand> --style=editorial    # Watercolor wash + accent lines
npx tsx src/cli.ts texture <brand> --style=expressive   # Bold arcs + crossing strokes
npx tsx src/cli.ts texture <brand> --style=architectural # Hatching + crop marks
npx tsx src/cli.ts texture <brand> --style=gestural     # Flowing strokes toward text
npx tsx src/cli.ts texture <brand> --style=layered      # All techniques combined
npx tsx src/cli.ts texture --list                       # List available styles

# Pixel sort (standalone)
npx tsx src/cli.ts pixel-sort <input> [output]  # Apply glitch effect

# Other
npx tsx src/cli.ts brand init <name>            # Scaffold a new brand
```

## Agent Workflow

Each primitive returns structured JSON with `--json`. Agent orchestrates:

```bash
# Copy first (gives imageDirection), then image in parallel or sequential
phantom copy givecare "topic" --json        # → { headline, twitter, linkedin, ... }
phantom image givecare "topic" --quick --json # → { imagePath, style, model }
# --knockout for transparent PNG (bg removed via sharp threshold)

# Sequential steps
phantom poster givecare --image ... --headline ... --json  # → { outputs }
phantom enqueue givecare --topic ... --copy copy.json --image ... --json  # → { queueId }
phantom post givecare --id gen_... --json    # → { posted, failed }
```

Failure is isolated — if image gen fails, copy is preserved. Each step writes to disk for checkpointing.

### Texture + Poster (no API cost)

```bash
# Two-step: texture → poster (text-zone-aware p5.brush marks)
phantom texture givecare --style=editorial --out=bg.png
phantom poster givecare --image bg.png --headline "Text" --layout overlay

# One-shot: explore with texture (skips Gemini image, auto-overlay layout)
phantom explore givecare "topic" --texture=editorial
phantom explore givecare "topic" --texture=architectural --layout overlay
```

Textures render via Pinch Tab (headless Chrome + p5.brush). ~5s per render, zero API cost. Text zone coordinates from the layout system are passed to the sketch so marks interact with headline placement.

## Structure

```
agent/src/
├── core/       brand, visual, paths, types, json, http, slop, r2
├── generate/   copy, image, classify, upscale, pixel-sort, providers/
├── composite/  poster, nano-poster, layouts, renderer/ (canvas compositor)
├── publish/    social, meta-graph, twitter/linkedin/facebook/youtube, rate-limit, token-refresh
├── cli/        args, index, registry, types, errors
├── commands/   explore, copy-cmd, image-cmd, poster-cmd, enqueue-cmd, post, queue, brand, token, review, pixel-sort-cmd, texture-cmd, gradient-cmd
├── textures/   p5.brush sketch template + vendored JS (rendered via Pinch Tab)
└── queue/      per-brand file-based queue

brands/<name>/
├── <name>-brand.yml   # Voice, visual, platforms
├── <name>-rubric.yml  # Eval dimensions + threshold
├── queue.json         # Per-brand post queue
├── assets/            # logo.svg, fonts/
└── styles/            # Style reference images (visual direction)

output/
├── YYYY-MM-DD/        # Daily sessions
│   └── topic-slug/
│       ├── selected.png   # Generated image (transparent if --knockout)
│       ├── copy.md        # Human-readable copy
│       ├── copy.json      # Machine-readable copy (for enqueue)
│       ├── twitter.png    # Platform poster
│       ├── instagram.png
│       └── story.png
└── ...
```

## Data Flow

| Stage | Flow |
|-------|------|
| Copy | Topic → Classify → Voice → Gemini → Eval → Retry |
| Image | Topic → Classify → Brand prompt (visual.image / prompt_system) → Gemini → [Knockout] |
| Texture | Brand palette + text zone coords → p5.brush sketch → Pinch Tab render → PNG |
| Poster | Image + Headline → Named layout (or `--layout` override) → Platform-specific ratios |
| Nano Poster | Topic + Headline + Pillar → Gemini single-shot → Pixel sort + grain → Output |
| Enqueue | Copy.json + Image → Queue item (stage: review) |
| Post | Queue → Rate limit → Platform API → Done/Failed |

## Shared Internals

Commands share logic via exported functions, not abstraction layers:

```typescript
import { generateBrandImage } from './commands/image-cmd'    // Self-contained: takes brand name
import { generateAndGradeCopy } from './commands/copy-cmd'   // Copy + eval retry loop
import { generateFinals } from './commands/poster-cmd'       // Self-contained: takes brand name
import { extractBrandTopic } from './cli/args'               // Shared arg parser
import { createSessionDir, slugify } from './core/paths'     // Session dir helper
import { loadBrandVisual } from './core/visual'               // BrandVisual config loader
import { resolveVolumeContext } from './core/visual'          // Volume zone resolver → VolumeContext | null
import { listDesignProfiles } from './core/visual'            // Visual profile enumeration
import { buildVoiceContext } from './core/brand'             // Copy writing context
import { checkTokens, refreshTokens, preflightTokenCheck } from './publish/token-refresh'
import { generateNanoPoster } from './composite/nano-poster'  // Single-shot Gemini poster
import { pixelSort, GIVECARE_FULL } from './generate/pixel-sort' // Pixel sort post-processing
import { computeLayout, buildStylePlan } from './composite/layouts' // Layout system (text zones, style plans)
```

## Visual System

Single source of truth: `visual:` section in brand YAML. No build step, no tokens pipeline.

```typescript
import { loadBrandVisual } from './core/visual'
const v = loadBrandVisual('givecare')
// → { palette, typography, logo, layouts, density, alignment, background, paletteRotation, variants }
```

### Named Layouts
Brand YAML drives a deterministic style plan:
- `layouts` and `variants.layoutWeights` choose the layout
- `variants.density`, `variants.alignment`, `variants.background` choose design style
- fallback defaults stay from top-level `density`, `alignment`, `background`

| Layout | Image | Text | Use |
|--------|-------|------|-----|
| `split` | Side/stacked | md-lg headline | Default image+text |
| `overlay` | Full canvas, dimmed | lg headline floats | High-impact |
| `type-only` | None | display headline | Text-forward |
| `card` | Top portion | Headline below | Image-dominant |
| `full-bleed` | Full canvas | Small label | Image IS the post |

### Rendering Pipeline
`composite/renderer/` — 4-layer node-canvas compositor:
1. **GraphicLayer** — background fill, gradient strip
2. **ImageLayer** — content image placed in layout zone
3. **Logo** — brand logo (drawn after image for z-order)
4. **TypeLayer** — headline text with brand typography

### Renderer Constants
All design constants (margins, layout proportions, typography ratios, gradient opacity, logo sizing) live in `composite/renderer/defaults.ts` as `RENDERER_DEFAULTS`. Brands override via `visual.renderer:` in YAML — deep-merged at load time. See `docs/visual-renderer-spec.md` for full reference.

```typescript
import { RENDERER_DEFAULTS, type RendererConfig } from './composite/renderer/defaults'
// BrandVisual.renderer is always populated (defaults if no YAML override)
```

Audit: `npx tsx scripts/audit-renderer-constants.ts` — flags unregistered magic numbers in renderer files.

### Brand Visual Config

```yaml
visual:
  palette: { background, primary, accent, secondary, warm, dark, light }
  typography:
    headline: { font, fontFile, weight, lineHeight, sizes: { sm, md, lg, display } }
  logo: { light, dark, colorOnLight, colorOnDark }
  layouts: [split, overlay, type-only, card]
  density: moderate     # relaxed | moderate | tight
  alignment: center     # center | left | asymmetric
  background: warm      # light | dark | warm
  paletteRotation: 4
  variants:
    layoutWeights:
      split: 2
      overlay: 1
      card: 1
      full-bleed: 1
      type-only: 1
    density: [moderate]
    alignment: [center]
    background: [warm]
  image:                # Image generation prompt config
    style: "..."        # Core aesthetic description
    mood: "..."         # Emotional tone
    avoid: [...]        # Hard exclusions (text, logos, etc.)
    prefer: [...]       # Soft preferences (textures, forms, etc.)
    palette_instructions: "..."  # Color usage guidance
  # Volume system (GiveCare) — single dial from mute → loud
  # All four elements (color, image, type, graphic) move in lockstep
  default_volume: whisper   # mute | quiet | whisper | vocal | loud
  volume_zones:
    whisper:                # Example zone — see givecare-brand.yml for full spec
      color: { field, text, accent }          # palette token references
      image: { treatment, saturation }
      type: { weight, size, contrast }
      graphic: { channels }
  prompt_system:        # Optional modular prompt system (SCTY)
    core_aesthetic: [...]
    subject_types: { abstract, symbol, grid, conceptual_diagram, celestial, ... }
    form_modes: { geometric, typographic, duotone, collage, cosmic, ... }
    texture_modes: { halftone, photocopy, overprint, crosshatch, ... }
```

`visual.design` can be used for brand systems with explicit profile grids:
- `visual.design.zones` for named profiles
- `visual.design.defaults` for deterministic fallback and profile defaults

Legacy `visual.volume_zones` is still supported for backward compatibility.

Template and existing brand YAMLs remain valid — design profiles resolve to a base profile when no zone profile is present.

### Content Pillars → Visual Identity

Brand YAML `content_pillars.pillars` drives per-pillar visual differentiation in nano poster mode:

```yaml
content_pillars:
  pillars:
    - id: shipped
      label: "Tools"              # → eyebrow text
      color: "#FF9F00"            # → accent color for geometric shapes + eyebrow
      image_direction: "constructed, architectural, precise"  # → image mood guidance
```

The nano poster prompt builder resolves: pillar color → accent shapes, eyebrow label → typography, image_direction + random global subject → image content.

### Image Generation
Prompt-only — brand YAML `visual.image` + `visual.prompt_system` drive the aesthetic. No reference images needed.

- **Generic brands**: `buildGenericPrompt()` composes from `image.style`, `image.mood`, `image.prefer`, `image.avoid`
- **Nano poster**: `generateNanoPoster()` — single Gemini call renders image + typography + layout. Pillar-aware accent colors + image direction. Pixel sort + grain + dither as post-processing.
- **Volume zones** (GiveCare): `resolveVolumeContext(brand, volume?)` reads `visual.volume_zones` from brand YAML, resolves palette tokens to hex, returns `VolumeContext`. Injected as a VOLUME block in `buildGenericPrompt()`. Pass `--volume <zone>` to override per-post (mute/quiet/whisper/vocal/loud). Defaults to `visual.default_volume`.
- **SCTY**: `buildSctyPrompt()` randomly selects from curated subject/form/texture pools per image type
- **`--knockout`**: Prompts for solid white background, then sharp threshold removes it → transparent PNG

### Pixel Sort Post-Processing

`generate/pixel-sort.ts` — programmatic glitch effect applied after Gemini generation:

- **Pixel sort**: horizontal brightness-threshold sorting with configurable streak/intensity/randomness
- **Film grain**: per-pixel luminance noise via seeded PRNG (mulberry32)
- **Ordered dither**: Bayer 4×4 matrix for print-like texture
- **Mask**: `maskTopPercent` skips top N% of rows for sort (protects typography), grain applies everywhere

Presets: `GIVECARE_FULL` (threshold 0.08, streak 220, grain 0.18, dither 0.10), `GRAINRAD_ORIGINAL` (threshold 0.3, streak 180)

## Env

```bash
GEMINI_API_KEY         # Required - copy + image generation
REPLICATE_API_TOKEN    # Image upscale

# Per-brand platform creds: TWITTER_<BRAND>_*, LINKEDIN_<BRAND>_*, etc.
```

## Adding Brand

```bash
npx tsx src/cli.ts brand init <name>
```

Then edit:
1. `brands/<name>/<name>-brand.yml` - voice, visual (including `image:` config), platforms
2. `brands/<name>/<name>-rubric.yml` - eval dimensions
3. `brands/<name>/assets/logo.svg` + fonts/
4. Env vars: `TWITTER_<NAME>_API_KEY`, etc.

Template lives at `brands/_template/`.

## Key Patterns

### Per-Brand Queues
Queues are stored at `brands/<brand>/queue.json`. Always specify brand:
```bash
npx tsx src/cli.ts post <brand>  # NOT just "post"
```

### Brand Discovery
```typescript
import { discoverBrands } from './core/paths'
const brands = discoverBrands()  // ['brand-a', 'brand-b']
```

### Session Output
```typescript
import { createSessionDir, slugify } from './core/paths'
const dir = createSessionDir(slugify('caregiver burnout'), '-quick')
// → output/2026-02-18/caregiver-burnout-quick/
```

## Session End

```bash
cd agent && npx tsc --noEmit  # typecheck
git add <files> && git commit -m "feat: description"
```

## Token Lifecycle

| Platform | Expiry | Auto-refresh | Manual re-auth |
|----------|--------|-------------|----------------|
| Twitter | Never (OAuth 1.0a) | N/A | N/A |
| Facebook | Never (page tokens) | N/A | N/A |
| Instagram | 60 days | `token refresh` (must be valid) | Meta Developer Console > Use cases > Instagram API > Generate access tokens |
| Threads | 60 days | `token refresh` (must be valid) | Meta Developer Console > Use cases > Threads API > User Token Generator |
| LinkedIn | 60 days | Not available | `cd agent && npx tsx scripts/linkedin-auth.ts <brand>` |

The `post` command runs a pre-flight token check automatically. If a token is expired but refreshable, it refreshes it. If not, it skips that platform and warns you.

Run `token refresh` proactively (e.g., weekly) to extend Instagram/Threads tokens before they expire. Once expired, they can't be refreshed via API — you must re-auth manually in the Meta Developer Console.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Twitter 403 | Remove URL from tweet; spam filter |
| Instagram fail | Needs public URL; use R2 upload |
| Token expired | `token check` to diagnose, `token refresh` to fix, or re-auth manually |
| Wrong queue item | Specify brand explicitly |
| Type errors | Check QueueItem.brand field exists |
