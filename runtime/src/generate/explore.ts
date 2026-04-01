import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { BrandFoundation } from '../domain/types'
import { ensureParentDir, type RuntimePaths } from '../core/paths'

interface ExploreGridOptions {
  brand: BrandFoundation
  paths: RuntimePaths
  runId: string
  topic: string
  headline: string
  imageDirection: string
}

interface ExploreGridResult {
  gridImagePath: string
  prompt: string
  provider: string
  width: number
  height: number
}

function buildExplorePrompt(options: ExploreGridOptions): string {
  const { brand, topic } = options

  // Use brand.yml image_prompt if available — wrap in grid instruction
  if (brand.visual.imagePrompt) {
    const basePrompt = brand.visual.imagePrompt.replace(/\[SUBJECT\]/gi, topic)
    return [
      `Generate a 3x3 mood board grid (3:4 aspect ratio) with nine panels separated by clean visible grid lines.`,
      `Each panel should be a distinct variation using this visual system:`,
      '',
      basePrompt,
      '',
      `Each panel explores a different angle on "${topic}" within this system.`,
      `Vary composition, density, and specific visual elements across panels while maintaining the same grammar.`,
    ].join('\n')
  }

  // Fallback: construct from visual fields
  const lines: string[] = []

  lines.push(`A 3x3 mood board grid (3:4 aspect ratio) exploring visual directions for "${topic}" by ${brand.name}.`)
  lines.push('Nine panels separated by clean visible grid lines. Each panel is a distinct composition.')

  if (brand.visual.style) {
    lines.push('')
    lines.push(brand.visual.style)
  }

  if (brand.visual.texture && brand.visual.texture.length > 0) {
    lines.push(`Texture: ${brand.visual.texture.join(', ')}.`)
  }

  lines.push(`Palette: ${brand.visual.palette.background}, ${brand.visual.palette.primary}, ${brand.visual.palette.accent}.`)

  if (brand.visual.negative && brand.visual.negative.length > 0) {
    lines.push(`Avoid: ${brand.visual.negative.join('. ')}.`)
  }

  lines.push('Consistent mood across all nine panels. Unity, not uniformity.')

  return lines.join('\n')
}

async function generateWithGemini(prompt: string, logoPath?: string): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!key) {
    throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY not set')
  }

  const { GoogleGenAI } = await import('@google/genai')
  const client = new GoogleGenAI({ apiKey: key })

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []

  if (logoPath && existsSync(logoPath)) {
    const logoBytes = readFileSync(logoPath)
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: logoBytes.toString('base64'),
      },
    })
    parts.push({ text: `This is the brand logo for reference.\n\n${prompt}` })
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
    throw new Error('Gemini returned no image for explore grid')
  }

  return Buffer.from(imagePart.inlineData.data, 'base64')
}

export async function generateExploreGrid(options: ExploreGridOptions): Promise<ExploreGridResult> {
  const prompt = buildExplorePrompt(options)
  const outputPath = join(options.paths.artifactsDir, options.runId, 'explore-grid.png')
  const width = 1024
  const height = 1365

  // Resolve logo path
  const brandsDir = join(options.paths.root, 'brands')
  const logoFile = options.brand.visual.logo
  const logoPath = logoFile ? join(brandsDir, options.brand.id, logoFile) : undefined

  const imageBytes = await generateWithGemini(prompt, logoPath)
  ensureParentDir(outputPath)
  writeFileSync(outputPath, imageBytes)

  return { gridImagePath: outputPath, prompt, provider: 'gemini-3.1-flash-image-preview', width, height }
}

export { buildExplorePrompt }
