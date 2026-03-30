import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createCanvas, Image, type CanvasRenderingContext2D } from 'canvas'
import type { BrandContentType, BrandFoundation, SocialPlatform } from '../domain/types'
import { ensureParentDir, type RuntimePaths } from '../core/paths'

interface RenderSocialAssetsOptions {
  brand: BrandFoundation
  paths: RuntimePaths
  runId: string
  headline: string
  body: string
  sourceImagePath: string
  contentType?: string
}

interface PlatformSpec {
  platform: SocialPlatform
  width: number
  height: number
  aspect: string
}

const PLATFORM_SPECS: PlatformSpec[] = [
  { platform: 'twitter', width: 1600, height: 900, aspect: '16:9' },
  { platform: 'linkedin', width: 1200, height: 1200, aspect: '1:1' },
  { platform: 'facebook', width: 1200, height: 1200, aspect: '1:1' },
  { platform: 'instagram', width: 1080, height: 1350, aspect: '4:5' },
  { platform: 'threads', width: 1080, height: 1350, aspect: '4:5' },
]

const DEFAULT_CONTENT_TYPE: BrandContentType = {
  id: 'editorial-mixed',
  description: 'photography with integrated text in a split or overlay composition',
  elements: 'photo occupies portion of frame, text block occupies remaining space',
  camera: '50mm f/4, editorial lighting',
}

function selectDeterministicIndex(input: string, length: number): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % length
}

function resolveContentType(brand: BrandFoundation, seed: string, requestedId?: string): BrandContentType {
  const types = brand.visual.contentTypes
  if (!types || types.length === 0) return DEFAULT_CONTENT_TYPE
  if (requestedId) {
    const match = types.find((t) => t.id === requestedId)
    if (match) return match
  }
  return types[selectDeterministicIndex(`${brand.id}:${seed}`, types.length)]
}

function resolveLogoPath(brand: BrandFoundation, brandsDir: string): string | undefined {
  if (!brand.visual.logo) return undefined
  const logoPath = join(brandsDir, brand.id, brand.visual.logo)
  return existsSync(logoPath) ? logoPath : undefined
}

/**
 * Build a narrative prompt following Nano Banana best practices:
 * [Subject] + [Composition] + [Color/material] + [Texture/degradation]
 *
 * Composed entirely from brand config — no hardcoded brand-specific terms.
 * The brand's `style` block is the soul of the prompt.
 */
function buildPlatformPrompt(
  spec: PlatformSpec,
  brand: BrandFoundation,
  contentType: BrandContentType,
  headline: string,
): string {
  const lines: string[] = []

  // 1. Subject + content type
  lines.push(`A ${spec.aspect} social media graphic for ${brand.name}.`)
  lines.push(`Content type: ${contentType.description}. ${contentType.elements}.`)

  if (contentType.camera) {
    lines.push(`Camera: ${contentType.camera}.`)
  }

  // 2. Brand visual style (the core aesthetic — from brand-image-prompts.md or equivalent)
  if (brand.visual.style) {
    lines.push(brand.visual.style)
  }

  // 3. Composition tokens
  if (brand.visual.composition && brand.visual.composition.length > 0) {
    lines.push(`Composition: ${brand.visual.composition.join(', ')}.`)
  }

  // 4. Texture tokens
  if (brand.visual.texture && brand.visual.texture.length > 0) {
    lines.push(`Texture: ${brand.visual.texture.join(', ')}.`)
  }

  // 5. Typography — only headline, keep it short for reliable text rendering
  const typo = brand.visual.typography
  lines.push(`Render the text "${headline}" in ${typo?.headline ?? 'bold serif'} in ${brand.visual.palette.primary} color.`)
  lines.push(`Include the brand name "${brand.name.toUpperCase()}" in ${typo?.accent ?? 'bold uppercase'} in ${brand.visual.palette.accent} color.`)

  // 6. Palette
  lines.push(`Palette: background ${brand.visual.palette.background}, primary ${brand.visual.palette.primary}, accent ${brand.visual.palette.accent}.`)

  // 7. Resolution
  lines.push(`${spec.width}x${spec.height} pixels.`)

  // 8. Negative
  if (brand.visual.negative && brand.visual.negative.length > 0) {
    lines.push(`Avoid: ${brand.visual.negative.join('. ')}.`)
  }

  return lines.join('\n')
}

async function generatePlatformAsset(
  prompt: string,
  logoPath?: string,
): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!key) {
    throw new Error('GEMINI_API_KEY not set')
  }

  const { GoogleGenAI } = await import('@google/genai')
  const client = new GoogleGenAI({ apiKey: key })

  // Build multimodal parts: logo (if available) + text prompt
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []

  if (logoPath && existsSync(logoPath)) {
    const logoBytes = readFileSync(logoPath)
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: logoBytes.toString('base64'),
      },
    })
    parts.push({
      text: `This is the brand logo. Incorporate it into the graphic.\n\n${prompt}`,
    })
  } else {
    parts.push({ text: prompt })
  }

  const response = await client.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  })

  const responseParts = response.candidates?.[0]?.content?.parts ?? []
  const imagePart = responseParts.find(
    (part) => part.inlineData?.mimeType?.startsWith('image/'),
  )

  if (!imagePart?.inlineData?.data) {
    throw new Error('Gemini returned no image for social asset')
  }

  return Buffer.from(imagePart.inlineData.data, 'base64')
}

// --- Canvas fallback: used when GEMINI_API_KEY is not set ---

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawSourceCover(ctx: CanvasRenderingContext2D, image: Image, x: number, y: number, width: number, height: number): void {
  const scale = Math.max(width / image.width, height / image.height)
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight)
}

function drawTextBlock(ctx: CanvasRenderingContext2D, brand: BrandFoundation, headline: string, body: string, x: number, y: number, width: number, layout: 'wide' | 'square' | 'tall'): void {
  ctx.fillStyle = brand.visual.palette.primary
  ctx.textBaseline = 'top'
  ctx.font = layout === 'wide' ? '700 68px sans-serif' : '700 72px sans-serif'
  const headlineLines = wrapText(ctx, headline, width).slice(0, layout === 'wide' ? 3 : 4)
  let currentY = y
  for (const line of headlineLines) {
    ctx.fillText(line, x, currentY)
    currentY += layout === 'wide' ? 78 : 82
  }
  currentY += 24
  ctx.globalAlpha = 0.86
  ctx.font = layout === 'wide' ? '400 30px sans-serif' : '400 34px sans-serif'
  for (const line of wrapText(ctx, body, width).slice(0, layout === 'wide' ? 4 : 5)) {
    ctx.fillText(line, x, currentY)
    currentY += layout === 'wide' ? 42 : 48
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = brand.visual.palette.accent
  ctx.font = '700 24px sans-serif'
  ctx.fillText(brand.name.toUpperCase(), x, currentY + 24)
}

const CANVAS_SPECS: Array<{ platform: SocialPlatform; width: number; height: number; layout: 'wide' | 'square' | 'tall' }> = [
  { platform: 'facebook', width: 1200, height: 1200, layout: 'square' },
  { platform: 'instagram', width: 1080, height: 1350, layout: 'tall' },
  { platform: 'linkedin', width: 1200, height: 1200, layout: 'square' },
  { platform: 'threads', width: 1080, height: 1350, layout: 'tall' },
  { platform: 'twitter', width: 1600, height: 900, layout: 'wide' },
]

function renderCanvasFallback(options: RenderSocialAssetsOptions): Record<SocialPlatform, string> {
  const hasSource = options.sourceImagePath && existsSync(options.sourceImagePath)
  let sourceImage: Image | undefined
  if (hasSource) {
    sourceImage = new Image()
    sourceImage.src = readFileSync(options.sourceImagePath)
  }
  const assets = {} as Record<SocialPlatform, string>
  for (const spec of CANVAS_SPECS) {
    const canvas = createCanvas(spec.width, spec.height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = options.brand.visual.palette.background
    ctx.fillRect(0, 0, spec.width, spec.height)
    if (sourceImage && spec.layout === 'wide') {
      drawSourceCover(ctx, sourceImage, spec.width * 0.45, 0, spec.width * 0.55, spec.height)
      ctx.fillStyle = options.brand.visual.palette.background
      ctx.globalAlpha = 0.94
      ctx.fillRect(0, 0, spec.width * 0.52, spec.height)
      ctx.globalAlpha = 1
      ctx.fillStyle = options.brand.visual.palette.accent
      ctx.fillRect(64, 64, 14, spec.height - 128)
      drawTextBlock(ctx, options.brand, options.headline, options.body, 116, 92, spec.width * 0.34, spec.layout)
    } else if (sourceImage && spec.layout === 'tall') {
      drawSourceCover(ctx, sourceImage, 0, 0, spec.width, spec.height * 0.5)
      ctx.fillStyle = options.brand.visual.palette.background
      ctx.fillRect(0, spec.height * 0.46, spec.width, spec.height * 0.54)
      ctx.fillStyle = options.brand.visual.palette.accent
      ctx.fillRect(72, spec.height * 0.5, spec.width - 144, 12)
      drawTextBlock(ctx, options.brand, options.headline, options.body, 72, spec.height * 0.56, spec.width - 144, spec.layout)
    } else {
      ctx.fillStyle = options.brand.visual.palette.accent
      ctx.fillRect(72, spec.height * 0.42, spec.width - 144, 8)
      drawTextBlock(ctx, options.brand, options.headline, options.body, 72, spec.height * 0.48, spec.width - 144, spec.layout)
    }
    const path = outputPath(options.paths, options.runId, spec.platform)
    ensureParentDir(path)
    writeFileSync(path, canvas.toBuffer('image/png'))
    assets[spec.platform] = path
  }
  return assets
}

// --- Public API ---

function outputPath(paths: RuntimePaths, runId: string, platform: SocialPlatform): string {
  return join(paths.artifactsDir, runId, `${platform}.png`)
}

export async function renderSocialAssets(options: RenderSocialAssetsOptions): Promise<Record<SocialPlatform, string>> {
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    return renderCanvasFallback(options)
  }

  const contentType = resolveContentType(options.brand, options.headline, options.contentType)
  const logoPath = resolveLogoPath(options.brand, join(options.paths.root, 'brands'))
  const assets = {} as Record<SocialPlatform, string>

  const results = await Promise.allSettled(
    PLATFORM_SPECS.map(async (spec) => {
      const prompt = buildPlatformPrompt(spec, options.brand, contentType, options.headline)
      const imageBytes = await generatePlatformAsset(prompt, logoPath)
      const path = outputPath(options.paths, options.runId, spec.platform)
      ensureParentDir(path)
      writeFileSync(path, imageBytes)
      return { platform: spec.platform, path }
    }),
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      assets[result.value.platform] = result.value.path
    } else {
      throw new Error(`Failed to generate social asset: ${result.reason}`)
    }
  }

  return assets
}
