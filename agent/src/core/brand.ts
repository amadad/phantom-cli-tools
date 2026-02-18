/**
 * Brand profile loading and management
 */

import { readFileSync, existsSync, statSync } from 'fs'
import yaml from 'js-yaml'
import type { BrandProfile, BrandStyle, VisualStyle, ReferenceStyle } from './types'
import {
  getBrandConfigPath,
  getBrandDir,
  validateBrand,
  getDefaultBrand,
  discoverBrands,
  join
} from './paths'

// Cache loaded brands with modification time for invalidation
interface CacheEntry {
  brand: BrandProfile
  mtime: number
}
const brandCache = new Map<string, CacheEntry>()

/**
 * Load style guide from brands/<name>/style.yml
 * Returns undefined if not found
 */
export function loadBrandStyle(brandName: string): BrandStyle | undefined {
  const brandDir = getBrandDir(brandName)
  const stylePath = join(brandDir, 'style.yml')

  if (!existsSync(stylePath)) {
    return undefined
  }

  const content = readFileSync(stylePath, 'utf-8')
  return yaml.load(content) as BrandStyle
}

/**
 * Load brand profile from YAML file
 * Automatically invalidates cache when file changes
 */
export function loadBrand(brandName?: string): BrandProfile {
  const name = brandName || getDefaultBrand()
  validateBrand(name)

  const brandPath = getBrandConfigPath(name)

  if (!existsSync(brandPath)) {
    throw new Error(`Brand not found: ${name} (looked at ${brandPath})`)
  }

  // Check if cache is still valid
  const stats = statSync(brandPath)
  const mtime = stats.mtimeMs
  const cached = brandCache.get(name)

  if (cached && cached.mtime === mtime) {
    return cached.brand
  }

  // Cache miss or stale - reload
  const content = readFileSync(brandPath, 'utf-8')
  const brand = yaml.load(content) as BrandProfile

  // Use inline style: if present, otherwise load from style.yml
  if (!brand.style) {
    const style = loadBrandStyle(name)
    if (style) {
      brand.style = style
    }
  }

  brandCache.set(name, { brand, mtime })
  return brand
}

/**
 * Resolve palette for image generation from brand config.
 * Handles visual.palette vs style.colors fallback.
 */
export function resolvePalette(brand: BrandProfile): { background: string; primary: string; accent: string } {
  const vp = brand.visual?.palette
  const sc = brand.style?.colors
  if (vp) {
    return {
      background: vp.secondary || '#FAFAFA',
      primary: vp.primary || '#000000',
      accent: vp.accent || '#1A1A1A'
    }
  }
  return {
    background: sc?.backgrounds?.cream || '#FDFBF7',
    primary: sc?.dark || '#1E1B16',
    accent: sc?.accent || '#5046E5'
  }
}

/**
 * Resolve prompt override from brand config.
 */
export function getPromptOverride(brand: BrandProfile): string | undefined {
  return brand.visual?.prompt_override || brand.style?.prompt_override
}

/**
 * Build a short brand context string for AI selection prompts.
 */
export function buildBrandContext(brand: BrandProfile): string {
  return `${brand.name} - ${brand.voice?.tone || 'brand voice'}`
}

// Re-export for convenience
export { discoverBrands, validateBrand, getDefaultBrand }

/**
 * Clear brand cache (useful for testing/reloading)
 */
export function clearBrandCache(): void {
  brandCache.clear()
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
  const techniqueStr = direction?.technique?.join('. ') || style.technical
  const emotionStr = direction?.emotions?.join(', ') || brand.visual.mood

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
 * Detect frame type from topic
 */
export function detectFrameType(topic: string): 'announcement' | 'weekly_update' | 'event' | 'partnership' | 'thought' | 'practical_tip' {
  const topicLower = topic.toLowerCase()

  // Announcement keywords
  if (topicLower.includes('release') || topicLower.includes('launch') || topicLower.includes('ship') ||
      topicLower.includes('new feature') || topicLower.includes('announcing')) {
    return 'announcement'
  }

  // Event keywords
  if (topicLower.includes('conference') || topicLower.includes('summit') || topicLower.includes('speaking') ||
      topicLower.includes('event') || topicLower.includes('workshop')) {
    return 'event'
  }

  // Partnership keywords
  if (topicLower.includes('partner') || topicLower.includes('collaborat') || topicLower.includes('working with')) {
    return 'partnership'
  }

  // Weekly update keywords
  if (topicLower.includes('this week') || topicLower.includes('working on') || topicLower.includes('building')) {
    return 'weekly_update'
  }

  // Practical tip keywords
  if (topicLower.includes('tip') || topicLower.includes('how to') || topicLower.includes('ways to') ||
      topicLower.includes('reset') || topicLower.includes('recovery') || topicLower.includes('self-care')) {
    return 'practical_tip'
  }

  // Default to thought/observation
  return 'thought'
}

/**
 * Build content generation context from brand
 *
 * Voice modes:
 * - practical_tip: Warm brand voice (like a friend who gets it)
 * - thought: Writing system (operational, diagnostic)
 * - announcement/event/partnership: Product voice (founder/builder)
 */
export function buildVoiceContext(brand: BrandProfile, frameType?: string): string {
  const frames = brand.voice.frames
  const frame = frameType && frames ? frames[frameType] : null

  // Determine which voice mode to use
  const isProductVoice = ['announcement', 'event', 'partnership', 'weekly_update'].includes(frameType || '')
  const isBrandVoice = frameType === 'practical_tip'
  const isThoughtVoice = frameType === 'thought'

  let context = `You are writing for ${brand.name}.

VOICE:
- Tone: ${brand.voice.tone}
- Style: ${brand.voice.style}

CORE RULES:
${brand.voice.rules.map(r => `- ${r}`).join('\n')}`

  // Add product-specific rules for announcements/events
  if (isProductVoice) {
    const productRules = brand.voice.product_rules
    if (productRules) {
      context += `

PRODUCT VOICE (for this content type):
${productRules.map((r: string) => `- ${r}`).join('\n')}`
    }
  }

  // Add frame-specific guidance with examples
  if (frame) {
    context += `

=== CONTENT FRAME: ${frameType?.toUpperCase()} ===
${frame.description}

STRUCTURE:
${frame.structure}`

    // Include ALL examples for practical_tip to show the tone
    if (isBrandVoice) {
      context += `

EXAMPLE 1:
${frame.example || ''}

${frame.example_2 ? `EXAMPLE 2:\n${frame.example_2}` : ''}

${frame.example_3 ? `EXAMPLE 3:\n${frame.example_3}` : ''}

CRITICAL: Match the warm, direct tone of these examples. NO clinical language. NO jargon. Write like a friend texting, not a company posting.`
    } else if (frame.example) {
      context += `

EXAMPLE:
${frame.example}`
    }
  }

  // Only apply writing_system for "thought" posts
  if (isThoughtVoice) {
    const ws = brand.voice.writing_system
    if (ws) {
      context += `

=== WRITING SYSTEM (for thought posts only) ===
${ws.goal}

CORE RULES:
${ws.core_rules?.map((r: string) => `- ${r}`).join('\n') || ''}

LANGUAGE:
- Prefer: ${ws.language?.prefer?.join(', ') || 'concrete nouns'}
- Limit: ${ws.language?.limit?.join(', ') || 'adverbs'}

TERM REPLACEMENTS (use these operational terms):
${Object.entries(ws.language?.replacements || {}).map(([k, v]) => `- ${k} → "${v}"`).join('\n')}

HUMAN MARKERS (include 1-2):
${ws.human_markers?.slice(0, 3).map((m: string) => `- ${m}`).join('\n') || ''}

ENDING: Stop after observation. No CTA.`
    }
  }

  if (brand.voice.avoid_phrases && brand.voice.avoid_phrases.length > 0) {
    context += `

NEVER USE THESE PHRASES:
${brand.voice.avoid_phrases.map((p: string) => `- "${p}"`).join('\n')}`
  }

  return context
}

/**
 * Select the best reference style based on topic/prompt mood matching
 * Uses keyword overlap scoring to find the most relevant style
 */
export function selectReferenceStyle(
  topic: string,
  imageDescription: string,
  brand: BrandProfile
): ReferenceStyle | null {
  const referenceStyles = brand.visual.reference_styles
  if (!referenceStyles || referenceStyles.length === 0) {
    return null
  }

  const searchText = `${topic} ${imageDescription}`.toLowerCase()

  const scores = referenceStyles.map(style => {
    let score = 0

    for (const keyword of style.mood_keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        score += 2
      }
    }

    const descWords = style.description.toLowerCase().split(/\s+/)
    for (const word of descWords) {
      if (word.length > 3 && searchText.includes(word)) {
        score += 1
      }
    }

    return { style, score }
  })

  scores.sort((a, b) => b.score - a.score)

  if (scores[0].score > 0) {
    console.log(`[brand] Selected style "${scores[0].style.name}" (score: ${scores[0].score})`)
    return scores[0].style
  }

  console.log(`[brand] No keyword match, defaulting to style "${referenceStyles[0].name}"`)
  return referenceStyles[0]
}

/**
 * Get absolute paths to reference images for a style
 * Handles both local paths and remote URLs
 */
export function getAbsoluteReferenceImagePaths(
  style: ReferenceStyle,
  brandName: string
): string[] {
  const brandDir = getBrandDir(brandName)
  return style.images.map(imagePath => {
    // If it's a URL, return as-is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath
    }
    // Otherwise, treat as local path
    return join(brandDir, imagePath)
  })
}

/**
 * Build image prompt with style transfer context
 */
export function buildImagePromptWithStyleContext(
  imageDescription: string,
  brand: BrandProfile,
  style: VisualStyle,
  referenceStyle: ReferenceStyle | null
): string {
  const direction = brand.visual.image_direction
  const negativePrompts = brand.visual.avoid.join(', ')
  const techniqueStr = direction?.technique?.join('. ') || style.technical
  const emotionStr = direction?.emotions?.join(', ') || brand.visual.mood

  let prompt = `Generate an image matching this description: ${imageDescription}`

  if (referenceStyle) {
    prompt += `

STYLE TRANSFER INSTRUCTIONS:
Match the visual style, color palette, lighting, and emotional tone of the reference images provided.
The reference images exemplify the "${referenceStyle.name}" style: ${referenceStyle.description}
Visual mode: ${referenceStyle.visual_mode}`
  }

  prompt += `

MANDATORY TECHNICAL REQUIREMENTS:
${techniqueStr}

EMOTIONAL TONE: ${emotionStr}

COLOR PALETTE: Muted warm tones with ${brand.visual.palette.primary} and ${brand.visual.palette.accent} accents. Slightly desaturated, film-like color grading.

COMPOSITION: Leave negative space on one side for text overlay. Eye-level or slightly elevated camera angle.

CRITICAL - DO NOT INCLUDE:
${negativePrompts}, generic AI art style, oversaturated colors, perfect symmetry, centered composition, obvious AI artifacts, plastic skin textures, overly sharp details

STYLE REFERENCE: Editorial photography for a wellness magazine. Think Kinfolk, Cereal Magazine, or documentary photography. Intimate, authentic, lived-in feeling.`

  return prompt
}

/**
 * Modular Visual Prompt Builder
 */
export interface ModularPromptVariables {
  subject: string
  form_mode: string
  texture_mode: string
  edge_style: string
  background: string
  output_intent: string
  type_behavior?: string
}

export function buildModularPrompt(variables: ModularPromptVariables): string {
  return `MODULAR VISUAL PROMPT — MONOCHROME ABSTRACT / TYPO-GEOMETRIC / GESTURAL HYBRID

SUBJECT:
${variables.subject}
– Treated as primary visual mass, not illustrative content

CORE AESTHETIC:
– Monochrome only (black on off-white or white on black)
– High contrast
– Brutalist, modernist, experimental graphic design
– Feels archival, printed, imperfect, intentional

FORM LANGUAGE:
${variables.form_mode}

COMPOSITION:
– Central or stacked composition
– Asymmetrical balance
– Strong negative space
– Visual rhythm through repetition and variation
– No literal symmetry unless specified

TEXTURE & MATERIALITY:
${variables.texture_mode}

EDGE TREATMENT:
${variables.edge_style}

DEPTH & LAYERING:
– Flat graphic plane with implied depth
– Overlapping shapes
– Masked layers
– Transparency through pattern density, not opacity

${variables.type_behavior ? `TYPO / SYMBOL BEHAVIOR:
${variables.type_behavior}

` : ''}BACKGROUND:
${variables.background}

CONSTRAINTS:
– No color
– No realistic imagery
– No readable text unless explicitly enabled
– No shadows or lighting realism
– No gradients

OUTPUT INTENT:
${variables.output_intent}`
}

/**
 * Build modular prompt with style-specific variables
 */
export function buildModularPromptFromStyle(
  subject: string,
  referenceStyle: ReferenceStyle | null,
  outputIntent: string = 'social media post'
): string {
  let variables: ModularPromptVariables = {
    subject,
    form_mode: 'geometric modular forms (circles, quarter-circles, rectangles, grids)',
    texture_mode: 'halftone dots + photocopy noise',
    edge_style: 'sharp with minor erosion',
    background: 'raw paper off-white',
    output_intent: outputIntent
  }

  if (referenceStyle) {
    const formMode = referenceStyle.form_mode
    const textureMode = referenceStyle.texture_mode
    const edgeStyle = referenceStyle.edge_style

    if (formMode) {
      const formModes: Record<string, string> = {
        'geometric': 'geometric modular forms (circles, quarter-circles, rectangles, grids)',
        'typographic': 'distorted typographic structures (illegible, deconstructed, stretched)',
        'gestural': 'organic gestural marks (ink blots, brush strokes, calligraphic masses)',
        'halftone': 'halftone erosion / scanline interference',
        'techno': 'techno geometric, digital grid structures, warp distortion'
      }
      variables.form_mode = formModes[formMode] || formMode
    }

    if (textureMode) {
      const textureModes: Record<string, string> = {
        'risograph': 'risograph grain',
        'photocopy': 'photocopy noise',
        'halftone': 'halftone dots',
        'scanline': 'scanline banding',
        'ink_bleed': 'ink bleed',
        'paper': 'paper grain visible',
        'future': 'digital artifacts, glitch patterns'
      }
      variables.texture_mode = textureModes[textureMode] || textureMode
    }

    if (edgeStyle) {
      const edgeStyles: Record<string, string> = {
        'sharp': 'razor-sharp vector edges',
        'torn': 'torn paper edges',
        'bleed': 'fuzzy ink bleed',
        'eroded': 'partially eroded contours',
        'sharp_eroded': 'sharp with minor erosion'
      }
      variables.edge_style = edgeStyles[edgeStyle] || edgeStyle
    }
  }

  return buildModularPrompt(variables)
}
