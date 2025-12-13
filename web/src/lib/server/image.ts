/**
 * Image generation using Google Gemini
 * Primary: gemini-2.5-flash-image (Nano Banana) - cheap, fast
 * Fallback: gemini-3-pro-image-preview (Nano Banana Pro) - expensive, high quality
 *
 * Server-only module - uses dynamic imports
 */

import type { ImageResult, AspectRatio } from './types'

const MODELS = {
  cheap: 'gemini-2.5-flash-image',
  expensive: 'gemini-3-pro-image-preview'
} as const

/**
 * Generate image using Gemini image models
 * Tries cheap model first, falls back to expensive if it fails
 */
export async function generateImage(
  prompt: string,
  options: {
    aspectRatio?: AspectRatio
    preferExpensive?: boolean
  } = {}
): Promise<ImageResult | null> {
  // Dynamic import for @google/genai
  const { GoogleGenAI } = await import('@google/genai')

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set')
  }

  const { aspectRatio = '1:1', preferExpensive = false } = options
  const ai = new GoogleGenAI({ apiKey })
  const modelsToTry = preferExpensive
    ? [MODELS.expensive, MODELS.cheap]
    : [MODELS.cheap, MODELS.expensive]

  for (const model of modelsToTry) {
    try {
      console.log(`[image] Trying ${model}...`)

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
          imageConfig: {
            aspectRatio
          }
        }
      } as any)

      const candidate = response.candidates?.[0]
      if (!candidate?.content?.parts) {
        console.log(`[image] No content in response from ${model}`)
        continue
      }

      for (const part of candidate.content.parts) {
        if ((part as any).inlineData?.data) {
          const imageBase64 = (part as any).inlineData.data
          console.log(`[image] Generated with ${model}`)

          return {
            url: `data:image/png;base64,${imageBase64}`,
            prompt,
            model,
            metadata: {
              format: 'png',
              aspectRatio,
              b64: imageBase64
            }
          }
        }

        if ((part as any).text) {
          console.log(`[image] Model says: ${(part as any).text.substring(0, 100)}...`)
        }
      }

      console.log(`[image] No image data in response from ${model}`)
    } catch (error: any) {
      console.error(`[image] ${model} failed:`, error?.message || error)
    }
  }

  console.error(`[image] All models failed`)
  return null
}
