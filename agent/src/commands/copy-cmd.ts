/**
 * Copy command - Generate platform copy for a topic
 *
 * Usage:
 *   copy <brand> "<topic>" [--hook "pattern"] [--json]
 */

import { generateCopy, type CopyResult } from '../generate/copy'
import { classify } from '../generate/classify'
import { grade, loadRubric, buildFeedback } from '../eval/grader'
import { getHookForTopic } from '../intel/hook-bank'
import { join } from '../core/paths'
import { slugify, createSessionDir } from '../core/session'
import { parseArgs } from '../cli/args'
import { writeFileSync } from 'fs'
import type { CommandContext } from '../cli/types'

export interface CopyCommandResult {
  headline: string
  twitter: { text: string; hashtags: string[] }
  linkedin: { text: string; hashtags: string[] }
  instagram: { text: string; hashtags: string[] }
  threads: { text: string; hashtags: string[] }
  imageDirection: string
  eval: { score: number; passed: boolean; attempts: number }
  outputPath: string
}

export async function run(args: string[], _ctx?: CommandContext): Promise<CopyCommandResult> {
  const parsed = parseArgs(args, ['hook'])
  if (!parsed.topic) throw new Error('Missing topic. Usage: copy <brand> "<topic>"')

  const { brand, topic } = parsed
  const hookArg = parsed.flags.hook

  console.log(`[copy] Topic: "${topic}", Brand: ${brand}`)

  // Resolve hook
  let hookPattern = hookArg
  if (!hookPattern) {
    try {
      const found = getHookForTopic(brand, topic)
      if (found) {
        hookPattern = found.amplified || found.original
        console.log(`  Hook [${found.multiplier}x]: "${hookPattern.slice(0, 50)}..."`)
      }
    } catch { /* Hook bank might not exist */ }
  }

  const { copy, evalResult, attempts } = await generateAndGradeCopy(topic, brand, hookPattern)

  // Write both copy.md (human) and copy.json (machine)
  const sessionDir = createSessionDir(slugify(topic))
  const outputPath = join(sessionDir, 'copy.md')
  writeFileSync(outputPath, formatCopyMarkdown(topic, copy, evalResult))
  writeFileSync(join(sessionDir, 'copy.json'), JSON.stringify(copy, null, 2))
  console.log(`[copy] Saved: ${sessionDir}`)

  return {
    headline: copy.headline,
    twitter: copy.twitter,
    linkedin: copy.linkedin,
    instagram: copy.instagram,
    threads: copy.threads,
    imageDirection: copy.imageDirection,
    eval: { score: evalResult.score, passed: evalResult.passed, attempts },
    outputPath
  }
}

/**
 * Generate copy with eval grading + retry loop.
 * Used by both `copy` command and `explore`.
 */
export async function generateAndGradeCopy(
  topic: string,
  brand: string,
  hookPattern?: string
): Promise<{ copy: CopyResult; evalResult: ReturnType<typeof grade> extends Promise<infer R> ? R : never; attempts: number }> {
  const { contentType } = classify(topic)
  const rubric = loadRubric(brand)
  const maxRetries = rubric.max_retries || 2

  let copy = await generateCopy(topic, brand, contentType, hookPattern)
  let evalResult = await grade(copy.linkedin.text, brand, { platform: 'linkedin', log: true })
  let attempts = 0

  console.log(`  Twitter: ${copy.twitter.text.length} chars, LinkedIn: ${copy.linkedin.text.length} chars`)
  logScore(evalResult)

  while (!evalResult.passed && attempts < maxRetries) {
    attempts++
    console.log(`[copy] Retry ${attempts}/${maxRetries}...`)
    const feedback = buildFeedback(evalResult, rubric) + `\n\nCRITIQUE: ${evalResult.critique}`
    copy = await generateCopy(topic, brand, contentType, hookPattern, feedback)
    evalResult = await grade(copy.linkedin.text, brand, { platform: 'linkedin', log: true })
    logScore(evalResult)
  }

  if (!evalResult.passed) {
    console.log(`  Below threshold after ${attempts} retries. Critique: ${evalResult.critique}`)
  }
  if (evalResult.hard_fails.length > 0) {
    console.log(`  Hard fails: ${evalResult.hard_fails.join(', ')}`)
  }

  return { copy, evalResult, attempts }
}

function logScore(result: { score: number; passed: boolean }): void {
  const bar = '█'.repeat(Math.round(result.score / 10)) + '░'.repeat(10 - Math.round(result.score / 10))
  console.log(`  Score: ${bar} ${result.score}/100 ${result.passed ? 'PASS' : 'FAIL'}`)
}

function formatCopyMarkdown(topic: string, copy: CopyResult, evalResult: { score: number; passed: boolean; critique?: string; dimensions: Record<string, number> }): string {
  const dimScores = Object.entries(evalResult.dimensions).map(([k, v]) => `${k}: ${v}/10`).join(' | ')
  return `# ${topic}

**Eval: ${evalResult.score}/100 ${evalResult.passed ? 'PASS' : 'FAIL'}** (${dimScores})
${evalResult.critique ? `\n> ${evalResult.critique}\n` : ''}
## Twitter
${copy.twitter.text}

${copy.twitter.hashtags.map(h => `#${h}`).join(' ')}

## LinkedIn
${copy.linkedin.text}

${copy.linkedin.hashtags.map(h => `#${h}`).join(' ')}

## Instagram
${copy.instagram.text}

${copy.instagram.hashtags.map(h => `#${h}`).join(' ')}

## Threads
${copy.threads.text}

${copy.threads.hashtags.map(h => `#${h}`).join(' ')}
`
}
