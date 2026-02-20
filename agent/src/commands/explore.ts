/**
 * Explore command - Generate brand content (convenience wrapper)
 *
 * Chains: image → copy → grade → poster → enqueue → notify.
 * Each step is also available as a standalone command.
 *
 * Usage:
 *   explore <brand> "<topic>" [--pro] [--quick] [--no-logo] [--json]
 */

import { randomUUID } from 'crypto'
import { writeFileSync } from 'fs'
import { join, slugify, createSessionDir } from '../core/paths'
import { extractBrandTopic } from '../cli/args'
import { generateBrandImage } from './image-cmd'
import { generateAndGradeCopy, formatCopyMarkdown } from './copy-cmd'
import { generateFinals } from './poster-cmd'
import { getHookForTopic } from '../intel/hook-bank'
import { addToQueue } from '../queue'
import { notifyContentQueue } from '../notify/discord-queue'
import { loadBrandVisual } from '../core/visual'
import { canRenderWithImage } from '../composite/layouts'
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
  const parsed = extractBrandTopic(args, [])
  if (!parsed.topic) throw new Error('Missing topic. Usage: explore <brand> "<topic>"')

  const brand = parsed.brand
  const topic = parsed.topic
  const model: 'flash' | 'pro' = parsed.booleans.has('pro') ? 'pro' : 'flash'
  const quickMode = parsed.booleans.has('quick')
  const noLogo = parsed.booleans.has('no-logo')

  const modeLabel = quickMode ? 'quick' : 'full'
  const modelName = model === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image'
  console.log(`\n[explore] Topic: "${topic}", Brand: ${brand}, Mode: ${modeLabel}, Model: ${modelName}`)

  // Session directory
  const suffix = quickMode ? '-quick' : (model === 'pro' ? '-pro' : '-flash')
  const sessionDir = createSessionDir(slugify(topic), suffix)

  // === Step 1: Image (or type-only probe) ===
  // Probe: pick layout for this topic. If type-only is selected, skip image gen.
  let contentImage: Buffer | undefined
  let selectedStyleName: string | null = null
  let isTypeOnly = false

  const visual = loadBrandVisual(brand)
  // Check if brand can meaningfully render image-backed layouts
  if (!canRenderWithImage(visual)) {
    isTypeOnly = true
    console.log(`[explore] Brand only has type-only layouts → skipping image gen`)
  }

  // === Step 1: Copy first (fast — 1 LLM call gives us imageDirection) ===
  console.log(`\n[explore] Generating copy...`)
  let hookPattern: string | undefined
  try {
    const hook = getHookForTopic(brand, topic)
    if (hook) {
      hookPattern = hook.amplified || hook.original
      console.log(`  Hook [${hook.multiplier}x]: "${hookPattern.slice(0, 50)}..."`)
    }
  } catch { console.debug('[explore] No hook bank found') }

  const { copy, evalResult, attempts } = await generateAndGradeCopy(topic, brand, hookPattern)

  // === Step 2: Image driven by copy's imageDirection ===
  const imageDirection = copy.imageDirection || topic

  if (!isTypeOnly) {
    console.log(`\n[explore] Generating image from direction: "${imageDirection.slice(0, 60)}..."`)
    const imgResult = await generateBrandImage(brand, imageDirection, {
      model, quickMode, outputDir: sessionDir
    })
    contentImage = imgResult.contentImage
    selectedStyleName = imgResult.selectedStyleName
    const selectedImgPath = join(sessionDir, 'selected.png')
    writeFileSync(selectedImgPath, contentImage)
    console.log(`Selected: ${selectedImgPath}`)
  } else {
    console.log(`[explore] Type-only post — no image generated`)
  }

  // Save copy files
  writeFileSync(join(sessionDir, 'copy.md'), formatCopyMarkdown(topic, copy, evalResult))
  writeFileSync(join(sessionDir, 'copy.json'), JSON.stringify(copy, null, 2))

  // === Step 3: Poster finals ===
  console.log(`\n[explore] Generating finals...`)
  const headline = copy.headline || topic.split(/[.!?]/)[0]
  await generateFinals(brand, headline, contentImage, { noLogo, outputDir: sessionDir, topic })

  // === Step 4: Queue + notify ===
  const now = new Date().toISOString()
  const queueItem: QueueItem = {
    id: `gen_${randomUUID()}`,
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
    image: isTypeOnly ? undefined : {
      url: join(sessionDir, 'twitter.png'),
      prompt: topic,
      model: modelName
    }
  }

  addToQueue(queueItem)
  console.log(`[explore] Queued: ${queueItem.id}`)

  notifyContentQueue({
    item: queueItem,
    imagePath: join(sessionDir, isTypeOnly ? 'instagram.png' : 'twitter.png'),
    evalScore: evalResult.score,
    evalPassed: evalResult.passed,
    platform: 'Instagram',
    format: isTypeOnly ? 'type-only' : (selectedStyleName ?? undefined),
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
    selectedStyle: selectedStyleName ?? 'type-only',
    eval: { score: evalResult.score, passed: evalResult.passed, attempts },
    queueId: queueItem.id,
    outputs: { selected: isTypeOnly ? '' : join(sessionDir, 'selected.png'), copy: join(sessionDir, 'copy.md') }
  }
}
