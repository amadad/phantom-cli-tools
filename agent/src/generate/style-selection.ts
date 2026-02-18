/**
 * Style selection — AI-driven reference image selection and variation generation
 *
 * Handles:
 *  - Loading reference images from brand styles folder
 *  - Generating image variations from references via Gemini
 *  - Creating contact sheets (moodboards)
 *  - Agent-driven style selection from contact sheets or raw references
 */

import type { GoogleGenAI } from '@google/genai'
import sharp from 'sharp'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { getBrandDir, join } from '../core/paths'

export interface StyleVariation {
  name: string
  refPath: string
  image?: Buffer
  error?: string
}

export interface SelectionResult {
  styleName: string
  reasoning: string
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Load all reference images from brand styles folder
 */
export function loadReferences(brandName: string): StyleVariation[] {
  const stylesDir = join(getBrandDir(brandName), 'styles')

  if (!existsSync(stylesDir)) {
    console.error(`[style] Styles directory not found: ${stylesDir}`)
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
 * Generate a single image variation from a reference
 */
export async function generateVariation(
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

    const modelName = model === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image'
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
 * Agent selects style from original references (quick mode)
 */
export async function selectFromRefs(
  ai: GoogleGenAI,
  topic: string,
  refs: StyleVariation[],
  brandContext: string
): Promise<SelectionResult> {
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
      model: 'gemini-2.5-flash-image',
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
 * Agent selects best style from a generated contact sheet
 */
export async function selectFromContactSheet(
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
      model: 'gemini-2.5-flash-image',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/png', data: contactSheet.toString('base64') } },
          { text: prompt }
        ]
      }]
    })

    const text = (response as any).candidates?.[0]?.content?.parts?.[0]?.text || ''
    const styleMatch = text.match(/STYLE:\s*(.+)/i)
    const confidenceMatch = text.match(/CONFIDENCE:\s*(high|medium|low)/i)
    const reasoningMatch = text.match(/REASONING:\s*(.+)/is)

    return {
      styleName: styleMatch?.[1]?.trim() || styleNames[0],
      confidence: (confidenceMatch?.[1]?.toLowerCase() || 'medium') as 'high' | 'medium' | 'low',
      reasoning: reasoningMatch?.[1]?.trim() || 'Default selection'
    }
  } catch (e: any) {
    console.error(`[style] Selection failed: ${e.message}`)
    return {
      styleName: styleNames[0],
      confidence: 'low',
      reasoning: 'Fallback to first style due to error'
    }
  }
}

/**
 * Create labeled contact sheet from variations
 */
export async function createContactSheet(
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

  const composite = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 253, g: 251, b: 247, alpha: 1 }
    }
  })

  const overlays: sharp.OverlayOptions[] = []

  for (let i = 0; i < successful.length; i++) {
    const v = successful[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = padding + col * (cellSize + padding)
    const y = padding + row * (cellSize + labelHeight + padding)

    const resized = await sharp(v.image)
      .resize(cellSize, cellSize, { fit: 'cover' })
      .png()
      .toBuffer()

    overlays.push({ input: resized, left: x, top: y })

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
