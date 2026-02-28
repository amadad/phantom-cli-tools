/**
 * Image generation by type — prompt-only (no reference images)
 *
 * Builds prompts from brand visual config (visual.image + palette).
 * SCTY uses its modular prompt_system for fine-grained control.
 */

import type { ImageType } from './classify'
import { generatePoster, type AspectRatio } from '../composite/poster'
import { getImageContext } from '../eval/learnings'
import { loadBrandVisual, resolveVolumeContext, type VolumeContext } from '../core/visual'
import { loadBrand } from '../core/brand'
import { createImageProvider } from './providers'
import sharp from 'sharp'

export interface ImageResult {
  b64: string
  prompt: string
  model: string
  creditsUsed?: number
  creditsRemaining?: number
}

// ── Universal image quality rules (not brand-specific) ──────────────────────

const IMAGE_RULES = `IMAGE RULES (apply to all output, all brands):
Do not look like AI-generated art. Aim for intentional, authored visual work.

Kill aesthetics (never produce):
- Oversaturated, HDR-glow look
- Plastic or waxy skin textures
- Perfect bilateral symmetry
- Lens flare or volumetric god rays (unless explicitly requested)
- Stock photography composition (centered subject, blurred background, forced smile)
- Midjourney house style: ornate, overdetailed, fantasy-illustration feel
- Uncanny valley faces or hands
- Generic "concept art" lighting (rim light + blue/orange split)

Composition:
- Off-center subjects. Asymmetry is default.
- Leave breathing room. Not every pixel needs detail.
- One focal point per image. Don't crowd the frame.
- Crop with intention — tight crops and negative space both work, but commit.

Texture and feel:
- Prefer material imperfection: grain, fiber, print artifacts, paper texture
- Flat > glossy by default. Matte surfaces read as more authored.
- If photographic: natural light, editorial grade, not commercial/advertising
- If abstract: gestural marks, hand-worked quality, not algorithmically smooth

DO NOT include text, letters, words, logos, or watermarks unless explicitly requested.`

// ── SCTY modular prompt builder ─────────────────────────────────────────────

/** Preset combos per imageType — each run picks one at random for variety */
const SCTY_PRESETS: Record<string, { subjects: string[]; forms: string[]; textures: string[] }> = {
  photo: {
    subjects: ['symbol', 'conceptual_diagram', 'celestial', 'iconic_silhouette'],
    forms: ['techno', 'cosmic', 'duotone', 'vector'],
    textures: ['photocopy', 'crosshatch', 'overprint', 'future'],
  },
  poster: {
    subjects: ['grid', 'mass', 'iconic_silhouette', 'conceptual_diagram'],
    forms: ['geometric', 'duotone', 'collage', 'cosmic'],
    textures: ['halftone', 'overprint', 'risograph', 'crosshatch'],
  },
  abstract: {
    subjects: ['abstract', 'celestial', 'letterform', 'conceptual_diagram'],
    forms: ['gestural', 'collage', 'cosmic', 'halftone'],
    textures: ['risograph', 'ink_bleed', 'overprint', 'paper'],
  },
}

/** Map imageType to SCTY prompt_system modules — rotates through expanded vocabulary */
function buildSctyPrompt(
  imageType: ImageType,
  direction: string,
  promptSystem: any,
  learnings: string,
  knockout?: boolean,
): string {
  const core = (promptSystem.core_aesthetic ?? []).join('. ')
  const composition = (promptSystem.composition ?? []).join('. ')
  const depth = (promptSystem.depth ?? []).join('. ')

  const formModes = promptSystem.form_modes ?? {}
  const textureModes = promptSystem.texture_modes ?? {}
  const subjectTypes = promptSystem.subject_types ?? {}

  if (imageType === 'video') {
    return `${IMAGE_RULES}\n\n${direction}\n${learnings}`
  }

  // Pick from preset pools for this imageType
  const preset = SCTY_PRESETS[imageType] ?? SCTY_PRESETS.abstract
  const subjectKey = preset.subjects[Math.floor(Math.random() * preset.subjects.length)]
  const formKey = preset.forms[Math.floor(Math.random() * preset.forms.length)]
  const textureKey = preset.textures[Math.floor(Math.random() * preset.textures.length)]

  const subject = subjectTypes[subjectKey] ?? subjectKey
  const form = formModes[formKey] ?? formKey
  const texture = textureModes[textureKey] ?? textureKey

  // Duotone mode: relax monochrome constraint
  const colorRule = formKey === 'duotone'
    ? 'Duotone only — single spot color (vermillion, deep red, or signal orange) plus black. No full color. No text or letters.'
    : 'Monochrome only. No text or letters. No color.'

  // Knockout mode: instruct pure solid background for clean removal
  const knockoutRule = knockout
    ? '\nBACKGROUND: Pure solid white (#FFFFFF) background. Subject floats on clean white field with NO texture, NO grain, NO gradients in the background area. Sharp separation between subject and background.'
    : ''

  return `${IMAGE_RULES}

Create a ${subject} for this concept: "${direction}"

AESTHETIC: ${core}
FORM: ${form}
TEXTURE: ${texture}
COMPOSITION: ${composition}
DEPTH: ${depth}
${knockoutRule}
${colorRule}
Output intent: social media post.
${learnings}`
}

// ── Generic prompt builder ──────────────────────────────────────────────────

function buildGenericPrompt(
  imageType: ImageType,
  direction: string,
  style: string,
  mood: string,
  prefer: string[],
  avoid: string[],
  paletteInstructions: string,
  palette: Record<string, string | undefined>,
  learnings: string,
  volumeContext?: VolumeContext | null,
): string {
  const paletteBlock = paletteInstructions
    || `Colors: ${palette.background ?? '#FDFBF7'} background, ${palette.primary ?? '#1E1B16'} primary, ${palette.accent ?? '#5046E5'} accent`
  const volumeBlock = volumeContext
    ? `\nVOLUME: ${volumeContext.volume}
Field color: ${volumeContext.field} | Text color: ${volumeContext.text} | Accent: ${Array.isArray(volumeContext.accent) ? volumeContext.accent.join(', ') : volumeContext.accent}
Image treatment: ${volumeContext.imageTreatment} (saturation: ${volumeContext.saturation})
Typography: weight ${volumeContext.typeWeight}, size ${volumeContext.typeSize}
Graphic intensity: ${volumeContext.graphicChannels} color channels`
    : ''

  const preferBlock = prefer.length > 0 ? `\nPREFER: ${prefer.join(', ')}` : ''
  const avoidBlock = avoid.length > 0
    ? `\nDO NOT include: ${avoid.join(', ')}`
    : ''

  switch (imageType) {
    case 'photo':
      return `${IMAGE_RULES}

Create an editorial photograph. ${style}. Mood: ${mood}.

Subject: ${direction}

${paletteBlock}${volumeBlock}${preferBlock}${avoidBlock}
${learnings}`

    case 'poster':
      return `${IMAGE_RULES}

Create abstract art. ${style}.

Concept: ${direction}

RULES:
- ONLY abstract shapes — NO text, NO letters, NO words
- Fill the entire canvas

${paletteBlock}${volumeBlock}${preferBlock}${avoidBlock}
${learnings}`

    case 'abstract':
      return `${IMAGE_RULES}

Create an abstract texture, NO people or recognizable objects. ${style}. Mood: ${mood}.

Emotional concept: ${direction}

${paletteBlock}${volumeBlock}${preferBlock}${avoidBlock}
${learnings}`

    case 'video':
      return `${IMAGE_RULES}

${direction}
${learnings}`
  }
}

// ── Main prompt builder ─────────────────────────────────────────────────────

function buildPrompt(
  imageType: ImageType,
  direction: string,
  brandName: string,
  headline?: string,
  knockout?: boolean,
  volume?: string,
): string {
  const visual = loadBrandVisual(brandName)
  const brand = loadBrand(brandName)
  const learnings = getImageContext(brandName.toLowerCase())

  // SCTY: use modular prompt system if available
  const promptSystem = (brand as any).visual?.prompt_system
  if (promptSystem) {
    return buildSctyPrompt(imageType, direction, promptSystem, learnings, knockout)
  }

  // All other brands: build from visual.image config
  const img = visual.image ?? { style: '', mood: '', avoid: [], prefer: [] }
  const volumeContext = resolveVolumeContext(brandName, volume)
  return buildGenericPrompt(
    imageType,
    direction,
    img.style,
    img.mood,
    img.prefer,
    img.avoid,
    img.palette_instructions ?? '',
    visual.palette,
    learnings,
    volumeContext,
  )
}

// ── Knockout (background removal via sharp threshold) ──────────────────────

/**
 * Remove near-white or near-black background from an image using sharp.
 * For SCTY monochrome output: detects whether bg is light or dark,
 * then thresholds to alpha.
 */
async function knockoutBackground(b64: string): Promise<string> {
  const input = Buffer.from(b64, 'base64')
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = new Uint8Array(data)
  const total = info.width * info.height

  // Sample corners to detect if background is light or dark
  let cornerSum = 0
  const cornerPixels = [
    0, // top-left
    (info.width - 1) * 4, // top-right
    (total - info.width) * 4, // bottom-left
    (total - 1) * 4, // bottom-right
  ]
  for (const offset of cornerPixels) {
    cornerSum += pixels[offset] + pixels[offset + 1] + pixels[offset + 2]
  }
  const isLightBg = cornerSum / (4 * 3) > 128

  // Threshold: make matching pixels transparent
  const threshold = 30 // tolerance for near-white/near-black
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]
    if (isLightBg) {
      // Remove near-white
      if (r > 255 - threshold && g > 255 - threshold && b > 255 - threshold) {
        pixels[i + 3] = 0
      }
    } else {
      // Remove near-black
      if (r < threshold && g < threshold && b < threshold) {
        pixels[i + 3] = 0
      }
    }
  }

  const result = await sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()

  return result.toString('base64')
}

// ── Generate ────────────────────────────────────────────────────────────────

export interface GenerateImageOptions {
  imageType: ImageType
  direction: string
  brandName: string
  volume?: string
  headline?: string
  template?: string
  ratio?: AspectRatio
  /** Remove background — render subject on transparent field */
  knockout?: boolean
}

/**
 * Generate image using provider architecture (prompt-only, no reference images).
 * Supports multiple providers: gemini (default), reve.
 * Set via env: IMAGE_PROVIDER=reve or IMAGE_PROVIDER=gemini
 */
export async function generateImage(
  imageType: ImageType,
  direction: string,
  brandName: string,
  headline?: string,
  template?: string,
  ratio?: AspectRatio,
  knockout?: boolean,
  volume?: string,
): Promise<ImageResult | null> {
  const prompt = buildPrompt(imageType, direction, brandName, headline, knockout, volume)
  console.log(`[image] Type: ${imageType}`)
  console.log(`[image] Direction: ${direction.slice(0, 80)}...`)

  // Determine aspect ratio
  let aspectRatio = '3:4'
  if (imageType === 'video' && ratio === 'portrait') {
    aspectRatio = '9:16'
  } else if (ratio === 'portrait') {
    aspectRatio = '3:4'
  } else if (ratio === 'landscape') {
    aspectRatio = '16:9'
  } else if (ratio === 'square') {
    aspectRatio = '1:1'
  }
  console.log(`[image] Aspect ratio: ${aspectRatio}`)

  // Provider selection
  const providerOrder = process.env.IMAGE_PROVIDER
    ? [process.env.IMAGE_PROVIDER.toLowerCase(), 'gemini']
    : ['gemini', 'reve']

  const uniqueProviders = [...new Set(providerOrder)]

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
      })

      console.log(`[image] Generated with ${providerName}/${result.model}`)

      let finalB64 = result.b64

      // For posters, composite into brand frame
      if (imageType === 'poster' && template) {
        console.log(`[image] Compositing into poster: ${brandName}`)
        const contentImage = Buffer.from(result.b64, 'base64')
        const posterHeadline = headline || direction.split('.')[0]

        const final = await generatePoster({
          brand: brandName.toLowerCase(),
          ratio,
          headline: posterHeadline,
          contentImage,
        })

        finalB64 = final.toString('base64')
        console.log(`[image] Text composited`)
      }

      // Knockout: remove background via threshold
      if (knockout) {
        console.log(`[image] Removing background (knockout)...`)
        finalB64 = await knockoutBackground(finalB64)
        console.log(`[image] Background removed`)
      }

      return {
        b64: finalB64,
        prompt,
        model: result.model,
        creditsUsed: result.creditsUsed,
        creditsRemaining: result.creditsRemaining,
      }
    } catch (e: any) {
      console.error(`[image] ${providerName} failed: ${e.message?.slice(0, 100)}`)
    }
  }

  console.error('[image] All providers failed')
  return null
}
