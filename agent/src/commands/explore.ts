/**
 * Explore command - Generate brand content (convenience wrapper)
 *
 * Chains: image → copy → grade → poster → enqueue → notify.
 * Each step is also available as a standalone command.
 *
 * Usage:
 *   explore <brand> "<topic>" [--pro] [--quick] [--style NAME] [--no-logo] [--json]
 */

import { writeFileSync } from 'fs'
import { join } from '../core/paths'
import { slugify, createSessionDir } from '../core/session'
import { parseArgs } from '../cli/args'
import { generateBrandImage } from './image-cmd'
import { generateAndGradeCopy } from './copy-cmd'
import { generateFinals } from './poster-cmd'
import { getHookForTopic } from '../intel/hook-bank'
import { addToQueue } from '../queue'
import { notifyContentQueue } from '../notify/discord-queue'
import type { QueueItem } from '../core/types'
import type { CommandContext } from '../cli/types'

export interface ExploreResult {
  brand: string
  topic: string
  mode: string
  model: string
  outputDir: string
  selectedStyle: string
  eval: { score: number; passed: boolean; attempts: number }
  queueId: string
  outputs: { selected: string; copy: string }
}

export async function run(args: string[], _ctx?: CommandContext): Promise<ExploreResult> {
  const parsed = parseArgs(args, ['style'])
  if (!parsed.topic) throw new Error('Missing topic. Usage: explore <brand> "<topic>"')

  const brand = parsed.brand
  const topic = parsed.topic
  const model: 'flash' | 'pro' = parsed.booleans.has('pro') ? 'pro' : 'flash'
  const quickMode = parsed.booleans.has('quick')
  const forceStyle = parsed.flags.style
  const noLogo = parsed.booleans.has('no-logo')

  const modeLabel = forceStyle ? `style:${forceStyle}` : quickMode ? 'quick' : 'full'
  const modelName = model === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image'
  console.log(`\n[explore] Topic: "${topic}", Brand: ${brand}, Mode: ${modeLabel}, Model: ${modelName}`)

  // Session directory
  const suffix = forceStyle ? `-${forceStyle}` : quickMode ? '-quick' : (model === 'pro' ? '-pro' : '-flash')
  const sessionDir = createSessionDir(slugify(topic), suffix)

  // === Step 1: Image ===
  const { contentImage, selectedStyleName } = await generateBrandImage(brand, topic, {
    model, quickMode, forceStyle, outputDir: sessionDir
  })
  const selectedImgPath = join(sessionDir, 'selected.png')
  writeFileSync(selectedImgPath, contentImage)
  console.log(`\nSelected: ${selectedImgPath}`)

  // === Step 2: Copy + eval ===
  console.log(`\n[explore] Generating copy...`)
  let hookPattern: string | undefined
  try {
    const hook = getHookForTopic(brand, topic)
    if (hook) {
      hookPattern = hook.amplified || hook.original
      console.log(`  Hook [${hook.multiplier}x]: "${hookPattern.slice(0, 50)}..."`)
    }
  } catch { /* Hook bank might not exist */ }

  const { copy, evalResult, attempts } = await generateAndGradeCopy(topic, brand, hookPattern)

  // Save copy files
  const dimScores = Object.entries(evalResult.dimensions).map(([k, v]) => `${k}: ${v}/10`).join(' | ')
  writeFileSync(join(sessionDir, 'copy.md'), `# ${topic}

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
`)
  writeFileSync(join(sessionDir, 'copy.json'), JSON.stringify(copy, null, 2))

  // === Step 3: Poster finals ===
  console.log(`\n[explore] Generating finals...`)
  const headline = copy.headline || topic.split(/[.!?]/)[0]
  await generateFinals(brand, headline, contentImage, { noLogo, outputDir: sessionDir })

  // === Step 4: Queue + notify ===
  const now = new Date().toISOString()
  const queueItem: QueueItem = {
    id: `gen_${Date.now()}`,
    brand,
    source: { type: 'manual', topic, brandName: brand },
    stage: 'review',
    createdAt: now,
    updatedAt: now,
    requiresApproval: false,
    content: {
      topic,
      twitter: copy.twitter,
      linkedin: copy.linkedin,
      instagram: copy.instagram,
      threads: copy.threads
    },
    image: {
      url: join(sessionDir, 'twitter.png'),
      prompt: topic,
      model: modelName
    }
  }

  addToQueue(queueItem)
  console.log(`[explore] Queued: ${queueItem.id}`)

  notifyContentQueue({
    item: queueItem,
    imagePath: join(sessionDir, 'twitter.png'),
    evalScore: evalResult.score,
    evalPassed: evalResult.passed,
    platform: 'Instagram',
    format: selectedStyleName ?? undefined,
  }).catch((e: Error) => {
    console.warn(`[explore] Discord notify failed: ${e.message}`)
  })

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Output: ${sessionDir}`)
  console.log(`${'─'.repeat(60)}`)

  return {
    brand,
    topic,
    mode: modeLabel,
    model: modelName,
    outputDir: sessionDir,
    selectedStyle: selectedStyleName,
    eval: { score: evalResult.score, passed: evalResult.passed, attempts },
    queueId: queueItem.id,
    outputs: { selected: selectedImgPath, copy: join(sessionDir, 'copy.md') }
  }
}
