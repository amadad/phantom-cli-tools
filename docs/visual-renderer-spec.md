# Visual Renderer Spec

Single-file reference for the 4-layer compositor and its configurable constants.

## Config Flow

```
brand YAML → visual.renderer: → resolveRendererConfig() → BrandVisual.renderer
                                   ↓ deep-merge
                              RENDERER_DEFAULTS
```

Brands override only the fields they need. Missing fields fall back to `RENDERER_DEFAULTS` in `agent/src/composite/renderer/defaults.ts`.

## 4-Layer Pipeline

| Layer | File | Purpose |
|-------|------|---------|
| 1. GraphicLayer | `renderer/layers/GraphicLayer.ts` | Background fill, gradient overlay, text backing |
| 2. ImageLayer | `renderer/layers/ImageLayer.ts` | AI-generated content image |
| 3. Logo | `GraphicLayer.ts` (`drawLogo`) | Brand logo (on top of image) |
| 4. TypeLayer | `renderer/layers/TypeLayer.ts` | Headline, eyebrow, caption, subtext |

## Constants Table

### Margins (`renderer.margins`)

| Key | Default | Range | Used in |
|-----|---------|-------|---------|
| `relaxed` | `0.08` | 0.01–0.15 | `layouts.ts` → `marginFor()` |
| `moderate` | `0.05` | 0.01–0.10 | `layouts.ts` → `marginFor()` |
| `tight` | `0.025` | 0.005–0.05 | `layouts.ts` → `marginFor()` |

### Logo (`renderer.logo`)

| Key | Default | Range | Used in |
|-----|---------|-------|---------|
| `width` | `0.12` | 0.05–0.25 | `layouts.ts` → `logoBottom()`, `layoutFullBleed()` |
| `height` | `0.06` | 0.03–0.12 | `layouts.ts` → `logoBottom()`, `layoutFullBleed()` |
| `padding` | `0.02` | 0.01–0.05 | `layouts.ts` → `logoBottom()` |

### Layout Proportions (`renderer.layouts.<name>`)

#### split

| Key | Default | Description |
|-----|---------|-------------|
| `imageHeight` | `0.55` | Vertical: fraction of available height for image |
| `imageWidth` | `0.5` | Horizontal: fraction of available width for image |
| `textHeight` | `0.6` | Horizontal: fraction of available height for text |
| `textYOffset` | `0.15` | Non-center alignment: vertical offset ratio |
| `verticalThreshold` | `0.85` | Aspect ratio breakpoint (h/w) for vertical layout |

```
Vertical (h/w > 0.85):       Horizontal:
┌──────────────┐              ┌──────────┬─────────┐
│              │              │          │         │
│    IMAGE     │ 55%          │  IMAGE   │  TEXT   │
│              │              │   50%    │  60% h  │
├──────────────┤              │          │         │
│    TEXT      │              └──────────┴─────────┘
└──────────────┘
```

#### overlay

| Key | Default | Description |
|-----|---------|-------------|
| `textWidth` | `0.7` | Text zone width as fraction of canvas |
| `textHeight` | `0.45` | Text zone height as fraction of canvas |
| `centerY` | `0.45` | Center/left alignment: vertical position ratio |
| `asymmetricYOffset` | `0.06` | Asymmetric alignment: bottom offset |
| `leftXOffset` | `0.04` | Left alignment: horizontal nudge |

```
┌─────────────────────┐
│   ┌───────────┐     │
│   │   TEXT     │     │ image fills full canvas
│   │  70% × 45%│     │ text floats on top
│   └───────────┘     │
└─────────────────────┘
```

#### type-only

| Key | Default | Description |
|-----|---------|-------------|
| `textHeight` | `0.65` | Text zone height fraction |
| `centerY` | `0.4` | Center alignment: vertical position ratio |
| `asymmetricY` | `0.15` | Asymmetric alignment: Y position |
| `leftY` | `0.1` | Left alignment: Y position |

```
┌──────────────┐
│              │
│  HEADLINE    │ 65% height
│  (display)   │
│              │
└──────────────┘
```

#### card

| Key | Default | Description |
|-----|---------|-------------|
| `imageHeight` | `0.65` | Image zone height fraction |
| `textGap` | `0.5` | Gap between image and text (as fraction of padding) |

```
┌──────────────┐
│              │
│    IMAGE     │ 65%
│              │
├──────────────┤
│    TEXT      │
└──────────────┘
```

#### full-bleed

| Key | Default | Description |
|-----|---------|-------------|
| `textYOffset` | `0.08` | Text zone offset from bottom |
| `textWidth` | `0.5` | Text zone width fraction |
| `textHeight` | `0.06` | Text zone height fraction |
| `imageDim` | `0.15` | Default image dimming |

```
┌─────────────────────┐
│ IMAGE (full canvas)  │
│                     │
│            ┌──LOGO──┐
│ ┌─TEXT──┐  │        │
└─┘──────┘──┴────────┘
```

### Type (`renderer.type`)

| Key | Default | Used for |
|-----|---------|----------|
| `eyebrowRatio` | `0.38` | Eyebrow size = headline × ratio |
| `eyebrowMargin` | `0.8` | Gap below eyebrow = eyebrow size × margin |
| `captionRatio` | `0.55` | Caption size = headline × ratio |
| `subtextRatio` | `0.4` | Subtext size = headline × ratio |
| `capsLineHeightTighten` | `0.85` | Line height multiplier for all-caps display |
| `zonePadding` | `0.04` | Inner padding = zone width × padding |
| `fitShrinkFactor` | `0.85` | Font size step-down per fit iteration |
| `minFontSize` | `20` | Absolute minimum font size (px) |
| `subtextLineSpacing` | `1.4` | Subtext line height = size × spacing |
| `subtextReserveMultiplier` | `2.4` | Vertical reserve for subtext (bottom gravity) |

### Graphic (`renderer.graphic`)

| Key | Default | Used for |
|-----|---------|----------|
| `gradientAlphaBase` | `0.06` | Base gradient opacity |
| `gradientAlphaStep` | `0.04` | Opacity increment per graphic channel |
| `darkTextBacking` | `0.15` | Dark-mode text zone backing opacity |
| `fallbackDark` | `#2A2520` | Dark palette fallback (missing `palette.dark`) |
| `fallbackAccent` | `#1a1a2e` | Accent fallback for dark palette / empty arrays |

## YAML Schema

```yaml
visual:
  renderer:
    margins:
      relaxed: 0.08
      moderate: 0.05
      tight: 0.025
    logo:
      width: 0.12
      height: 0.06
      padding: 0.02
    layouts:
      split:
        imageHeight: 0.55
        imageWidth: 0.5
        textHeight: 0.6
        textYOffset: 0.15
        verticalThreshold: 0.85
      overlay:
        textWidth: 0.7
        textHeight: 0.45
        centerY: 0.45
        asymmetricYOffset: 0.06
        leftXOffset: 0.04
      type-only:
        textHeight: 0.65
        centerY: 0.4
        asymmetricY: 0.15
        leftY: 0.1
      card:
        imageHeight: 0.65
        textGap: 0.5
      full-bleed:
        textYOffset: 0.08
        textWidth: 0.5
        textHeight: 0.06
        imageDim: 0.15
    type:
      eyebrowRatio: 0.38
      eyebrowMargin: 0.8
      captionRatio: 0.55
      subtextRatio: 0.4
      capsLineHeightTighten: 0.85
      zonePadding: 0.04
      fitShrinkFactor: 0.85
      minFontSize: 20
      subtextLineSpacing: 1.4
      subtextReserveMultiplier: 2.4
    graphic:
      gradientAlphaBase: 0.06
      gradientAlphaStep: 0.04
      darkTextBacking: 0.15
      fallbackDark: "#2A2520"
      fallbackAccent: "#1a1a2e"
```

## Source Files

| File | Role |
|------|------|
| `agent/src/composite/renderer/defaults.ts` | Type definitions + default values |
| `agent/src/core/visual.ts` | `resolveRendererConfig()` deep-merge, `BrandVisual.renderer` |
| `agent/src/composite/layouts.ts` | Consumes `margins`, `logo`, `layouts.*` |
| `agent/src/composite/renderer/layers/TypeLayer.ts` | Consumes `type.*` |
| `agent/src/composite/renderer/layers/GraphicLayer.ts` | Consumes `graphic.*` |
