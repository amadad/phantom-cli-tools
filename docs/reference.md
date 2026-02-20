# Reference

## Frame Types

| Frame | Keywords | Voice Mode |
|-------|----------|------------|
| announcement | release, launch, ship | Product |
| event | conference, summit | Product |
| partnership | partner, collaborat | Founder |
| weekly_update | this week, working on | Product |
| practical_tip | tip, how-to, self-care | Brand (warm) |
| thought | (default) | Writing system |

## Hook Categories

| Category | Pattern |
|----------|---------|
| curiosity | "I tried X for 30 days..." |
| controversy | Hot takes, counterintuitive |
| transformation | Before/after, journey |
| secret | "Nobody talks about..." |
| listicle | "5 things I wish..." |
| story | Narrative hooks |
| question | Rhetorical questions |
| statistic | Data-driven hooks |

## Platform Specs

### Character Limits

| Platform | Max | Hashtags |
|----------|-----|----------|
| Twitter | 280 | 3 |
| LinkedIn | 3000 | 5 |
| Facebook | 63206 | 3 |
| Instagram | 2200 | 5-10 |
| Threads | 500 | 2-3 |

### Image Dimensions

| Platform | Square | Portrait | Landscape |
|----------|--------|----------|-----------|
| Instagram | 1080×1080 | 1080×1350 | 1080×566 |
| Facebook | 1080×1080 | 1080×1350 | 1200×630 |
| LinkedIn | 1080×1080 | 1080×1350 | 1200×628 |
| Twitter/X | 1080×1080 | 1080×1350 | 1200×675 |
| Threads | 1080×1080 | 1080×1920 | — |

### Token Lifetimes

| Platform | Lifetime | Refresh |
|----------|----------|---------|
| Twitter | Never | N/A |
| LinkedIn | ~60 days | Manual |
| Facebook/Instagram | ~60 days | Manual |
| Threads | ~60 days | Manual |
| YouTube | ~1 hour | Auto |

## Visual System

All visual config lives in brand YAML `visual:` section. No build step.

### Named Layouts

| Layout | Image | Text |
|--------|-------|------|
| `split` | Side/stacked | md-lg headline |
| `overlay` | Full canvas, dimmed | lg headline floats |
| `type-only` | None | display headline |
| `card` | Top portion | Headline below |
| `full-bleed` | Full canvas | Small label |

### Brand Visual Config

```yaml
visual:
  palette: { background, primary, accent, secondary, warm, dark, light }
  typography:
    headline: { font, fontFile, weight, lineHeight, sizes: { sm, md, lg, display } }
  logo: { light, dark, colorOnLight, colorOnDark }
  layouts: [split, overlay, type-only, card]
  density: relaxed | moderate | tight
  alignment: center | left | asymmetric
  background: light | dark | warm
  paletteRotation: 4
  image:
    style: "core aesthetic description"
    mood: "emotional tone"
    avoid: [text, logos, ...]
    prefer: [abstract textures, editorial, ...]
    palette_instructions: "how to use colors beyond hex"
  prompt_system:              # Optional (SCTY uses this for modular prompt composition)
    core_aesthetic: [...]
    subject_types: { abstract, symbol, grid, conceptual_diagram, celestial, ... }
    form_modes: { geometric, typographic, duotone, collage, cosmic, ... }
    texture_modes: { halftone, photocopy, overprint, crosshatch, ... }
    composition: [...]
    depth: [...]
```

### Rendering (4-layer canvas)

1. GraphicLayer — background fill, gradient strip
2. ImageLayer — content image in layout zone
3. Logo — brand mark (z-above image)
4. TypeLayer — headline text with brand typography

## Environment Variables

```bash
# Required
GEMINI_API_KEY

# Intel
APIFY_API_TOKEN

# Per-brand credentials (<brand> example)
TWITTER_GIVECARE_API_KEY
TWITTER_GIVECARE_API_SECRET
TWITTER_GIVECARE_ACCESS_TOKEN
TWITTER_GIVECARE_ACCESS_SECRET

LINKEDIN_GIVECARE_ACCESS_TOKEN
LINKEDIN_GIVECARE_ORG_ID

FACEBOOK_GIVECARE_PAGE_ACCESS_TOKEN
FACEBOOK_GIVECARE_PAGE_ID

INSTAGRAM_GIVECARE_ACCESS_TOKEN
INSTAGRAM_GIVECARE_USER_ID

THREADS_GIVECARE_ACCESS_TOKEN
THREADS_GIVECARE_USER_ID
```

## Brand Configuration

`brands/<brand>/<brand>-brand.yml` structure:

```yaml
voice:
  tone, style, rules          # Core voice
  product_rules               # Product-specific
  writing_system              # Anti-AI-slop constraints
  frames                      # Content type structures
  avoid_phrases               # Never-use words

visual:
  palette:                    # Colors (background, primary, accent, secondary, warm, dark, light)
  typography:
    headline:                 # Font, fontFile, weight, lineHeight, sizes
  logo:                       # light, dark, colorOnLight, colorOnDark
  layouts:                    # Allowed named layouts
  density:                    # relaxed | moderate | tight
  alignment:                  # center | left | asymmetric
  background:                 # light | dark | warm
  paletteRotation:            # Number of palette variants
  variants:
    layoutWeights:           # optional weighted layout selection
    density: []              # optional density candidates
    alignment: []            # optional alignment candidates
    background: []           # optional background candidates
  image:                      # Image generation prompt config
    style:                    # Core aesthetic description
    mood:                     # Emotional tone
    avoid: []                 # Hard exclusions
    prefer: []                # Soft preferences
    palette_instructions:     # Color usage guidance
  prompt_system:              # Optional modular prompt system (SCTY)

guardrails:
  pursue, reject, never       # Quality controls
```
