/**
 * Explore command - Generate brand content (convenience wrapper)
 *
 * Chains: copy → image → poster → enqueue → notify.
 * Each step is also available as a standalone command.
 *
 * Usage:
 *   explore <brand> "<topic>" [--pro] [--quick] [--no-logo] [--volume=<zone>] [--json]
 */

import { randomUUID } from 'crypto'
import { writeFileSync, existsSync } from 'fs'
import { join, slugify, createSessionDir } from '../core/paths'
import { extractBrandTopic } from '../cli/args'
import { generateBrandImage, parseVolume } from './image-cmd'
import { generateAndGradeCopy, formatCopyMarkdown } from './copy-cmd'
import { generateFinals } from './poster-cmd'
import { addToQueue } from '../queue'
import { notifyContentQueue } from '../notify/discord-queue'
import { loadBrandVisual } from '../core/visual'
import { canRenderWithImage } from '../composite/layouts'
import { renderGradientBuffer, GRADIENT_PRESETS, presetFromPalette } from '../composite/renderer/gradient'
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
  const parsed = extractBrandTopic(args, ['volume', 'gradient', 'texture', 'layout'], ['pro', 'quick', 'no-logo', 'json', 'nano', 'pixel-sort'])
  if (!parsed.topic) throw new Error('Missing topic. Usage: explore <brand> "<topic>"')

  const brand = parsed.brand
  const topic = parsed.topic
  const model: 'flash' | 'pro' = parsed.booleans.has('pro') ? 'pro' : 'flash'
  const quickMode = parsed.booleans.has('quick')
  const noLogo = parsed.booleans.has('no-logo')
  const nano = parsed.booleans.has('nano')
  const doPixelSort = parsed.booleans.has('pixel-sort')
  const gradientPreset = parsed.flags.gradient
  const useGradient = gradientPreset !== undefined
  const textureStyle = parsed.flags.texture
  const useTexture = textureStyle !== undefined
  const layoutOverride = parsed.flags.layout as import('../core/visual').LayoutName | undefined
  if (parsed.booleans.has('volume')) {
    throw new Error('Missing --volume value. Use --volume <zone>')
  }
  const volume = parseVolume(parsed.flags.volume)

  const modeLabel = useTexture ? 'texture' : useGradient ? 'gradient' : (quickMode ? 'quick' : 'full')
  const modelName = useTexture ? `texture:${textureStyle || 'watercolor'}` : useGradient ? 'gradient' : (model === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image')
  console.log(`\n[explore] Topic: "${topic}", Brand: ${brand}, Mode: ${modeLabel}${useGradient ? `, Preset: ${gradientPreset || 'brand-palette'}` : `, Model: ${modelName}`}${nano ? ', Poster: nano' : ''}`)

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

  const { copy, score, passed, attempts } = await generateAndGradeCopy(topic, brand)

  // === Step 2: Image (gradient or Gemini) ===
  const imageDirection = copy.imageDirection || topic

  if (useTexture && !isTypeOnly) {
    // Texture mode — render p5.brush texture via Pinch Tab
    const { run: runTexture } = await import('./texture-cmd')
    const style = textureStyle || 'watercolor'
    const texturePath = join(sessionDir, 'selected.png')
    console.log(`\n[explore] Generating texture image (style: ${style})`)
    await runTexture([brand, `--style=${style}`, '--size=1200x1200', `--out=${texturePath}`])
    const { readFileSync } = await import('fs')
    contentImage = readFileSync(texturePath)
    selectedStyleName = `texture:${style}`
    console.log(`Selected: ${texturePath}`)
  } else if (useGradient && !isTypeOnly) {
    // Gradient mode — render mesh gradient as the content image
    const preset = (gradientPreset && GRADIENT_PRESETS[gradientPreset])
      ? GRADIENT_PRESETS[gradientPreset]
      : presetFromPalette(
          [visual.palette.background, visual.palette.warm ?? visual.palette.background, visual.palette.accent, visual.palette.primary].filter(Boolean),
          { angle: 140, noiseScale: 0.7, noiseIntensity: 14 },
        )
    const resolvedName = (gradientPreset && GRADIENT_PRESETS[gradientPreset]) ? gradientPreset : `${brand}-palette`
    console.log(`\n[explore] Generating gradient image (preset: ${resolvedName})`)
    // Use 1200x1200 so it works for all aspect ratios (cover scaling will crop)
    contentImage = renderGradientBuffer(1200, 1200, preset)
    selectedStyleName = `gradient:${resolvedName}`
    const selectedImgPath = join(sessionDir, 'selected.png')
    writeFileSync(selectedImgPath, contentImage)
    console.log(`Selected: ${selectedImgPath}`)
  } else if (!isTypeOnly) {
    console.log(`\n[explore] Generating image from direction: "${imageDirection.slice(0, 60)}..."`)
    const imgResult = await generateBrandImage(brand, imageDirection, {
      model, quickMode, outputDir: sessionDir, volume
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
  writeFileSync(join(sessionDir, 'copy.md'), formatCopyMarkdown(topic, copy, score))
  writeFileSync(join(sessionDir, 'copy.json'), JSON.stringify(copy, null, 2))

  // === Step 3: Poster finals ===
  console.log(`\n[explore] Generating finals...`)
  const headline = copy.headline || topic.split(/[.!?]/)[0]
  // Default to overlay layout for texture/gradient (full-bleed background + text on top)
  const effectiveLayout = layoutOverride ?? ((useTexture || useGradient) ? 'overlay' as const : undefined)
  const posterOutputs = await generateFinals(brand, headline, contentImage, { noLogo, outputDir: sessionDir, topic, volume, nano, pixelSort: doPixelSort, layout: effectiveLayout })

  const expectedPlatforms = ['twitter', 'instagram', 'story']
  const missingPlatforms = expectedPlatforms.filter((p) => !posterOutputs[p])
  if (missingPlatforms.length > 0) {
    console.warn(`[explore] Missing poster outputs: ${missingPlatforms.join(', ')}`)
  }

  // === Step 4: Queue + notify ===
  // Use first available poster for queue image, prefer twitter
  const queueImagePath = posterOutputs.twitter ?? posterOutputs.instagram ?? posterOutputs.story
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
    image: isTypeOnly ? undefined : (queueImagePath ? {
      url: queueImagePath,
      prompt: topic,
      model: modelName
    } : undefined)
  }

  addToQueue(queueItem)
  console.log(`[explore] Queued: ${queueItem.id}`)

  // Use best available poster for Discord notification
  const notifyImagePath = posterOutputs[isTypeOnly ? 'instagram' : 'twitter']
    ?? Object.values(posterOutputs)[0]

  if (!notifyImagePath || !existsSync(notifyImagePath)) {
    console.warn(`[explore] No poster available for Discord notification`)
  }

  notifyContentQueue({
    item: queueItem,
    imagePath: notifyImagePath ?? join(sessionDir, 'twitter.png'),
    evalScore: score,
    evalPassed: passed,
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
    eval: { score, passed, attempts },
    queueId: queueItem.id,
    outputs: { selected: isTypeOnly ? '' : join(sessionDir, 'selected.png'), copy: join(sessionDir, 'copy.md') }
  }
}
