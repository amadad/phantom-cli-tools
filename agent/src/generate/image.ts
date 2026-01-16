/**
 * Image generation by type
 * Uses provider architecture to support multiple image generation APIs
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { ImageType } from './classify'
import { generatePoster, getTemplateAspectRatio, type AspectRatio } from '../composite/poster'
import { getImageContext } from '../eval/learnings'
import { getBrandDir } from '../core/paths'
import { createImageProvider, type ReferenceImage } from './providers'

export interface ImageResult {
  b64: string
  prompt: string
  model: string
  reference?: string
  creditsUsed?: number
  creditsRemaining?: number
}

interface BrandVisual {
  palette?: Record<string, string>
  fonts?: { headline?: string; body?: string }
  logo?: string  // Path to logo file
}

/**
 * Reference images per type (relative to brands/<brand>/styles/)
 * Note: 'video' type has no reference - relies on prompt for style (Super 8 etc)
 */
const REFERENCES: Partial<Record<ImageType, string>> = {
  photo: 'ref_13_style09.png',    // Warm editorial portrait
  poster: 'ref_08_style04.png',   // Clean bold shapes
  abstract: 'ref_09_style05.png'  // Warm textural wall art
  // video: no reference - use prompt only
}

/**
 * Load reference image as base64
 */
function loadReference(brandName: string, imageType: ImageType): ReferenceImage | null {
  const filename = REFERENCES[imageType]

  // Some types (like 'video') don't use reference images
  if (!filename) {
    console.log(`[image] No reference for type: ${imageType} (using prompt only)`)
    return null
  }

  const refPath = join(getBrandDir(brandName.toLowerCase()), 'styles', filename)

  if (!existsSync(refPath)) {
    console.log(`[image] Reference not found: ${refPath}`)
    return null
  }

  const buffer = readFileSync(refPath)
  const ext = filename.split('.').pop()?.toLowerCase()
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'

  console.log(`[image] Using reference: ${filename}`)
  return { b64: buffer.toString('base64'), mimeType, filename }
}

/**
 * Build prompt based on image type
 */
function buildPrompt(
  imageType: ImageType,
  direction: string,
  brand: { name: string; visual?: BrandVisual },
  headline?: string
): string {
  const palette = brand.visual?.palette || {}
  const fonts = brand.visual?.fonts || {}

  // Inject learnings from past evaluations
  const learningsContext = getImageContext(brand.name.toLowerCase())

  switch (imageType) {
    case 'photo':
      return `Editorial fashion photography. Match the style, lighting, and mood of the reference image.

Scene: ${direction}

Style (from reference):
- Warm color tones, editorial lighting
- Empowered, confident mood - NOT sad or defeated
- Fashion editorial feel
- Shallow depth of field

DO NOT include text or logos in the image.
${learningsContext}`

    case 'poster':
      // Shapes only - will be placed in middle zone of poster
      return `Create abstract art inspired by the bold shapes in the reference image.

RULES:
- ONLY abstract shapes - NO text, NO letters, NO words
- Fill the entire canvas with shapes

COLORS (use all of these):
- ${palette.background || '#FDFBF7'} cream (background/negative space)
- ${palette.primary || '#1E1B16'} deep brown (main shapes)
- ${palette.accent || '#5046E5'} electric indigo (accent shapes)
- ${palette.secondary || '#3D3929'} warm olive (secondary shapes)

STYLE: Henri Matisse paper cutouts. Bold, colorful, overlapping geometric forms.
${learningsContext}`

    case 'abstract':
      return `Create a purely ABSTRACT texture inspired by the reference image style.

IMPORTANT: Do NOT include people, faces, or recognizable objects. This must be abstract art only.

Emotional concept to evoke: ${direction}

Style (match the reference):
- Organic, flowing sculptural forms
- Warm neutral palette (browns, tans, cream)
- Textural, layered quality like felt or textile art
- ${palette.accent || '#5046E5'} as subtle accent
- Contemplative, quiet mood

Think: abstract wall sculpture, textile art, organic shapes. NO photography, NO people.
${learningsContext}`

    case 'video':
      // Video frames: use prompt directly without reference image override
      // The brief's image_prompt defines the aesthetic (Super 8, etc)
      return `${direction}

DO NOT include text, logos, or watermarks in the image.
${learningsContext}`
  }
}

/**
 * Generate image using provider architecture
 * Supports multiple providers: gemini (default), reve
 * Set via env: IMAGE_PROVIDER=reve or IMAGE_PROVIDER=gemini
 */
export async function generateImage(
  imageType: ImageType,
  direction: string,
  brand: { name: string; visual?: BrandVisual; style?: any },
  headline?: string,
  template?: string,  // Template name for poster type
  ratio?: AspectRatio  // Aspect ratio variant
): Promise<ImageResult | null> {
  const prompt = buildPrompt(imageType, direction, brand, headline)
  console.log(`[image] Type: ${imageType}`)
  console.log(`[image] Direction: ${direction.slice(0, 80)}...`)

  // Load reference image
  const reference = loadReference(brand.name, imageType)

  // Determine aspect ratio based on type and ratio parameter
  let aspectRatio = '3:4'  // Default
  if (imageType === 'poster' && template) {
    aspectRatio = getTemplateAspectRatio(template, ratio)
  } else if (imageType === 'video' && ratio === 'portrait') {
    aspectRatio = '9:16'  // Vertical video for Shorts/Reels
  } else if (ratio === 'portrait') {
    aspectRatio = '3:4'  // Portrait photos
  } else if (ratio === 'landscape') {
    aspectRatio = '16:9'  // Landscape
  } else if (ratio === 'square') {
    aspectRatio = '1:1'  // Square
  }
  console.log(`[image] Aspect ratio: ${aspectRatio}`)

  // Provider selection: try providers in order until one succeeds
  const providerOrder = process.env.IMAGE_PROVIDER
    ? [process.env.IMAGE_PROVIDER.toLowerCase(), 'gemini']  // Try specified first, fallback to gemini
    : ['gemini', 'reve']  // Default: gemini first, reve fallback

  const uniqueProviders = [...new Set(providerOrder)]  // Remove duplicates

  for (const providerName of uniqueProviders) {
    try {
      console.log(`[image] Trying provider: ${providerName}`)
      const provider = await createImageProvider(providerName)

      if (!provider.isAvailable()) {
        console.log(`[image] ${providerName} not available (API key not set)`)
        continue
      }

      const result = await provider.generateImage({
        prompt,
        imageType,
        aspectRatio,
        reference: reference || undefined
      })

      console.log(`[image] Generated with ${providerName}/${result.model}`)

      let finalB64 = result.b64

      // For posters, composite into template
      if (imageType === 'poster' && template) {
        console.log(`[image] Compositing into template: ${template}`)
        const contentImage = Buffer.from(result.b64, 'base64')
        const posterHeadline = headline || direction.split('.')[0]

        // Logo path (relative to brand dir)
        const logoSvg = brand.style?.logo?.svg
        const logoPath = logoSvg
          ? join(getBrandDir(brand.name.toLowerCase()), logoSvg)
          : undefined

        const final = await generatePoster({
          template,
          ratio,
          headline: posterHeadline,
          contentImage,
          logoPath,
          style: brand.style,
        })

        finalB64 = final.toString('base64')
        console.log(`[image] Text composited`)
      }

      return {
        b64: finalB64,
        prompt,
        model: result.model,
        reference: reference?.filename,
        creditsUsed: result.creditsUsed,
        creditsRemaining: result.creditsRemaining
      }
    } catch (e: any) {
      console.error(`[image] ${providerName} failed: ${e.message?.slice(0, 100)}`)
    }
  }

  console.error('[image] All providers failed')
  return null
}
