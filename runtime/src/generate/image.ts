/**
 * Source image generation.
 *
 * When Gemini is available, generates a source image from brand.visual.image_prompt.
 * When no API key is set, returns null (social.ts handles its own fallback).
 */

import { writeFileSync } from 'fs'
import { join } from 'path'
import type { BrandFoundation } from '../domain/types'
import { ensureParentDir, type RuntimePaths } from '../core/paths'

interface SourceImageOptions {
  brand: BrandFoundation
  paths: RuntimePaths
  runId: string
  topic: string
}

function buildPrompt(brand: BrandFoundation, topic: string): string {
  if (brand.visual.imagePrompt) {
    return brand.visual.imagePrompt.replace(/\[SUBJECT\]/gi, topic)
  }

  return [
    `A warm, abstract visual about ${topic}.`,
    `Color palette: ${brand.visual.palette.background}, ${brand.visual.palette.primary}, ${brand.visual.palette.accent}.`,
    `No text, no logos, no watermarks.`,
  ].join(' ')
}

export async function generateSourceImage(options: SourceImageOptions): Promise<{ imagePath: string; provider: string } | null> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!key) return null

  const prompt = buildPrompt(options.brand, options.topic)
  const outputPath = join(options.paths.artifactsDir, options.runId, 'source-image.png')

  try {
    const { GoogleGenAI } = await import('@google/genai')
    const client = new GoogleGenAI({ apiKey: key })

    const response = await client.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    })

    const parts = response.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p) => p.inlineData?.mimeType?.startsWith('image/'))
    if (!imagePart?.inlineData?.data) return null

    ensureParentDir(outputPath)
    writeFileSync(outputPath, Buffer.from(imagePart.inlineData.data, 'base64'))

    return { imagePath: outputPath, provider: 'gemini-3.1-flash-image-preview' }
  } catch {
    return null
  }
}
