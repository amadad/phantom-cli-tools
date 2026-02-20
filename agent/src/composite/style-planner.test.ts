import { describe, expect, it } from 'vitest'
import type { BrandVisual } from '../core/visual'
import { buildStylePlan, canRenderWithImage } from './style-planner'
import { computeLayout } from './layouts'

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

