/**
 * Copy command - Generate platform copy for a topic
 *
 * Usage:
 *   copy <brand> "<topic>" [--json]
 */

import { generateCopy, type CopyResult } from '../generate/copy'
import { classify } from '../generate/classify'
import { join, slugify, createSessionDir } from '../core/paths'
import { extractBrandTopic } from '../cli/args'
import { SLOP_WORDS } from '../core/slop'
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
  const parsed = extractBrandTopic(args)
  if (!parsed.topic) throw new Error('Missing topic. Usage: copy <brand> "<topic>"')

  const { brand, topic } = parsed

  console.log(`[copy] Topic: "${topic}", Brand: ${brand}`)

  const { copy, score, attempts } = await generateAndGradeCopy(topic, brand)

  const sessionDir = createSessionDir(slugify(topic))
  const outputPath = join(sessionDir, 'copy.md')
  writeFileSync(outputPath, formatCopyMarkdown(topic, copy, score))
  writeFileSync(join(sessionDir, 'copy.json'), JSON.stringify(copy, null, 2))
  console.log(`[copy] Saved: ${sessionDir}`)

  return {
    headline: copy.headline,
    twitter: copy.twitter,
    linkedin: copy.linkedin,
    instagram: copy.instagram,
    threads: copy.threads,
    imageDirection: copy.imageDirection,
    eval: { score, passed: score >= 60, attempts },
    outputPath
  }
}

/**
 * Generate copy with simple slop check + retry.
 * Used by both `copy` command and `explore`.
 */
export async function generateAndGradeCopy(
  topic: string,
  brand: string,
  hookPattern?: string
): Promise<{ copy: CopyResult; score: number; passed: boolean; attempts: number }> {
  const { contentType } = classify(topic)
  const maxRetries = 2

  let copy = await generateCopy(topic, brand, contentType, hookPattern)
  let { score, slopCount } = slopCheck(copy.linkedin.text)
  let attempts = 0

  console.log(`  Twitter: ${copy.twitter.text.length} chars, LinkedIn: ${copy.linkedin.text.length} chars`)
  logScore(score)

  while (score < 60 && attempts < maxRetries) {
    attempts++
    console.log(`[copy] Retry ${attempts}/${maxRetries} (slop: ${slopCount} words)...`)
    const feedback = `Rewrite. Remove these slop words/phrases: ${SLOP_WORDS.filter(w => copy.linkedin.text.toLowerCase().includes(w.toLowerCase())).join(', ')}. Be more direct and specific.`
    copy = await generateCopy(topic, brand, contentType, hookPattern, feedback)
    ;({ score, slopCount } = slopCheck(copy.linkedin.text))
    logScore(score)
  }

  return { copy, score, passed: score >= 60, attempts }
}

function slopCheck(text: string): { score: number; slopCount: number } {
  const lower = text.toLowerCase()
  const slopCount = SLOP_WORDS.filter(w => lower.includes(w.toLowerCase())).length
  // Start at 100, deduct 15 per slop word found
  const score = Math.max(0, 100 - slopCount * 15)
  return { score, slopCount }
}

function logScore(score: number): void {
  const bar = '\u2588'.repeat(Math.round(score / 10)) + '\u2591'.repeat(10 - Math.round(score / 10))
  console.log(`  Score: ${bar} ${score}/100 ${score >= 60 ? 'PASS' : 'FAIL'}`)
}

export function formatCopyMarkdown(topic: string, copy: CopyResult, score: number): string {
  return `# ${topic}

**Score: ${score}/100 ${score >= 60 ? 'PASS' : 'FAIL'}**

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
