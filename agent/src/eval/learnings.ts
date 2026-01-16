/**
 * Learnings System
 *
 * Aggregates evaluation feedback into actionable learnings per brand.
 * Provides context injection for generation prompts.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { getBrandDir, getEvalLogPath, join, getDefaultBrand } from '../core/paths'
import type { CommandContext } from '../cli/types'

// =============================================================================
// TYPES
// =============================================================================

export interface Learnings {
  updated: string
  sample_size: number

  copy: {
    weak_dimensions: string[]      // Consistently low-scoring areas
    common_red_flags: string[]     // Patterns that trigger failures
    avoid: string[]                // Derived guidance: what NOT to do
    prefer: string[]               // Derived guidance: what TO do
  }

  image: {
    weak_areas: string[]           // Consistently low-scoring areas
    common_issues: string[]        // Recurring problems
    avoid: string[]                // What NOT to generate
    prefer: string[]               // What TO aim for
  }
}

interface EvalLogEntry {
  ts: string
  type?: 'copy' | 'image'
  brand: string
  score: number
  passed: boolean
  dimensions: Record<string, number>
  hard_fails?: string[]
  red_flags?: string[]
  issues?: string[]
}

// =============================================================================
// LOAD / SAVE
// =============================================================================

export function getLearningsPath(brandName: string): string {
  return join(getBrandDir(brandName), 'learnings.json')
}

export function loadLearnings(brandName: string): Learnings | null {
  const path = getLearningsPath(brandName)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

export function saveLearnings(brandName: string, learnings: Learnings): void {
  const path = getLearningsPath(brandName)
  writeFileSync(path, JSON.stringify(learnings, null, 2))
  console.log(`[learnings] Saved to ${path}`)
}

// =============================================================================
// AGGREGATE FROM LOGS
// =============================================================================

/**
 * Read eval-log.jsonl and aggregate learnings for a brand
 */
export function aggregateLearnings(brandName: string): Learnings {
  const logPath = getEvalLogPath()

  if (!existsSync(logPath)) {
    return emptyLearnings()
  }

  const lines = readFileSync(logPath, 'utf-8').trim().split('\n')
  const entries: EvalLogEntry[] = lines
    .filter(l => l.trim())
    .map(l => { try { return JSON.parse(l) } catch { return null } })
    .filter((e): e is EvalLogEntry => e !== null && e.brand === brandName)

  if (entries.length === 0) {
    return emptyLearnings()
  }

  // Separate copy and image entries
  const copyEntries = entries.filter(e => e.type !== 'image')
  const imageEntries = entries.filter(e => e.type === 'image')

  return {
    updated: new Date().toISOString().split('T')[0],
    sample_size: entries.length,
    copy: aggregateCopyLearnings(copyEntries),
    image: aggregateImageLearnings(imageEntries)
  }
}

function aggregateCopyLearnings(entries: EvalLogEntry[]): Learnings['copy'] {
  if (entries.length === 0) {
    return { weak_dimensions: [], common_red_flags: [], avoid: [], prefer: [] }
  }

  // Find weak dimensions (avg < 7)
  const dimTotals: Record<string, number[]> = {}
  const redFlagCounts: Record<string, number> = {}

  for (const entry of entries) {
    // Track dimension scores
    for (const [dim, score] of Object.entries(entry.dimensions || {})) {
      if (!dimTotals[dim]) dimTotals[dim] = []
      dimTotals[dim].push(score)
    }

    // Track red flags
    for (const flag of entry.red_flags || []) {
      redFlagCounts[flag] = (redFlagCounts[flag] || 0) + 1
    }
  }

  const weakDimensions = Object.entries(dimTotals)
    .filter(([_, scores]) => avg(scores) < 7)
    .sort((a, b) => avg(a[1]) - avg(b[1]))
    .map(([dim]) => dim)

  const commonRedFlags = Object.entries(redFlagCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([flag]) => flag)

  // Derive guidance from patterns
  const avoid = deriveAvoidance(weakDimensions, commonRedFlags)
  const prefer = derivePreferences(weakDimensions)

  return { weak_dimensions: weakDimensions, common_red_flags: commonRedFlags, avoid, prefer }
}

function aggregateImageLearnings(entries: EvalLogEntry[]): Learnings['image'] {
  if (entries.length === 0) {
    return { weak_areas: [], common_issues: [], avoid: [], prefer: [] }
  }

  // Find weak areas (avg < 7)
  const dimTotals: Record<string, number[]> = {}
  const issueCounts: Record<string, number> = {}

  for (const entry of entries) {
    for (const [dim, score] of Object.entries(entry.dimensions || {})) {
      if (!dimTotals[dim]) dimTotals[dim] = []
      dimTotals[dim].push(score)
    }

    for (const issue of entry.issues || []) {
      issueCounts[issue] = (issueCounts[issue] || 0) + 1
    }
  }

  const weakAreas = Object.entries(dimTotals)
    .filter(([_, scores]) => avg(scores) < 7)
    .sort((a, b) => avg(a[1]) - avg(b[1]))
    .map(([dim]) => dim)

  const commonIssues = Object.entries(issueCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([issue]) => issue)

  return {
    weak_areas: weakAreas,
    common_issues: commonIssues,
    avoid: commonIssues.slice(0, 5),
    prefer: deriveImagePreferences(weakAreas)
  }
}

// =============================================================================
// DERIVE GUIDANCE
// =============================================================================

function deriveAvoidance(weakDims: string[], redFlags: string[]): string[] {
  const avoid: string[] = [...redFlags]

  // Dimension heuristics
  if (weakDims.includes('choice')) {
    avoid.push('imperative commands', 'prescriptive language')
  }
  if (weakDims.includes('validation')) {
    avoid.push('jumping to solutions', 'dismissing feelings')
  }
  if (weakDims.includes('authenticity')) {
    avoid.push('corporate tone', 'generic wellness speak')
  }
  if (weakDims.includes('safety')) {
    avoid.push('shaming language', 'guilt-inducing phrases')
  }

  // Additional heuristics
  if (weakDims.includes('insight')) {
    avoid.push('surface-level observations', 'generic advice')
  }
  if (weakDims.includes('clarity')) {
    avoid.push('vague language', 'meandering sentences')
  }
  if (weakDims.includes('authority')) {
    avoid.push('hedge words', 'uncertain tone')
  }
  if (weakDims.includes('originality')) {
    avoid.push('cliches', 'AI-sounding phrases', 'LinkedIn-speak')
  }
  if (weakDims.includes('engagement')) {
    avoid.push('passive voice', 'abstract claims without stakes')
  }

  return [...new Set(avoid)]
}

function derivePreferences(weakDims: string[]): string[] {
  const prefer: string[] = []

  // Dimension heuristics
  if (weakDims.includes('choice')) {
    prefer.push('offer options', 'use "consider" over "should"')
  }
  if (weakDims.includes('validation')) {
    prefer.push('acknowledge struggle first', 'name the emotion')
  }
  if (weakDims.includes('authenticity')) {
    prefer.push('conversational tone', 'specific over generic')
  }
  if (weakDims.includes('empowerment')) {
    prefer.push('assume capability', 'trust the reader')
  }

  // Additional heuristics
  if (weakDims.includes('insight')) {
    prefer.push('surprising observations', 'specific examples from experience')
  }
  if (weakDims.includes('clarity')) {
    prefer.push('short punchy sentences', 'one idea per paragraph')
  }
  if (weakDims.includes('authority')) {
    prefer.push('confident assertions', 'direct voice')
  }
  if (weakDims.includes('originality')) {
    prefer.push('unexpected angles', 'contrarian takes', 'fresh metaphors')
  }
  if (weakDims.includes('engagement')) {
    prefer.push('open with tension', 'direct address with you')
  }

  return prefer
}

function deriveImagePreferences(weakAreas: string[]): string[] {
  const prefer: string[] = []

  if (weakAreas.includes('color_adherence')) {
    prefer.push('stick strictly to brand palette')
  }
  if (weakAreas.includes('style_match')) {
    prefer.push('closer match to reference images')
  }
  if (weakAreas.includes('mood_alignment')) {
    prefer.push('warmer, more inviting mood')
  }
  if (weakAreas.includes('technical_quality')) {
    prefer.push('simpler compositions', 'avoid complex scenes')
  }

  return prefer
}

// =============================================================================
// PROMPT INJECTION
// =============================================================================

/**
 * Get copy context to inject into generation prompt
 */
export function getCopyContext(brandName: string): string {
  const learnings = loadLearnings(brandName)
  if (!learnings || learnings.sample_size < 3) return ''

  const lines: string[] = []

  if (learnings.copy.avoid.length > 0) {
    lines.push(`AVOID: ${learnings.copy.avoid.join(', ')}`)
  }
  if (learnings.copy.prefer.length > 0) {
    lines.push(`PREFER: ${learnings.copy.prefer.join(', ')}`)
  }

  return lines.length > 0
    ? `\n[Based on ${learnings.sample_size} past evaluations]\n${lines.join('\n')}`
    : ''
}

/**
 * Get image context to inject into generation prompt
 */
export function getImageContext(brandName: string): string {
  const learnings = loadLearnings(brandName)
  if (!learnings || learnings.sample_size < 3) return ''

  const lines: string[] = []

  if (learnings.image.avoid.length > 0) {
    lines.push(`AVOID: ${learnings.image.avoid.join(', ')}`)
  }
  if (learnings.image.prefer.length > 0) {
    lines.push(`PREFER: ${learnings.image.prefer.join(', ')}`)
  }

  return lines.length > 0
    ? `\n[Based on ${learnings.sample_size} past evaluations]\n${lines.join('\n')}`
    : ''
}

// =============================================================================
// HELPERS
// =============================================================================

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function emptyLearnings(): Learnings {
  return {
    updated: new Date().toISOString().split('T')[0],
    sample_size: 0,
    copy: { weak_dimensions: [], common_red_flags: [], avoid: [], prefer: [] },
    image: { weak_areas: [], common_issues: [], avoid: [], prefer: [] }
  }
}

// =============================================================================
// CLI
// =============================================================================

export async function run(args: string[], _ctx?: CommandContext): Promise<Learnings> {
  const brand = args[0] || getDefaultBrand()

  console.log(`\nAggregating learnings for ${brand}...`)

  const learnings = aggregateLearnings(brand)
  saveLearnings(brand, learnings)

  console.log(`\nSample size: ${learnings.sample_size}`)
  console.log('\nCopy learnings:')
  console.log(`  Weak: ${learnings.copy.weak_dimensions.join(', ') || '(none)'}`)
  console.log(`  Avoid: ${learnings.copy.avoid.join(', ') || '(none)'}`)
  console.log(`  Prefer: ${learnings.copy.prefer.join(', ') || '(none)'}`)

  console.log('\nImage learnings:')
  console.log(`  Weak: ${learnings.image.weak_areas.join(', ') || '(none)'}`)
  console.log(`  Avoid: ${learnings.image.avoid.join(', ') || '(none)'}`)
  console.log(`  Prefer: ${learnings.image.prefer.join(', ') || '(none)'}`)

  return learnings
}
