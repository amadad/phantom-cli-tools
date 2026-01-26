/**
 * Explore command - Generate brand content with agentic style selection
 *
 * Usage:
 *   explore <brand> "<topic>" [options]
 *
 * Options:
 *   --pro          Use Gemini 3 Pro (higher quality, ~$0.25)
 *   --quick        Skip moodboard, generate once from agent's pick
 *   --style NAME   Force specific style (e.g., --style style09)
 *
 * Modes:
 *   Full:   Generate 6 variations → moodboard → agent picks → upscale → finals
 *   Quick:  Agent picks from refs → generate once → upscale → finals
 *   Style:  Use specified style → generate once → upscale → finals
 */

import { GoogleGenAI } from '@google/genai'
import sharp from 'sharp'
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'fs'
import { loadBrand } from '../core/brand'
import { getOutputDir, getBrandDir, join, getDefaultBrand } from '../core/paths'
import { generatePoster } from '../composite/poster'
import { generateCopy } from '../generate/copy'
import { classify } from '../generate/classify'
import { grade, loadRubric, buildFeedback } from '../eval/grader'
import { getHookForTopic } from '../intel/hook-bank'
import { addToQueue } from '../queue'
import type { QueueItem } from '../core/types'
import type { CommandContext } from '../cli/types'

interface StyleVariation {
  name: string
  refPath: string
  image?: Buffer
  error?: string
}

interface SelectionResult {
  styleName: string
  reasoning: string
  confidence: 'high' | 'medium' | 'low'
}

export interface ExploreResult {
  brand: string
  topic: string
  mode: string
  model: string
  outputDir: string
  selectedStyle: string
  eval: {
    score: number
    passed: boolean
    attempts: number
  }
  queueId: string
  outputs: {
    selected: string
    copy: string
  }
}

/**
 * Upscale image using Replicate Real-ESRGAN (4x)
 */
async function upscaleImage(imageBuffer: Buffer): Promise<Buffer> {
  const replicateToken = process.env.REPLICATE_API_TOKEN
  if (!replicateToken) {
    console.log('[explore] No REPLICATE_API_TOKEN, skipping upscale')
    return imageBuffer
  }

  console.log('[explore] Upscaling with Real-ESRGAN...')

  // Lazy import to avoid loading when not needed
  const Replicate = (await import('replicate')).default
  const replicate = new Replicate()
  const dataUri = `data:image/png;base64,${imageBuffer.toString('base64')}`

  try {
    const output = await replicate.run('nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa', {
      input: {
        image: dataUri,
        scale: 4,
        face_enhance: false
      }
    })

    // Fetch result
    const url = typeof output === 'string' ? output : (output as any)?.url?.() || output
    const response = await fetch(url as string)
    const resultBuffer = Buffer.from(await response.arrayBuffer())

    console.log('[explore] Upscaled 4x')
    return resultBuffer
  } catch (e: any) {
    console.log(`[explore] Upscale failed: ${e.message}, using original`)
    return imageBuffer
  }
}

/**
 * Agent selects style from original references (quick mode)
 */
async function selectFromRefs(
  ai: GoogleGenAI,
  topic: string,
  refs: StyleVariation[],
  brandContext: string
): Promise<SelectionResult> {
  // Create a simple grid of original references
  const cellSize = 300
  const cols = 3
  const rows = Math.ceil(refs.length / cols)
  const width = cols * cellSize
  const height = rows * (cellSize + 30)

  const overlays: sharp.OverlayOptions[] = []

  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = col * cellSize
    const y = row * (cellSize + 30)

    const resized = await sharp(ref.refPath)
      .resize(cellSize, cellSize, { fit: 'cover' })
      .png()
      .toBuffer()

    overlays.push({ input: resized, left: x, top: y })

    const labelSvg = Buffer.from(`<svg width="${cellSize}" height="30">
      <rect width="100%" height="100%" fill="#1E1B16"/>
      <text x="8" y="22" font-family="sans-serif" font-size="14" fill="#FDFBF7">${ref.name}</text>
    </svg>`)
    overlays.push({ input: labelSvg, left: x, top: y + cellSize })
  }

  const refSheet = await sharp({
    create: { width, height, channels: 4, background: { r: 253, g: 251, b: 247, alpha: 1 } }
  }).composite(overlays).png().toBuffer()

  const prompt = `You are a creative director selecting a visual style for social media content.

TOPIC: "${topic}"
BRAND: ${brandContext}

These are 6 reference style images. Each has a distinct aesthetic. Pick the ONE that best matches the topic emotionally and visually.

Styles shown:
${refs.map((r, i) => `${i + 1}. ${r.name}`).join('\n')}

RESPOND IN THIS EXACT FORMAT:
STYLE: [exact style name]
CONFIDENCE: [high/medium/low]
REASONING: [1-2 sentences]`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/png', data: refSheet.toString('base64') } },
          { text: prompt }
        ]
      }]
    })

    const text = (response as any).candidates?.[0]?.content?.parts?.[0]?.text || ''
    const styleMatch = text.match(/STYLE:\s*(.+)/i)
    const confidenceMatch = text.match(/CONFIDENCE:\s*(high|medium|low)/i)
    const reasoningMatch = text.match(/REASONING:\s*(.+)/is)

    return {
      styleName: styleMatch?.[1]?.trim() || refs[0].name,
      confidence: (confidenceMatch?.[1]?.toLowerCase() || 'medium') as 'high' | 'medium' | 'low',
      reasoning: reasoningMatch?.[1]?.trim() || 'Default selection'
    }
  } catch (e: any) {
    return { styleName: refs[0].name, confidence: 'low', reasoning: 'Fallback due to error' }
  }
}

/**
 * Agent selects best style from contact sheet
 */
async function selectStyle(
  ai: GoogleGenAI,
  contactSheet: Buffer,
  topic: string,
  styleNames: string[],
  brandContext: string
): Promise<SelectionResult> {
  const prompt = `You are a creative director selecting the best visual style for a social media post.

TOPIC: "${topic}"

BRAND CONTEXT: ${brandContext}

The contact sheet shows ${styleNames.length} different visual styles, each labeled at the bottom:
${styleNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}

TASK: Pick the ONE style that best matches the topic and brand. Consider:
- Emotional resonance with the topic
- Brand alignment (warm, empowering, not clinical)
- Visual impact for social media

RESPOND IN THIS EXACT FORMAT:
STYLE: [exact style name from the list]
CONFIDENCE: [high/medium/low]
REASONING: [1-2 sentences explaining why this style fits]`

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/png', data: contactSheet.toString('base64') } },
          { text: prompt }
        ]
      }]
    })

    const text = (response as any).candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Parse response
    const styleMatch = text.match(/STYLE:\s*(.+)/i)
    const confidenceMatch = text.match(/CONFIDENCE:\s*(high|medium|low)/i)
    const reasoningMatch = text.match(/REASONING:\s*(.+)/is)

    const styleName = styleMatch?.[1]?.trim() || styleNames[0]
    const confidence = (confidenceMatch?.[1]?.toLowerCase() || 'medium') as 'high' | 'medium' | 'low'
    const reasoning = reasoningMatch?.[1]?.trim() || 'Default selection'

    return { styleName, confidence, reasoning }
  } catch (e: any) {
    console.error(`[explore] Selection failed: ${e.message}`)
    return {
      styleName: styleNames[0],
      confidence: 'low',
      reasoning: 'Fallback to first style due to error'
    }
  }
}

/**
 * Load all reference images from brand styles folder
 */
function loadReferences(brandName: string): StyleVariation[] {
  const stylesDir = join(getBrandDir(brandName), 'styles')

  if (!existsSync(stylesDir)) {
    console.error(`[explore] Styles directory not found: ${stylesDir}`)
    return []
  }

  const files = readdirSync(stylesDir)
    .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
    .sort()

  return files.map(f => ({
    name: f.replace(/\.(png|jpg|jpeg)$/i, '').replace(/^ref_\d+_/, ''),
    refPath: join(stylesDir, f)
  }))
}

/**
 * Generate single variation with a reference
 */
async function generateVariation(
  ai: GoogleGenAI,
  topic: string,
  ref: StyleVariation,
  brandPalette: Record<string, string>,
  model: 'flash' | 'pro' = 'flash',
  promptOverride?: string
): Promise<StyleVariation> {
  const defaultPrompt = `Study the reference image and identify its ESSENCE:
- What makes this style distinctive? (materials, forms, techniques)
- What is the visual language? (geometric, organic, photographic, sculptural)
- What is the color relationship and mood?

Now create a NEW, ORIGINAL image for this topic: "${topic}"

CRITICAL RULES:
- DO NOT recreate or copy the reference image
- Extract the aesthetic DNA and apply it to a fresh composition
- Different subject, different perspective, different arrangement
- Same visual spirit, completely new execution
- NO text, NO words, NO letters

COLOR PALETTE to use:
- ${brandPalette.background || '#FDFBF7'} cream (background/negative space)
- ${brandPalette.primary || '#1E1B16'} deep brown (primary forms)
- ${brandPalette.accent || '#5046E5'} indigo (accent)

The result should feel like it belongs in the same gallery as the reference, but be a distinct piece.`

  const prompt = promptOverride
    ? promptOverride
        .replaceAll('{{topic}}', topic)
        .replaceAll('{{background}}', brandPalette.background || '#FDFBF7')
        .replaceAll('{{primary}}', brandPalette.primary || '#1E1B16')
        .replaceAll('{{accent}}', brandPalette.accent || '#5046E5')
    : defaultPrompt

  try {
    const refBuffer = readFileSync(ref.refPath)
    const ext = ref.refPath.split('.').pop()?.toLowerCase()
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'

    const modelName = model === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.0-flash-exp'
    const config = model === 'pro'
      ? { imageConfig: { aspectRatio: '1:1', imageSize: '2K' } }
      : { responseModalities: ['Text', 'Image'], imageConfig: { aspectRatio: '1:1' } }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: refBuffer.toString('base64') } },
          { text: prompt }
        ]
      }],
      config: config as any
    })

    const candidate = (response as any).candidates?.[0]
    if (!candidate?.content?.parts) {
      return { ...ref, error: 'No response' }
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        return { ...ref, image: Buffer.from(part.inlineData.data, 'base64') }
      }
    }

    return { ...ref, error: 'No image in response' }
  } catch (e: any) {
    return { ...ref, error: e.message?.slice(0, 50) }
  }
}

/**
 * Create labeled contact sheet from variations
 */
async function createContactSheet(
  variations: StyleVariation[],
  cols: number = 4
): Promise<Buffer> {
  const cellSize = 512
  const labelHeight = 40
  const padding = 10

  const successful = variations.filter(v => v.image)
  const rows = Math.ceil(successful.length / cols)

  const width = cols * (cellSize + padding) + padding
  const height = rows * (cellSize + labelHeight + padding) + padding

  // Create base canvas
  let composite = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 253, g: 251, b: 247, alpha: 1 } // cream
    }
  })

  const overlays: sharp.OverlayOptions[] = []

  for (let i = 0; i < successful.length; i++) {
    const v = successful[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = padding + col * (cellSize + padding)
    const y = padding + row * (cellSize + labelHeight + padding)

    // Resize image to cell
    const resized = await sharp(v.image)
      .resize(cellSize, cellSize, { fit: 'cover' })
      .png()
      .toBuffer()

    overlays.push({ input: resized, left: x, top: y })

    // Create label
    const labelSvg = `<svg width="${cellSize}" height="${labelHeight}">
      <rect width="100%" height="100%" fill="#1E1B16"/>
      <text x="10" y="28" font-family="sans-serif" font-size="20" fill="#FDFBF7">${v.name}</text>
    </svg>`

    overlays.push({
      input: Buffer.from(labelSvg),
      left: x,
      top: y + cellSize
    })
  }

  return composite.composite(overlays).png().toBuffer()
}

export async function run(args: string[], _ctx?: CommandContext): Promise<ExploreResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set')
    throw new Error('GEMINI_API_KEY not set')
  }

  // Parse args properly
  let brand = getDefaultBrand()
  let topic = ''
  let model: 'flash' | 'pro' = 'flash'
  let quickMode = false
  let forceStyle: string | undefined
  let noLogo = false

  const positional: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--pro') {
      model = 'pro'
    } else if (arg === '--quick') {
      quickMode = true
    } else if (arg === '--no-logo') {
      noLogo = true
    } else if (arg === '--style' && i + 1 < args.length) {
      forceStyle = args[++i]
    } else if (arg.startsWith('--style=')) {
      forceStyle = arg.slice('--style='.length)
    } else if (!arg.startsWith('--')) {
      positional.push(arg)
    }
  }

  // Handle positional args: <brand> "<topic>" or just "<topic>"
  if (positional.length >= 2) {
    brand = positional[0]
    topic = positional.slice(1).join(' ')
  } else if (positional.length === 1) {
    // Could be brand or topic - if it's a known brand, treat as brand with no topic
    topic = positional[0]
  }

  // Check for quoted topic in original args (handles shell quoting)
  const quotedMatch = args.join(' ').match(/"([^"]+)"/)
  if (quotedMatch) {
    topic = quotedMatch[1]
  }

  if (!topic) {
    console.error('Usage: explore <brand> "<topic>"')
    console.error('Example: explore <brand> "topic"')
    throw new Error('Missing topic')
  }

  const modeLabel = forceStyle ? `style:${forceStyle}` : quickMode ? 'quick' : 'full'
  console.log(`\n[explore] Topic: "${topic}"`)
  console.log(`[explore] Brand: ${brand}`)
  console.log(`[explore] Mode: ${modeLabel}`)
  console.log(`[explore] Model: ${model === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.0-flash-exp'}`)

  // Load brand and references
  const brandConfig = loadBrand(brand)
  const refs = loadReferences(brand)

  console.log(`[explore] Found ${refs.length} reference styles`)

  if (refs.length === 0) {
    console.error('[explore] No reference images found')
    throw new Error('No reference images found')
  }

  const ai = new GoogleGenAI({ apiKey })

  // Get palette from brand config (style.colors or visual.palette)
  const visualPalette = (brandConfig as any).visual?.palette
  const styleColors = (brandConfig as any).style?.colors
  const palette = visualPalette ? {
    background: visualPalette.secondary || '#FAFAFA',
    primary: visualPalette.primary || '#000000',
    accent: visualPalette.accent || '#1A1A1A'
  } : {
    background: styleColors?.backgrounds?.cream || '#FDFBF7',
    primary: styleColors?.dark || '#1E1B16',
    accent: styleColors?.accent || '#5046E5'
  }

  const promptOverride = (brandConfig as any).visual?.prompt_override || (brandConfig as any).style?.prompt_override

  // Dynamic brand context
  const brandContext = `${brandConfig.name} - ${brandConfig.voice?.tone || 'brand voice'}`

  // Output directory
  const date = new Date().toISOString().split('T')[0]
  const topicSlug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const modeSuffix = forceStyle ? `-${forceStyle}` : quickMode ? '-quick' : (model === 'pro' ? '-pro' : '-flash')
  const sessionDir = join(getOutputDir(), date, `${topicSlug}${modeSuffix}`)
  mkdirSync(sessionDir, { recursive: true })

  let selectedStyleName: string
  let contentImage: Buffer

  // === MODE: Force Style ===
  if (forceStyle) {
    const ref = refs.find(r => r.name === forceStyle)
    if (!ref) {
      console.error(`[explore] Style not found: ${forceStyle}`)
      console.error(`[explore] Available: ${refs.map(r => r.name).join(', ')}`)
      throw new Error(`Style not found: ${forceStyle}`)
    }

    console.log(`[explore] Using forced style: ${forceStyle}`)
    selectedStyleName = forceStyle

    // Generate one image with this reference
    console.log(`[explore] Generating image...`)
    const result = await generateVariation(ai, topic, ref, palette, model, promptOverride)
    if (!result.image) {
      console.error(`[explore] Generation failed: ${result.error}`)
      throw new Error(`Generation failed: ${result.error || 'unknown error'}`)
    }
    console.log(`[explore] Generated`)
    contentImage = await upscaleImage(result.image)

  // === MODE: Quick ===
  } else if (quickMode) {
    console.log(`[explore] Quick mode: selecting from references...`)
    const selection = await selectFromRefs(ai, topic, refs, brandContext)

    console.log(`\n${'─'.repeat(60)}`)
    console.log(`SELECTED: ${selection.styleName}`)
    console.log(`CONFIDENCE: ${selection.confidence}`)
    console.log(`REASONING: ${selection.reasoning}`)
    console.log(`${'─'.repeat(60)}`)

    selectedStyleName = selection.styleName
    const ref = refs.find(r => r.name === selection.styleName)
    if (!ref) {
      console.error(`[explore] Selected style not found`)
      throw new Error('Selected style not found')
    }

    // Generate one image with selected reference
    console.log(`\n[explore] Generating image...`)
    const result = await generateVariation(ai, topic, ref, palette, model, promptOverride)
    if (!result.image) {
      console.error(`[explore] Generation failed: ${result.error}`)
      throw new Error(`Generation failed: ${result.error || 'unknown error'}`)
    }
    console.log(`[explore] Generated`)
    contentImage = await upscaleImage(result.image)

  // === MODE: Full (moodboard) ===
  } else {
    const selectedRefs = refs.slice(0, 8)
    console.log(`[explore] Generating ${selectedRefs.length} variations...`)

    const variations: StyleVariation[] = []
    for (let i = 0; i < selectedRefs.length; i += 4) {
      const batch = selectedRefs.slice(i, i + 4)
      console.log(`[explore] Batch ${Math.floor(i/4) + 1}/${Math.ceil(selectedRefs.length/4)}...`)

      const results = await Promise.all(
        batch.map(ref => generateVariation(ai, topic, ref, palette, model, promptOverride))
      )

      for (const r of results) {
        console.log(r.image ? `  ✓ ${r.name}` : `  ✗ ${r.name}: ${r.error}`)
      }
      variations.push(...results)
    }

    const successful = variations.filter(v => v.image)
    console.log(`[explore] Generated ${successful.length}/${selectedRefs.length} images`)

    if (successful.length === 0) {
      console.error('[explore] No images generated')
      throw new Error('No images generated')
    }

    // Create and save moodboard
    console.log('[explore] Creating moodboard...')
    const contactSheet = await createContactSheet(variations)
    writeFileSync(join(sessionDir, 'moodboard.png'), contactSheet)

    // Save variations
    const variationsDir = join(sessionDir, '.variations')
    mkdirSync(variationsDir, { recursive: true })
    const variationPaths: Record<string, string> = {}
    for (const v of successful) {
      const varPath = join(variationsDir, `${v.name}.png`)
      writeFileSync(varPath, v.image!)
      variationPaths[v.name] = varPath
    }

    // Agent selection
    console.log('\n[explore] Agent selecting...')
    const selection = await selectStyle(ai, contactSheet, topic, successful.map(v => v.name), brandContext)

    console.log(`\n${'─'.repeat(60)}`)
    console.log(`SELECTED: ${selection.styleName}`)
    console.log(`CONFIDENCE: ${selection.confidence}`)
    console.log(`REASONING: ${selection.reasoning}`)
    console.log(`${'─'.repeat(60)}`)

    selectedStyleName = selection.styleName
    const selectedPath = variationPaths[selection.styleName]
    if (!selectedPath) {
      console.error('[explore] Selected variation not found')
      throw new Error('Selected variation not found')
    }
    contentImage = await upscaleImage(readFileSync(selectedPath))
  }

  // === COMMON: Save selected + generate finals ===

  // Save selected (upscaled) to session root
  const selectedImgPath = join(sessionDir, 'selected.png')
  writeFileSync(selectedImgPath, contentImage)
  console.log(`\nSelected: ${selectedImgPath}`)

  // Generate copy (with hook from bank if available)
  console.log(`\n[explore] Generating copy...`)
  const { contentType } = classify(topic)

  // Try to get a relevant hook from the hook bank
  let hookPattern: string | undefined
  try {
    const hook = getHookForTopic(brand, topic)
    if (hook) {
      hookPattern = hook.amplified || hook.original
      console.log(`  Using hook [${hook.multiplier}x]: "${hookPattern.slice(0, 50)}..."`)
    }
  } catch {
    // Hook bank might not exist yet
  }

  // Generate and grade copy with retry loop
  const rubric = loadRubric(brand)
  const maxRetries = rubric.max_retries || 2
  let copy = await generateCopy(topic, brand, contentType, hookPattern)
  let evalResult = await grade(copy.linkedin.text, brand, { platform: 'linkedin', log: true })
  let attempts = 0

  console.log(`  ✓ Twitter: ${copy.twitter.text.length} chars`)
  console.log(`  ✓ LinkedIn: ${copy.linkedin.text.length} chars`)

  // Grade and retry loop
  console.log(`\n[explore] Grading copy...`)
  let scoreBar = '█'.repeat(Math.round(evalResult.score / 10)) + '░'.repeat(10 - Math.round(evalResult.score / 10))
  console.log(`  Score: ${scoreBar} ${evalResult.score}/100 ${evalResult.passed ? '✓' : '✗'}`)

  while (!evalResult.passed && attempts < maxRetries) {
    attempts++
    console.log(`\n[explore] Retry ${attempts}/${maxRetries} - fixing issues...`)

    // Build feedback using shared helper + critique
    const feedback = buildFeedback(evalResult, rubric) + `\n\nCRITIQUE: ${evalResult.critique}`

    // Regenerate with feedback
    copy = await generateCopy(topic, brand, contentType, hookPattern, feedback)
    evalResult = await grade(copy.linkedin.text, brand, { platform: 'linkedin', log: true })

    scoreBar = '█'.repeat(Math.round(evalResult.score / 10)) + '░'.repeat(10 - Math.round(evalResult.score / 10))
    console.log(`  Score: ${scoreBar} ${evalResult.score}/100 ${evalResult.passed ? '✓' : '✗'}`)
  }

  if (!evalResult.passed) {
    console.log(`  ⚠ Still below threshold after ${attempts} retries. Critique: ${evalResult.critique}`)
  }

  if (evalResult.hard_fails.length > 0) {
    console.log(`  Hard fails: ${evalResult.hard_fails.join(', ')}`)
  }

  // Save copy
  const dimScores = Object.entries(evalResult.dimensions)
    .map(([k, v]) => `${k}: ${v}/10`)
    .join(' | ')

  const copyMd = `# ${topic}

**Eval: ${evalResult.score}/100 ${evalResult.passed ? '✓ PASS' : '✗ FAIL'}** (${dimScores})
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
`
  writeFileSync(join(sessionDir, 'copy.md'), copyMd)

  // Generate image finals
  console.log(`\n[explore] Generating finals...`)

  const templateOverrides = (brandConfig as any).style?.templates || (brandConfig as any).visual?.templates

  const defaultPlatforms = [
    { name: 'twitter', template: 'banner', ratio: 'landscape' as const, logo: true },
    { name: 'instagram', template: 'polaroid', ratio: 'portrait' as const, logo: false },
    { name: 'story', template: 'polaroid', ratio: 'story' as const, logo: true },
  ]

  const platforms = templateOverrides ?? defaultPlatforms

  const typography = (brandConfig as any).style?.typography?.headline || (brandConfig as any).visual?.typography?.headline
  const brandFonts = typography ? {
    headline: {
      name: typography.font?.toLowerCase() || 'alegreya',
      weight: typography.weight || 400
    }
  } : undefined

  const headline = copy.headline || topic.split(/[.!?]/)[0]

  // Get logo path (style.logo.svg or assets/logo.*)
  const logoSvg = (brandConfig as any).style?.logo?.svg
  let basLogoPath: string | undefined
  if (logoSvg) {
    basLogoPath = join(getBrandDir(brand), logoSvg)
  } else {
    // Try default assets/logo.svg or logo.png
    const defaultSvg = join(getBrandDir(brand), 'assets', 'logo.svg')
    const defaultPng = join(getBrandDir(brand), 'assets', 'logo.png')
    if (existsSync(defaultSvg)) basLogoPath = defaultSvg
    else if (existsSync(defaultPng)) basLogoPath = defaultPng
  }

  // Build poster style from brand config
  const posterStyle = (brandConfig as any).style ?? (visualPalette ? {
    colors: {
      dark: visualPalette.primary || '#000000',
      light: visualPalette.secondary || '#FFFFFF',
      accent: visualPalette.accent || visualPalette.primary || '#000000',
      backgrounds: {
        warm: visualPalette.secondary || '#FFFFFF',
        cream: visualPalette.secondary || '#FFFFFF',
        dark: visualPalette.primary || '#000000'
      }
    },
    logo: {
      colors: {
        onLight: visualPalette.primary || '#000000',
        onDark: visualPalette.secondary || '#FFFFFF'
      }
    }
  } : undefined)

  for (const platform of platforms) {
    try {
      // Use logo unless --no-logo or platform.logo is false
      const useLogo = !noLogo && platform.logo
      const logoPath = useLogo ? basLogoPath : undefined

      const poster = await generatePoster({
        template: platform.template,
        ratio: platform.ratio,
        headline,
        contentImage,
        logoPath,
        fonts: brandFonts,
        style: posterStyle,
      })

      writeFileSync(join(sessionDir, `${platform.name}.png`), poster)
      console.log(`  ✓ ${platform.name}.png${useLogo ? '' : ' (no logo)'}`)
    } catch (e: any) {
      console.log(`  ✗ ${platform.name}: ${e.message}`)
    }
  }

  // Add to queue for posting
  const now = new Date().toISOString()
  const queueItem: QueueItem = {
    id: `gen_${Date.now()}`,
    source: {
      type: 'manual',
      topic,
      brandName: brand
    },
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
      model: `gemini-2.0-${model}-exp`
    }
  }

  addToQueue(queueItem)
  console.log(`[explore] Added to queue: ${queueItem.id}`)

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Output: ${sessionDir}`)
  console.log(`${'─'.repeat(60)}`)

  return {
    brand,
    topic,
    mode: modeLabel,
    model: model === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.0-flash-exp',
    outputDir: sessionDir,
    selectedStyle: selectedStyleName,
    eval: {
      score: evalResult.score,
      passed: evalResult.passed,
      attempts
    },
    queueId: queueItem.id,
    outputs: {
      selected: selectedImgPath,
      copy: join(sessionDir, 'copy.md')
    }
  }
}
