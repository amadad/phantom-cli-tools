import { describe, it, expect } from 'vitest'
import { calculateMedian, calculateMedianViews, getLikesMultiplier } from './stats'

describe('calculateMedian', () => {
  it('returns 0 for empty array', () => {
    expect(calculateMedian([])).toBe(0)
  })

  it('returns the middle value for odd-length array', () => {
    expect(calculateMedian([1, 2, 3])).toBe(2)
    expect(calculateMedian([1, 5, 10, 15, 20])).toBe(10)
  })

  it('returns average of middle values for even-length array', () => {
    expect(calculateMedian([1, 2, 3, 4])).toBe(2.5)
    expect(calculateMedian([10, 20])).toBe(15)
  })

  it('handles unsorted input', () => {
    expect(calculateMedian([5, 1, 3, 2, 4])).toBe(3)
    expect(calculateMedian([100, 1, 50, 25])).toBe(37.5)
  })

  it('handles single element', () => {
    expect(calculateMedian([42])).toBe(42)
  })
})

describe('calculateMedianViews', () => {
  it('returns 0 for empty posts array', () => {
    expect(calculateMedianViews([])).toBe(0)
  })

  it('uses views when available', () => {
    const posts = [
      { views: 100 },
      { views: 200 },
      { views: 300 }
    ]
    expect(calculateMedianViews(posts)).toBe(200)
  })

  it('falls back to likes * multiplier when views not available', () => {
    const posts = [
      { likes: 10 },
      { likes: 20 },
      { likes: 30 }
    ]
    // Default multiplier is 10
    expect(calculateMedianViews(posts)).toBe(200)
  })

  it('uses custom multiplier', () => {
    const posts = [
      { likes: 10 },
      { likes: 20 },
      { likes: 30 }
    ]
    // Twitter multiplier is 50
    expect(calculateMedianViews(posts, 50)).toBe(1000)
  })

  it('prefers views over likes calculation', () => {
    const posts = [
      { views: 1000, likes: 10 }, // views should be used
      { views: 2000, likes: 20 },
      { views: 3000, likes: 30 }
    ]
    expect(calculateMedianViews(posts)).toBe(2000)
  })

  it('handles mixed posts with and without views', () => {
    const posts = [
      { views: 100 },
      { likes: 20 }, // 20 * 10 = 200
      { views: 300 }
    ]
    expect(calculateMedianViews(posts)).toBe(200)
  })
})

describe('getLikesMultiplier', () => {
  it('returns 50 for twitter', () => {
    expect(getLikesMultiplier('twitter')).toBe(50)
  })

  it('returns 10 for instagram', () => {
    expect(getLikesMultiplier('instagram')).toBe(10)
  })

  it('returns 15 for tiktok', () => {
    expect(getLikesMultiplier('tiktok')).toBe(15)
  })

  it('returns 30 for youtube', () => {
    expect(getLikesMultiplier('youtube')).toBe(30)
  })

  it('returns 10 for unknown platforms', () => {
    expect(getLikesMultiplier('unknown')).toBe(10)
    expect(getLikesMultiplier('')).toBe(10)
  })
})
