import { describe, expect, it } from 'vitest'
import type { BrandVisual } from '../core/visual'
import { RENDERER_DEFAULTS } from './renderer/defaults'
import { buildStylePlan, canRenderWithImage, computeLayout } from './layouts'

const visual: BrandVisual = {
  palette: {
    background: '#fff',
    primary: '#000',
    accent: '#f00',
  },
  typography: {
    headline: {
      font: 'Alegreya',
      weight: 400,
      lineHeight: 1.15,
      sizes: { sm: 28, md: 50, lg: 84, display: 136 },
    },
  },
  logo: {
    colorOnLight: '#111',
    colorOnDark: '#fff',
  },
  layouts: ['split', 'overlay', 'type-only', 'card'],
  density: 'moderate',
  alignment: 'center',
  background: 'light',
  paletteRotation: 4,
  variants: {
    layoutWeights: { split: 1, overlay: 2 },
    density: ['tight', 'moderate'],
    alignment: ['left', 'center'],
    background: ['light', 'dark'],
  },
  renderer: RENDERER_DEFAULTS,
}

describe('buildStylePlan', () => {
  it('is deterministic for same inputs', () => {
    const a = buildStylePlan({ visual, topic: 'same-topic', hasImage: true, seed: 'seed-1' })
    const b = buildStylePlan({ visual, topic: 'same-topic', hasImage: true, seed: 'seed-1' })
    expect(a).toEqual(b)
  })

  it('forces type-only when image is unavailable', () => {
    const plan = buildStylePlan({ visual, topic: 'topic', hasImage: false })
    expect(plan.layoutName).toBe('type-only')
  })

  it('canRenderWithImage matches layouts that can accept imagery', () => {
    expect(canRenderWithImage(visual)).toBe(true)

    const typeOnlyVisual: BrandVisual = {
      ...visual,
      layouts: ['type-only'],
      variants: { ...visual.variants, layoutWeights: { 'type-only': 1 } },
    }
    expect(canRenderWithImage(typeOnlyVisual)).toBe(false)
  })
})

describe('computeLayout', () => {
  it('is deterministic for bgColorIndex with same seed', () => {
    const a = computeLayout('split', 1080, 1080, visual, 'topic')
    const b = computeLayout('split', 1080, 1080, visual, 'topic')
    expect(a.bgColorIndex).toBe(b.bgColorIndex)
  })
})

describe('renderer config overrides', () => {
  it('custom margin ratios produce different zone geometry', () => {
    const defaultResult = computeLayout('split', 1080, 1080, visual, 'topic')
    const tightMargins: BrandVisual = {
      ...visual,
      renderer: {
        ...RENDERER_DEFAULTS,
        margins: { relaxed: 0.02, moderate: 0.01, tight: 0.005 },
      },
    }
    const tightResult = computeLayout('split', 1080, 1080, tightMargins, 'topic')
    // Smaller margins → larger image zone
    expect(tightResult.imageZone.width).toBeGreaterThan(defaultResult.imageZone.width)
  })

  it('custom split.imageHeight changes image zone proportions', () => {
    const defaultResult = computeLayout('split', 1080, 1080, visual, 'topic')
    const tallImage: BrandVisual = {
      ...visual,
      renderer: {
        ...RENDERER_DEFAULTS,
        layouts: {
          ...RENDERER_DEFAULTS.layouts,
          split: { ...RENDERER_DEFAULTS.layouts.split, imageHeight: 0.75 },
        },
      },
    }
    const tallResult = computeLayout('split', 1080, 1080, tallImage, 'topic')
    // Taller image fraction → larger image zone height
    expect(tallResult.imageZone.height).toBeGreaterThan(defaultResult.imageZone.height)
  })

  it('custom overlay.textWidth changes text zone width', () => {
    const defaultResult = computeLayout('overlay', 1200, 675, visual, 'topic')
    const wideText: BrandVisual = {
      ...visual,
      renderer: {
        ...RENDERER_DEFAULTS,
        layouts: {
          ...RENDERER_DEFAULTS.layouts,
          overlay: { ...RENDERER_DEFAULTS.layouts.overlay, textWidth: 0.9 },
        },
      },
    }
    const wideResult = computeLayout('overlay', 1200, 675, wideText, 'topic')
    expect(wideResult.textZone.width).toBeGreaterThan(defaultResult.textZone.width)
  })
})

