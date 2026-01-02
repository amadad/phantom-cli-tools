/**
 * Brand profile loading and management
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'
import type { BrandProfile, VisualStyle, ReferenceStyle } from './types'

// Cache loaded brands
const brandCache = new Map<string, BrandProfile>()

/**
 * Load brand profile from YAML file
 */
export function loadBrand(brandName: string = 'givecare'): BrandProfile {
  if (brandCache.has(brandName)) {
    return brandCache.get(brandName)!
  }

  const brandPath = join(process.cwd(), '..', 'brands', `${brandName}.yml`)

  if (!existsSync(brandPath)) {
    throw new Error(`Brand not found: ${brandName} (looked at ${brandPath})`)
  }

  const content = readFileSync(brandPath, 'utf-8')
  const brand = yaml.load(content) as BrandProfile

  brandCache.set(brandName, brand)
  return brand
}

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
 * Build content generation context from brand
 */
export function buildVoiceContext(brand: BrandProfile): string {
  const ws = brand.voice.writing_system as any

  let context = `You are writing for ${brand.name}.

VOICE:
- Tone: ${brand.voice.tone}
- Style: ${brand.voice.style}

RULES:
${brand.voice.rules.map(r => `- ${r}`).join('\n')}`

  if (ws) {
    context += `

=== WRITING SYSTEM ===
${ws.goal}

CORE RULES:
${ws.core_rules?.map((r: string) => `- ${r}`).join('\n') || ''}

CHOOSE ONE ENGINE (based on topic):
${Object.entries(ws.engines || {}).map(([name, engine]: [string, any]) =>
  `- ${name.toUpperCase()}: ${engine.description} (use for: ${engine.use_for.join(', ')})`
).join('\n')}

CHOOSE ONE STRUCTURE:
${ws.structures?.map((s: any) =>
  `- ${s.name}: ${s.pattern}`
).join('\n') || ''}

LANGUAGE CONSTRAINTS:
Prefer: ${ws.language?.prefer?.join(', ') || 'concrete nouns, operational verbs'}
Limit: ${ws.language?.limit?.join(', ') || 'abstract virtues, adverbs'}

TERM REPLACEMENTS (use operational language):
${Object.entries(ws.language?.replacements || {}).map(([old, replacement]) =>
  `- "${old}" → "${replacement}"`
).join('\n')}

TRAUMA-INFORMED:
${ws.trauma_informed?.map((r: string) => `- ${r}`).join('\n') || ''}

HUMAN MARKERS (include 1-2 per piece):
${ws.human_markers?.slice(0, 5).map((m: string) => `- ${m}`).join('\n') || ''}

ENDINGS:
- AVOID: ${ws.endings?.avoid?.join(', ') || 'CTAs, inspirational wrap-ups'}
- PREFER: ${ws.endings?.prefer?.join(', ') || 'stop after observation'}`
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
 */
export function getAbsoluteReferenceImagePaths(
  style: ReferenceStyle,
  brandName: string
): string[] {
  const brandDir = join(process.cwd(), '..', 'brands', brandName)
  return style.images.map(imagePath => join(brandDir, imagePath))
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
 * SCTY Modular Visual Prompt Builder
 */
export interface SCTYPromptVariables {
  subject: string
  form_mode: string
  texture_mode: string
  edge_style: string
  background: string
  output_intent: string
  type_behavior?: string
}

export function buildSCTYPrompt(variables: SCTYPromptVariables): string {
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
 * Build SCTY prompt with style-specific variables
 */
export function buildSCTYPromptFromStyle(
  subject: string,
  referenceStyle: ReferenceStyle | null,
  outputIntent: string = 'social media post'
): string {
  let variables: SCTYPromptVariables = {
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

  return buildSCTYPrompt(variables)
}
