/**
 * Gemini image generation provider
 * Uses Google's Gemini 3 Pro Image and 2.0 Flash models
 */

import { GoogleGenAI } from '@google/genai'
import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResult
} from './index'

export class GeminiProvider implements ImageProvider {
  name = 'gemini'
  private apiKey: string | undefined
  private models = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image']

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY
  }

  isAvailable(): boolean {
    return !!this.apiKey
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not set')
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey })

    // Try each model in sequence
    for (const model of this.models) {
      try {
        console.log(`[gemini] Trying ${model}...`)

        // Determine config based on model
        const config = model.includes('gemini-3-pro-image')
          ? { imageConfig: { aspectRatio: request.aspectRatio, imageSize: '2K' } }
          : { responseModalities: ['Text', 'Image'], imageConfig: { aspectRatio: request.aspectRatio } }

        console.log(`[gemini] Config:`, JSON.stringify(config))

        const parts: any[] = [{ text: request.prompt }]

        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: config as any
        })

        const candidate = (response as any).candidates?.[0]
        if (!candidate?.content?.parts) continue

        // Extract image data from response
        for (const part of candidate.content.parts) {
          if (part.inlineData?.data) {
            console.log(`[gemini] Generated with ${model}`)
            return {
              b64: part.inlineData.data,
              model
            }
          }
        }
      } catch (e: any) {
        console.error(`[gemini] ${model} failed: ${e.message?.slice(0, 100)}`)
      }
    }

    throw new Error('All Gemini models failed')
  }
}
