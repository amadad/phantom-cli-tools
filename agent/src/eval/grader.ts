/**
 * Content Grader
 *
 * Evaluates generated content against brand-specific rubric.
 * Supports self-healing loop with retry on failure.
 */

import { GoogleGenAI } from '@google/genai'
import { readFileSync, existsSync, appendFileSync } from 'fs'
import yaml from 'js-yaml'
import { extractJson } from '../core/json'
import { getBrandRubricPath, getEvalLogPath, getDefaultBrand } from '../core/paths'
import type { CommandContext } from '../cli/types'

// =============================================================================
// TYPES
// =============================================================================

export interface Rubric {
  name: string
  version: string
  threshold: number
  max_retries: number
  dimensions: Record<string, DimensionConfig>
  banned_phrases: string[]
  red_flag_patterns: RedFlagPattern[]
  platforms: Record<string, PlatformLimits>
  judge_prompt: string
}

interface DimensionConfig {
  weight: number
  description: string
  rubric: Record<number, string>
}

export interface RedFlagPattern {
  pattern: string
  reason: string
  penalty: number
}

export interface PlatformLimits {
  max_chars: number
  max_hashtags: number
}

export interface EvalResult {
  passed: boolean
  score: number
  dimensions: Record<string, number>
  hard_fails: string[]
  red_flags: { pattern: string; reason: string; penalty: number }[]
  platform_issues: string[]
  critique: string
  suggestion?: string
}

export interface GradeOptions {
  platform?: string
  log?: boolean
}

// =============================================================================
// RUBRIC LOADING
// =============================================================================

const rubricCache = new Map<string, Rubric>()

export function loadRubric(brandName: string): Rubric {
  if (rubricCache.has(brandName)) {
    return rubricCache.get(brandName)!
  }

  const rubricPath = getBrandRubricPath(brandName)

  if (!existsSync(rubricPath)) {
    throw new Error(`Rubric not found: ${rubricPath}`)
  }

  const content = readFileSync(rubricPath, 'utf-8')
  const rubric = yaml.load(content) as Rubric

  rubricCache.set(brandName, rubric)
  return rubric
}

// =============================================================================
// HARD FAIL CHECKS (no LLM needed)
// =============================================================================

export function checkBannedPhrases(text: string, banned: string[]): string[] {
  const lower = text.toLowerCase()
  return banned.filter(phrase => lower.includes(phrase.toLowerCase()))
}

export function checkRedFlags(text: string, patterns: RedFlagPattern[]): RedFlagPattern[] {
  const lower = text.toLowerCase()
  return patterns.filter(p => {
    try {
      const regex = new RegExp(p.pattern, 'i')
      return regex.test(lower)
    } catch {
      return false // Skip invalid regex patterns
    }
  })
}

export function checkPlatformLimits(
  text: string,
  hashtags: string[],
  platform: string,
  limits: Record<string, PlatformLimits>
): string[] {
  const issues: string[] = []
  const config = limits[platform]

  if (!config) return issues

  if (text.length > config.max_chars) {
    issues.push(`Exceeds ${platform} limit: ${text.length}/${config.max_chars} chars`)
  }

  if (hashtags.length > config.max_hashtags) {
    issues.push(`Too many hashtags for ${platform}: ${hashtags.length}/${config.max_hashtags}`)
  }

  return issues
}

// =============================================================================
// LLM-AS-JUDGE
// =============================================================================

// JudgeResponse is dynamic based on rubric dimensions
interface JudgeResponse {
  [dimension: string]: number | string | undefined
  critique: string
  suggestion?: string
}

async function judgeContent(
  content: string,
  rubric: Rubric
): Promise<JudgeResponse> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const ai = new GoogleGenAI({ apiKey })

  const prompt = `${rubric.judge_prompt}

CONTENT TO EVALUATE:
"""
${content}
"""`

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const result = extractJson<JudgeResponse>(text, 'judge')

  if (!result.success) {
    // Fallback to neutral scores for all dimensions in this rubric
    const fallback: JudgeResponse = {
      critique: 'Could not parse evaluation'
    }
    for (const dim of Object.keys(rubric.dimensions)) {
      fallback[dim] = 5
    }
    return fallback
  }

  return result.data
}

// =============================================================================
// SCORE COMPUTATION
// =============================================================================

export function computeScore(
  dimensions: Record<string, number>,
  weights: Record<string, number>,
  redFlagPenalty: number
): number {
  let weighted = 0
  let totalWeight = 0

  for (const [dim, score] of Object.entries(dimensions)) {
    const weight = weights[dim] || 0.2
    weighted += score * weight
    totalWeight += weight
  }

  // Normalize to 0-100
  const base = (weighted / totalWeight) * 10

  // Apply red flag penalties
  const final = Math.max(0, base - redFlagPenalty)

  return Math.round(final)
}

// =============================================================================
// MAIN GRADER
// =============================================================================

export async function grade(
  content: string,
  brandName: string,
  options: GradeOptions = {}
): Promise<EvalResult> {
  const rubric = loadRubric(brandName)

  // 1. Check banned phrases (hard fail)
  const hardFails = checkBannedPhrases(content, rubric.banned_phrases)

  // 2. Check red flag patterns
  const redFlags = checkRedFlags(content, rubric.red_flag_patterns)
  const redFlagPenalty = redFlags.reduce((sum, rf) => sum + rf.penalty, 0)

  // 3. Check platform limits
  const hashtags = content.match(/#\w+/g) || []
  const platformIssues = options.platform
    ? checkPlatformLimits(content, hashtags, options.platform, rubric.platforms)
    : []

  // 4. LLM-as-Judge for dimensions
  const judge = await judgeContent(content, rubric)

  // Extract dimensions dynamically from rubric
  const dimensions: Record<string, number> = {}
  for (const dim of Object.keys(rubric.dimensions)) {
    const val = judge[dim]
    dimensions[dim] = typeof val === 'number' ? val : 5
  }

  // 5. Compute final score
  const weights = Object.fromEntries(
    Object.entries(rubric.dimensions).map(([k, v]) => [k, v.weight])
  )
  const score = computeScore(dimensions, weights, redFlagPenalty)

  // 6. Determine pass/fail
  const passed = hardFails.length === 0 && score >= rubric.threshold

  const result: EvalResult = {
    passed,
    score,
    dimensions,
    hard_fails: hardFails,
    red_flags: redFlags,
    platform_issues: platformIssues,
    critique: judge.critique,
    suggestion: judge.suggestion
  }

  // 7. Log if enabled
  if (options.log) {
    logEval(brandName, content, result)
  }

  return result
}

// =============================================================================
// LOGGING (for learning loop)
// =============================================================================

function logEval(brandName: string, content: string, result: EvalResult): void {
  const logPath = getEvalLogPath()

  const entry = {
    ts: new Date().toISOString(),
    brand: brandName,
    content_preview: content.slice(0, 100),
    score: result.score,
    passed: result.passed,
    dimensions: result.dimensions,
    hard_fails: result.hard_fails,
    red_flags: result.red_flags.map(rf => rf.pattern)
  }

  appendFileSync(logPath, JSON.stringify(entry) + '\n')
}

// =============================================================================
// SELF-HEALING LOOP
// =============================================================================

export interface RefineResult {
  content: string
  eval: EvalResult
  attempts: number
}

export async function gradeAndRefine(
  generateFn: (feedback?: string) => Promise<string>,
  brandName: string,
  options: GradeOptions = {}
): Promise<RefineResult> {
  const rubric = loadRubric(brandName)
  let attempts = 0
  let content = await generateFn()
  let result = await grade(content, brandName, options)

  while (!result.passed && attempts < rubric.max_retries) {
    attempts++
    console.log(`[grader] Attempt ${attempts}/${rubric.max_retries} - score: ${result.score}`)

    // Build feedback for regeneration
    const feedback = buildFeedback(result, rubric)

    // Regenerate with feedback
    content = await generateFn(feedback)
    result = await grade(content, brandName, options)
  }

  if (options.log) {
    logEval(brandName, content, result)
  }

  return { content, eval: result, attempts }
}

export function buildFeedback(result: EvalResult, rubric: Rubric): string {
  const parts: string[] = []

  if (result.hard_fails.length > 0) {
    parts.push(`REMOVE these banned phrases: ${result.hard_fails.join(', ')}`)
  }

  if (result.red_flags.length > 0) {
    const flags = result.red_flags.map(rf => `"${rf.pattern}" (${rf.reason})`)
    parts.push(`AVOID these patterns: ${flags.join('; ')}`)
  }

  // Find lowest dimensions
  const dims = Object.entries(result.dimensions)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)

  for (const [dim, score] of dims) {
    if (score < 7) {
      const config = rubric.dimensions[dim]
      parts.push(`IMPROVE ${dim.toUpperCase()} (scored ${score}/10): ${config.description}`)
    }
  }

  if (result.suggestion) {
    parts.push(`SUGGESTION: ${result.suggestion}`)
  }

  return parts.join('\n\n')
}

// =============================================================================
// CLI (for testing)
// =============================================================================

export async function run(args: string[], _ctx?: CommandContext): Promise<EvalResult> {
  const brand = args[0] || getDefaultBrand()
  const content = args.slice(1).join(' ') ||
    'Monday is hard. The mental load is heavy. Pick one thing to let go of today.'

  console.log(`\n[grader] Evaluating for ${brand}:`)
  console.log(`"${content.slice(0, 80)}..."`)

  const result = await grade(content, brand, { log: true })

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`SCORE: ${result.score}/100 ${result.passed ? '✓ PASS' : '✗ FAIL'}`)
  console.log(`${'─'.repeat(60)}`)

  console.log('\nDimensions:')
  for (const [dim, score] of Object.entries(result.dimensions)) {
    const bar = '█'.repeat(score) + '░'.repeat(10 - score)
    console.log(`  ${dim.padEnd(14)} ${bar} ${score}/10`)
  }

  if (result.hard_fails.length > 0) {
    console.log(`\nHard fails: ${result.hard_fails.join(', ')}`)
  }

  if (result.red_flags.length > 0) {
    console.log(`\nRed flags:`)
    for (const rf of result.red_flags) {
      console.log(`  - "${rf.pattern}" → ${rf.reason} (-${rf.penalty})`)
    }
  }

  console.log(`\nCritique: ${result.critique}`)
  if (result.suggestion) {
    console.log(`Suggestion: ${result.suggestion}`)
  }

  return result
}
