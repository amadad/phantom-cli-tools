# AGENTS.md

Instructions for AI agents working on this codebase.

## Project

Brand content pipeline: intel → generate → eval → post. CLI at `agent/src/cli.ts`.

## Key Architecture

### Visual System (single source of truth)
- `agent/src/core/visual.ts` — `BrandVisual` type + `loadBrandVisual()` loader
- Brand YAML `visual:` section holds all visual config (palette, typography, logo, layouts, density, alignment, background)
- No build step, no token pipeline, no separate style files

### Poster Pipeline
- `agent/src/composite/poster.ts` — thin wrapper around `renderComposition()`
- `agent/src/composite/layouts.ts` — 5 named layouts: split, overlay, type-only, card, full-bleed
- `agent/src/composite/renderer/` — 4-layer node-canvas compositor:
  - `render.ts` — orchestrator: loads visual, picks layout, computes zones, calls BrandFrame
  - `BrandFrame.ts` — 4 layers: GraphicLayer → ImageLayer → Logo → TypeLayer
  - `layers/GraphicLayer.ts` — background fill, gradient strip, logo drawing
  - `layers/ImageLayer.ts` — content image placement
  - `layers/TypeLayer.ts` — headline text rendering
  - `types.ts` — shared types (PixelZone, BrandFrameProps, etc.)

### Brand Config
- `brands/<name>/<name>-brand.yml` — voice + visual config
- `agent/src/core/brand.ts` — `loadBrand()`, `resolvePalette()`, voice context
- `agent/src/core/visual.ts` — `loadBrandVisual()` reads visual section, applies defaults, resolves paths

### Commands
- `agent/src/commands/` — each command is self-contained, exports reusable functions
- `explore.ts` orchestrates: image + copy → grade → poster → enqueue
- All commands use `agent/src/cli/args.ts` for arg parsing

## Conventions

- TypeScript, strict mode
- `npx tsc --noEmit` must pass before commit
- No satori, no token build step — canvas-only rendering
- Brand fonts loaded from `brands/<name>/assets/` via `canvas.registerFont()`
- Layout selected deterministically from topic hash (FNV-1a)
- Commands share logic via exported functions, not abstraction layers

## Testing

```bash
cd agent
npx vitest run           # All tests
npx tsc --noEmit         # Typecheck
```

## Common Tasks

### Add a layout
1. Add to `LayoutName` union in `agent/src/core/visual.ts`
2. Add layout function in `agent/src/composite/layouts.ts`
3. Register in `LAYOUT_FNS` map
4. Add to brand YAML `visual.layouts` array

### Add a brand
```bash
npx tsx src/cli.ts brand init <name>
```
Then edit brand YAML `visual:` section with palette, typography, logo, layouts.

### Modify rendering
All rendering in `agent/src/composite/renderer/`. BrandFrame draws 4 layers sequentially on a single canvas. Logo is drawn after image to maintain z-order.
