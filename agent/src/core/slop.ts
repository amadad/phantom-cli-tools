/**
 * Anti-slop constants — shared between grader and copy generation.
 * Single source of truth for AI-writing kill words and patterns.
 */

/** Words that are hard signals of AI-generated copy */
export const SLOP_WORDS = [
  'additionally', 'moreover', 'furthermore', 'delve', 'crucial', 'vital',
  'pivotal', 'landscape', 'tapestry', 'testament', 'underscore', 'showcase',
  'foster', 'garner', 'intricate', 'vibrant', 'seamless', 'robust',
  'leverage', 'utilize', 'facilitate', 'paradigm', 'synergy', 'holistic',
  'comprehensive', 'innovative', 'cutting-edge', 'groundbreaking',
  'game-changing', 'best-in-class', 'world-class', 'state-of-the-art',
  'meticulous', 'nuanced', 'multifaceted', 'realm', 'embark', 'noteworthy',
  'notably', 'ultimately', 'essentially', 'fundamentally',
  'navigate', 'unlock', 'empower', 'harness',
]

/** Structural patterns that betray AI authorship */
export const SLOP_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /—/g, reason: 'em dash (zero allowed)' },
  { pattern: /it'?s not just .{1,30}, it'?s/i, reason: '"not just X, it\'s Y" cliche' },
  { pattern: /serves as a?\s/i, reason: '"serves as" filler' },
  { pattern: /stands as a?\s/i, reason: '"stands as" filler' },
]
