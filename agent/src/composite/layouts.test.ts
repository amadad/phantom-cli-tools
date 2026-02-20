import { describe, expect, it } from 'vitest'
import type { BrandVisual } from '../core/visual'
import { computeLayout, pickLayout } from './layouts'

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
  layouts: ['split', 'overlay', 'type-only', 'card', 'full-bleed'],
  density: 'moderate',
  alignment: 'center',
  background: 'light',
  paletteRotation: 4,
}

describe('pickLayout', () => {
  it('is deterministic for the same topic/seed', () => {
    const a = pickLayout(visual.layouts, 'same-topic', true)
    const b = pickLayout(visual.layouts, 'same-topic', true)
    expect(a).toBe(b)
  })

  it('allows type-only layouts when image exists if brand allows it', () => {
    const layout = pickLayout(['type-only'], 'topic', true)
    expect(layout).toBe('type-only')
  })

  it('forces type-only when no image is available', () => {
    const layout = pickLayout(visual.layouts, 'topic', false)
    expect(layout).toBe('type-only')
  })
})

describe('computeLayout', () => {
  it('is deterministic for bgColorIndex with same seed', () => {
    const a = computeLayout('split', 1080, 1080, visual, 'topic')
    const b = computeLayout('split', 1080, 1080, visual, 'topic')
    expect(a.bgColorIndex).toBe(b.bgColorIndex)
  })
})
