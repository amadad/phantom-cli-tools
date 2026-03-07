/**
 * Image command - Generate brand-consistent image for a topic
 *
 * Usage:
 *   image <brand> "<topic>" [--quick] [--pro] [--volume=<zone>] [--knockout] [--json]
 */

import { writeFileSync } from 'fs'
import { join, slugify, createSessionDir } from '../core/paths'
import { extractBrandTopic } from '../cli/args'
import { upscaleImage } from '../generate/upscale'
import { generateImage } from '../generate/image'
import { classify } from '../generate/classify'
import type { CommandContext } from '../cli/types'

export interface ImageCommandResult {
  imagePath: string
  style: string
  model: string
  outputDir: string
}

export interface ImageOpts {
  model?: 'flash' | 'pro'
  quickMode?: boolean
  /** Remove background — output transparent PNG */
  knockout?: boolean
  volume?: string
}

export function parseVolume(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : undefined
}

export async function run(args: string[], _ctx?: CommandContext): Promise<ImageCommandResult> {
  const parsed = extractBrandTopic(args, ['volume'], ['pro', 'quick', 'knockout', 'json'])
  if (!parsed.topic) throw new Error('Missing topic. Usage: image <brand> "<topic>"')

  const brand = parsed.brand
  const topic = parsed.topic
  if (parsed.booleans.has('volume')) {
    throw new Error('Missing --volume value. Use --volume <zone>')
  }
  const volume = parseVolume(parsed.flags.volume)
  if (volume && volume.includes(',')) {
    throw new Error('Invalid --volume format. Use a single zone name, not a comma-separated list.')
  }

  const opts: ImageOpts = {
    model: parsed.booleans.has('pro') ? 'pro' : 'flash',
    quickMode: parsed.booleans.has('quick'),
    knockout: parsed.booleans.has('knockout'),
    volume
  }

  const suffix = opts.quickMode ? '-quick' : (opts.model === 'pro' ? '-pro' : '-flash')
  const outputDir = createSessionDir(slugify(topic), suffix)

  const result = await generateBrandImage(brand, topic, { ...opts, outputDir })

  const imagePath = join(outputDir, 'selected.png')
  writeFileSync(imagePath, result.contentImage)
  console.log(`[image] Saved: ${imagePath}`)

  const modelName = opts.model === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image'
  return { imagePath, style: result.selectedStyleName, model: modelName, outputDir }
}

/**
 * Self-contained image generation. Takes brand name, does all setup internally.
 * Used by both `image` command and `explore`.
 */
export async function generateBrandImage(
  brandName: string,
  topic: string,
  opts: ImageOpts & { outputDir: string }
): Promise<{ contentImage: Buffer; selectedStyleName: string }> {
  const { imageType } = classify(topic)
  console.log(`[image] Brand: ${brandName}, Type: ${imageType}`)

  const result = await generateImage(
    imageType, topic, brandName,
    undefined, undefined, undefined,
    opts.knockout,
    opts.volume,
  )
  if (!result) throw new Error('Image generation failed — all providers returned null')

  const rawImage = Buffer.from(result.b64, 'base64')
  const contentImage = opts.quickMode ? rawImage : await upscaleImage(rawImage)

  return { contentImage, selectedStyleName: imageType }
}
