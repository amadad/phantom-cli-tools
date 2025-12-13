/**
 * Brand profile loading and management
 * Server-only module - uses dynamic imports for Node.js modules
 */

import type { BrandProfile, VisualStyle } from './types'

// Cache loaded brands
const brandCache = new Map<string, BrandProfile>()

/**
 * Load brand profile from YAML file
 */
export async function loadBrand(brandName: string = 'givecare'): Promise<BrandProfile> {
  if (brandCache.has(brandName)) {
    return brandCache.get(brandName)!
  }

  // Dynamic imports for Node.js modules
  const { readFileSync, existsSync } = await import('fs')
  const { join } = await import('path')
  const yaml = await import('js-yaml')

  const brandPath = join(process.cwd(), '..', 'brands', `${brandName}.yml`)

  if (!existsSync(brandPath)) {
    throw new Error(`Brand not found: ${brandName}`)
  }

  const content = readFileSync(brandPath, 'utf-8')
  const brand = yaml.load(content) as BrandProfile

  brandCache.set(brandName, brand)
  return brand
}

/**
 * Get visual style from brand + optional gallery extraction
 */
export function getBrandVisualStyle(brand: BrandProfile, galleryStyle?: VisualStyle): VisualStyle {
  if (galleryStyle) {
    return galleryStyle
  }

  const direction = brand.visual.image_direction
  const technique = direction?.technique?.slice(0, 3).join(', ') || 'shallow depth of field, natural light'

  return {
    lighting: 'soft natural window light, directional, golden hour feel',
    composition: 'documentary style, authentic moments, negative space for text',
    colorGrading: `muted warm tones, slightly desaturated, ${brand.visual.palette.primary} accents`,
    technical: technique,
    atmosphere: direction?.emotions?.join(', ') || brand.visual.mood
  }
}

/**
 * Build image prompt from topic and brand
 * Creates a highly specific, cinematic prompt that avoids generic AI imagery
 */
export function buildImagePrompt(imageDescription: string, brand: BrandProfile, style: VisualStyle): string {
  const direction = brand.visual.image_direction
  const negativePrompts = brand.visual.avoid.join(', ')

  // Build technique string
  const techniqueStr = direction?.technique?.join('. ') || style.technical

  // Build emotional context
  const emotionStr = direction?.emotions?.join(', ') || brand.visual.mood

  // Construct a cinematic, specific prompt
  return `${imageDescription}

MANDATORY TECHNICAL REQUIREMENTS:
${techniqueStr}

EMOTIONAL TONE: ${emotionStr}

COLOR PALETTE: Muted warm tones with ${brand.visual.palette.primary} and ${brand.visual.palette.accent} accents. Slightly desaturated, film-like color grading.

COMPOSITION: Leave negative space on one side for text overlay. Eye-level or slightly elevated camera angle.

CRITICAL - DO NOT INCLUDE:
${negativePrompts}, generic AI art style, oversaturated colors, perfect symmetry, centered composition, obvious AI artifacts, plastic skin textures, overly sharp details

STYLE REFERENCE: Editorial photography for a wellness magazine. Think Kinfolk, Cereal Magazine, or documentary photography by Nan Goldin. Intimate, authentic, lived-in feeling.`
}

/**
 * Build content generation context from brand
 */
export function buildVoiceContext(brand: BrandProfile): string {
  return `You are writing for ${brand.name}.

VOICE:
- Tone: ${brand.voice.tone}
- Style: ${brand.voice.style}

RULES:
${brand.voice.rules.map(r => `- ${r}`).join('\n')}

Write content that sounds like a trusted friend who understands the audience's challenges.`
}
