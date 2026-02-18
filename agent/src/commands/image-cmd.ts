/**
 * Image command - Generate brand-consistent image for a topic
 *
 * Usage:
 *   image <brand> "<topic>" [--pro] [--quick] [--style NAME] [--json]
 */

import { GoogleGenAI } from '@google/genai'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { loadBrand, resolvePalette, getPromptOverride, buildBrandContext } from '../core/brand'
import { join } from '../core/paths'
import { slugify, createSessionDir } from '../core/session'
import { parseArgs } from '../cli/args'
import { upscaleImage } from '../generate/upscale'
import {
  loadReferences,
  generateVariation,
  selectFromRefs,
  selectFromContactSheet,
  createContactSheet,
  type StyleVariation
} from '../generate/style-selection'
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
  forceStyle?: string
}

export async function run(args: string[], _ctx?: CommandContext): Promise<ImageCommandResult> {
  const parsed = parseArgs(args, ['style'])
  if (!parsed.topic) throw new Error('Missing topic. Usage: image <brand> "<topic>"')

  const brand = parsed.brand
  const topic = parsed.topic
  const opts: ImageOpts = {
    model: parsed.booleans.has('pro') ? 'pro' : 'flash',
    quickMode: parsed.booleans.has('quick'),
    forceStyle: parsed.flags.style
  }

  const suffix = opts.forceStyle ? `-${opts.forceStyle}` : opts.quickMode ? '-quick' : (opts.model === 'pro' ? '-pro' : '-flash')
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
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const brandConfig = loadBrand(brandName)
  const refs = loadReferences(brandName)
  if (refs.length === 0) throw new Error('No reference images found')
  console.log(`[image] Brand: ${brandName}, ${refs.length} styles`)

  const ai = new GoogleGenAI({ apiKey })
  const palette = resolvePalette(brandConfig)
  const promptOverride = getPromptOverride(brandConfig)
  const brandContext = buildBrandContext(brandConfig)
  const model = opts.model || 'flash'
  const { quickMode, forceStyle } = opts

  // Force style mode
  if (forceStyle) {
    const ref = refs.find(r => r.name === forceStyle)
    if (!ref) throw new Error(`Style not found: ${forceStyle}. Available: ${refs.map(r => r.name).join(', ')}`)

    console.log(`[image] Forced style: ${forceStyle}`)
    const result = await generateVariation(ai, topic, ref, palette, model, promptOverride)
    if (!result.image) throw new Error(`Generation failed: ${result.error || 'unknown error'}`)
    return { contentImage: await upscaleImage(result.image), selectedStyleName: forceStyle }
  }

  // Quick mode — agent picks from raw references
  if (quickMode) {
    console.log(`[image] Quick mode: selecting from references...`)
    const selection = await selectFromRefs(ai, topic, refs, brandContext)
    logSelection(selection)

    const ref = refs.find(r => r.name === selection.styleName)
    if (!ref) throw new Error('Selected style not found')

    const result = await generateVariation(ai, topic, ref, palette, model, promptOverride)
    if (!result.image) throw new Error(`Generation failed: ${result.error || 'unknown error'}`)
    return { contentImage: await upscaleImage(result.image), selectedStyleName: selection.styleName }
  }

  // Full mode — generate variations, create moodboard, agent picks
  const selectedRefs = refs.slice(0, 8)
  console.log(`[image] Generating ${selectedRefs.length} variations...`)

  const variations: StyleVariation[] = []
  for (let i = 0; i < selectedRefs.length; i += 4) {
    const batch = selectedRefs.slice(i, i + 4)
    console.log(`[image] Batch ${Math.floor(i / 4) + 1}/${Math.ceil(selectedRefs.length / 4)}...`)
    const results = await Promise.all(
      batch.map(ref => generateVariation(ai, topic, ref, palette, model, promptOverride))
    )
    for (const r of results) {
      console.log(r.image ? `  OK ${r.name}` : `  FAIL ${r.name}: ${r.error}`)
    }
    variations.push(...results)
  }

  const successful = variations.filter(v => v.image)
  if (successful.length === 0) throw new Error('No images generated')
  console.log(`[image] Generated ${successful.length}/${selectedRefs.length} images`)

  // Save moodboard and variations
  const contactSheet = await createContactSheet(variations)
  writeFileSync(join(opts.outputDir, 'moodboard.png'), contactSheet)

  const variationsDir = join(opts.outputDir, '.variations')
  mkdirSync(variationsDir, { recursive: true })
  const variationPaths: Record<string, string> = {}
  for (const v of successful) {
    const varPath = join(variationsDir, `${v.name}.png`)
    writeFileSync(varPath, v.image!)
    variationPaths[v.name] = varPath
  }

  // Agent selection
  console.log('\n[image] Agent selecting...')
  const selection = await selectFromContactSheet(ai, contactSheet, topic, successful.map(v => v.name), brandContext)
  logSelection(selection)

  const selectedPath = variationPaths[selection.styleName]
  if (!selectedPath) throw new Error('Selected variation not found')
  return {
    contentImage: await upscaleImage(readFileSync(selectedPath)),
    selectedStyleName: selection.styleName
  }
}

function logSelection(s: { styleName: string; confidence: string; reasoning: string }): void {
  console.log(`${'─'.repeat(60)}`)
  console.log(`SELECTED: ${s.styleName}  CONFIDENCE: ${s.confidence}`)
  console.log(`REASONING: ${s.reasoning}`)
  console.log(`${'─'.repeat(60)}`)
}
