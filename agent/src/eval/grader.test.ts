import { describe, it, expect } from 'vitest'
import {
  checkBannedPhrases,
  checkRedFlags,
  checkPlatformLimits,
  checkSlop,
  computeScore,
  buildFeedback,
  type RedFlagPattern,
  type PlatformLimits,
  type EvalResult,
  type Rubric
} from './grader'

describe('checkBannedPhrases', () => {
  it('returns empty array when no banned phrases found', () => {
    expect(checkBannedPhrases('Hello world', ['forbidden', 'banned'])).toEqual([])
  })

  it('detects banned phrases (case insensitive)', () => {
    const text = 'You are allowed to rest today'
    const banned = ["you're allowed to", 'give yourself grace']
    expect(checkBannedPhrases(text, banned)).toEqual([])
  })

  it('returns matching banned phrases', () => {
    const text = "You're allowed to take a break and give yourself grace"
    const banned = ["you're allowed to", 'give yourself grace', 'self-care']
    expect(checkBannedPhrases(text, banned)).toEqual([
      "you're allowed to",
      'give yourself grace'
    ])
  })

  it('handles empty banned list', () => {
    expect(checkBannedPhrases('Any text here', [])).toEqual([])
  })

  it('handles empty text', () => {
    expect(checkBannedPhrases('', ['banned'])).toEqual([])
  })
})

describe('checkSlop', () => {
  it('detects em dashes', () => {
    const result = checkSlop('The problem — and it is one — needs fixing')
    expect(result.patterns).toContain('em dash (zero allowed)')
  })

  it('detects slop words', () => {
    const result = checkSlop('We need to leverage this innovative framework to unlock growth')
    expect(result.words).toContain('leverage')
    expect(result.words).toContain('innovative')
    expect(result.words).toContain('unlock')
  })

  it('detects "not just X, it\'s Y" pattern', () => {
    const result = checkSlop("It's not just a tool, it's a revolution")
    expect(result.patterns.some(p => p.includes('not just X'))).toBe(true)
  })

  it('returns clean for human-sounding copy', () => {
    const result = checkSlop('Monday is hard. The mental load is heavy. Pick one thing to let go of today.')
    expect(result.words).toEqual([])
    expect(result.patterns).toEqual([])
  })

  it('catches word boundaries correctly', () => {
    // "realm" should not match "really"
    const result = checkSlop('This is really good')
    expect(result.words).not.toContain('realm')
  })

  it('detects "serves as" filler', () => {
    const result = checkSlop('This serves as a reminder to rest')
    expect(result.patterns.some(p => p.includes('serves as'))).toBe(true)
  })
})

describe('checkRedFlags', () => {
  const patterns: RedFlagPattern[] = [
    { pattern: 'gentle reminder', reason: 'passive aggressive', penalty: 10 },
    { pattern: 'just.*saying', reason: 'dismissive', penalty: 5 },
    { pattern: '^hey\\s', reason: 'too casual opener', penalty: 3 }
  ]

  it('returns empty array when no patterns match', () => {
    expect(checkRedFlags('This is great content', patterns)).toEqual([])
  })

  it('detects matching patterns', () => {
    const result = checkRedFlags('This is a gentle reminder to be kind', patterns)
    expect(result).toHaveLength(1)
    expect(result[0].pattern).toBe('gentle reminder')
    expect(result[0].penalty).toBe(10)
  })

  it('handles regex patterns', () => {
    const result = checkRedFlags("I'm just saying you should try this", patterns)
    expect(result).toHaveLength(1)
    expect(result[0].pattern).toBe('just.*saying')
  })

  it('handles invalid regex gracefully', () => {
    const badPatterns: RedFlagPattern[] = [
      { pattern: '[invalid(regex', reason: 'bad', penalty: 5 }
    ]
    expect(checkRedFlags('Any text', badPatterns)).toEqual([])
  })

  it('returns multiple matches', () => {
    const text = "Hey gentle reminder I'm just saying"
    const result = checkRedFlags(text, patterns)
    expect(result).toHaveLength(3)
  })
})

describe('checkPlatformLimits', () => {
  const limits: Record<string, PlatformLimits> = {
    twitter: { max_chars: 280, max_hashtags: 3 },
    linkedin: { max_chars: 1500, max_hashtags: 5 }
  }

  it('returns empty array when within limits', () => {
    const text = 'Short post'
    expect(checkPlatformLimits(text, ['#one', '#two'], 'twitter', limits)).toEqual([])
  })

  it('detects character limit exceeded', () => {
    const text = 'a'.repeat(300) // 300 chars
    const result = checkPlatformLimits(text, [], 'twitter', limits)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('Exceeds twitter limit')
    expect(result[0]).toContain('300/280')
  })

  it('detects hashtag limit exceeded', () => {
    const hashtags = ['#1', '#2', '#3', '#4', '#5']
    const result = checkPlatformLimits('Short', hashtags, 'twitter', limits)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('Too many hashtags')
    expect(result[0]).toContain('5/3')
  })

  it('returns multiple issues', () => {
    const text = 'a'.repeat(300)
    const hashtags = ['#1', '#2', '#3', '#4', '#5']
    const result = checkPlatformLimits(text, hashtags, 'twitter', limits)
    expect(result).toHaveLength(2)
  })

  it('returns empty for unknown platform', () => {
    expect(checkPlatformLimits('text', [], 'unknown', limits)).toEqual([])
  })
})

describe('computeScore', () => {
  it('computes weighted average correctly', () => {
    const dimensions = { voice: 8, clarity: 6 }
    const weights = { voice: 0.5, clarity: 0.5 }
    // (8*0.5 + 6*0.5) / 1.0 * 10 = 70
    expect(computeScore(dimensions, weights, 0)).toBe(70)
  })

  it('handles different weights', () => {
    const dimensions = { voice: 10, clarity: 0 }
    const weights = { voice: 0.8, clarity: 0.2 }
    // (10*0.8 + 0*0.2) / 1.0 * 10 = 80
    expect(computeScore(dimensions, weights, 0)).toBe(80)
  })

  it('applies red flag penalty', () => {
    const dimensions = { voice: 8, clarity: 8 }
    const weights = { voice: 0.5, clarity: 0.5 }
    // Base: 80, penalty: 15 → 65
    expect(computeScore(dimensions, weights, 15)).toBe(65)
  })

  it('floors at 0 with large penalty', () => {
    const dimensions = { voice: 5, clarity: 5 }
    const weights = { voice: 0.5, clarity: 0.5 }
    // Base: 50, penalty: 100 → 0 (not negative)
    expect(computeScore(dimensions, weights, 100)).toBe(0)
  })

  it('uses default weight for unknown dimensions', () => {
    const dimensions = { custom: 10 }
    const weights = {} // Empty weights → default 0.2
    // 10 * 0.2 / 0.2 * 10 = 100
    expect(computeScore(dimensions, weights, 0)).toBe(100)
  })
})

describe('buildFeedback', () => {
  const mockRubric: Partial<Rubric> = {
    dimensions: {
      voice: { weight: 0.3, description: 'Brand voice alignment', rubric: {} },
      clarity: { weight: 0.3, description: 'Clear and concise', rubric: {} },
      hook: { weight: 0.2, description: 'Attention-grabbing opener', rubric: {} },
      cta: { weight: 0.2, description: 'Call to action', rubric: {} }
    }
  }

  it('includes banned phrases in feedback', () => {
    const result: EvalResult = {
      passed: false,
      score: 50,
      dimensions: { voice: 8, clarity: 8, hook: 8, cta: 8 },
      hard_fails: ['self-care', 'gentle reminder'],
      red_flags: [],
      platform_issues: [],
      critique: 'Test critique'
    }
    const feedback = buildFeedback(result, mockRubric as Rubric)
    expect(feedback).toContain('REMOVE')
    expect(feedback).toContain('self-care')
    expect(feedback).toContain('gentle reminder')
  })

  it('includes red flag patterns in feedback', () => {
    const result: EvalResult = {
      passed: false,
      score: 50,
      dimensions: { voice: 8, clarity: 8, hook: 8, cta: 8 },
      hard_fails: [],
      red_flags: [
        { pattern: 'just.*saying', reason: 'dismissive', penalty: 5 }
      ],
      platform_issues: [],
      critique: 'Test critique'
    }
    const feedback = buildFeedback(result, mockRubric as Rubric)
    expect(feedback).toContain('AVOID')
    expect(feedback).toContain('just.*saying')
    expect(feedback).toContain('dismissive')
  })

  it('identifies lowest scoring dimensions', () => {
    const result: EvalResult = {
      passed: false,
      score: 50,
      dimensions: { voice: 9, clarity: 4, hook: 5, cta: 8 },
      hard_fails: [],
      red_flags: [],
      platform_issues: [],
      critique: 'Test critique'
    }
    const feedback = buildFeedback(result, mockRubric as Rubric)
    expect(feedback).toContain('IMPROVE CLARITY')
    expect(feedback).toContain('4/10')
    expect(feedback).toContain('IMPROVE HOOK')
    expect(feedback).toContain('5/10')
  })

  it('includes suggestion when present', () => {
    const result: EvalResult = {
      passed: false,
      score: 50,
      dimensions: { voice: 8, clarity: 8, hook: 8, cta: 8 },
      hard_fails: [],
      red_flags: [],
      platform_issues: [],
      critique: 'Test critique',
      suggestion: 'Try a more direct approach'
    }
    const feedback = buildFeedback(result, mockRubric as Rubric)
    expect(feedback).toContain('SUGGESTION')
    expect(feedback).toContain('Try a more direct approach')
  })
})
