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

## Template System

| Template | Purpose | When to Use |
|----------|---------|-------------|
| kunz | Layered typography | Bold text-driven posts |
| instax-social | Polaroid aesthetic | Lifestyle content |
| brand-system | SCTY modular prompts | Abstract visuals |

### Kunz Grid

```
A1-A6: Primary 6-column grid (typography)
B1-B5: Secondary 5-column grid (offset tension)
M1-M12: Mark grid (12x12 for glyphs)
```

### Mark Vocabulary

| Mark | Semantic |
|------|----------|
| `*` `†` | Footnote, invisible labor |
| `+` `×` | Accumulation, growth |
| `:` `/` `~` | Ratio, transformation |
| `—` `\|` | Time, duration |

## Environment Variables

```bash
# Required
GEMINI_API_KEY

# Intel
APIFY_API_TOKEN

# Per-brand credentials (givecare example)
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

`brands/givecare.yml` structure:

```yaml
voice:
  tone, style, rules          # Core voice
  product_rules               # Product-specific
  writing_system              # Anti-AI-slop constraints
  frames                      # Content type structures
  avoid_phrases               # Never-use words

visual:
  palette                     # Colors
  reference_styles            # Visual modes with mood keywords
  image_generation            # Model, aspect ratio

guardrails:
  pursue, reject, never       # Quality controls
```
