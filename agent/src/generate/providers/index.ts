/**
 * Image provider abstraction
 * Supports multiple image generation APIs (Gemini, Reve, etc.)
 */

import type { ImageType } from '../classify'

export interface ImageGenerationRequest {
  prompt: string
  imageType: ImageType
  aspectRatio: string  // Aspect ratio string like '3:4', '16:9', etc.
}

export interface ImageGenerationResult {
  b64: string
  model: string
  creditsUsed?: number
  creditsRemaining?: number
  requestId?: string
}

export interface ImageProvider {
  name: string

  /**
   * Check if provider is available (API key set, etc.)
   */
  isAvailable(): boolean

  /**
   * Generate image from prompt
   */
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>
}

/**
 * Factory function to create provider instances
 */
export async function createImageProvider(name: string): Promise<ImageProvider> {
  switch (name.toLowerCase()) {
    case 'gemini': {
      const { GeminiProvider } = await import('./gemini')
      return new GeminiProvider()
    }
    case 'reve': {
      const { ReveProvider } = await import('./reve')
      return new ReveProvider()
    }
    default:
      throw new Error(`Unknown image provider: ${name}`)
  }
}
