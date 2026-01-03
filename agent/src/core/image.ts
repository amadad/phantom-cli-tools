/**
 * Image generation using Google Gemini
 * Primary: gemini-2.5-flash-image - cheap, fast
 * Expensive: gemini-3-pro-image-preview - high quality, style transfer
 *
 * Text generation uses gemini-3-flash-preview (separate)
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { GoogleGenAI } from '@google/genai'
import type { ImageResult, AspectRatio, ImageGenerationConfig } from './types'

const MODELS = {
  cheap: 'gemini-2.5-flash-image',
  expensive: 'gemini-3-pro-image-preview'
} as const

type ImageResolution = '1K' | '2K' | '4K'

/**
 * Load image (file or URL) and convert to base64
 */
async function loadImageAsBase64(imagePath: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    // Handle URLs
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      console.log(`[image] Fetching reference image: ${imagePath.slice(0, 60)}...`)
      const response = await fetch(imagePath)
      if (!response.ok) {
        console.log(`[image] Failed to fetch reference image: ${response.status}`)
        return null
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      const base64 = buffer.toString('base64')
      const contentType = response.headers.get('content-type') || 'image/png'
      const mimeType = contentType.includes('jpeg') || contentType.includes('jpg') ? 'image/jpeg' : 'image/png'
      return { data: base64, mimeType }
    }

    // Handle local files
    if (!existsSync(imagePath)) {
      console.log(`[image] Reference image not found: ${imagePath}`)
      return null
    }

    const buffer = readFileSync(imagePath)
    const base64 = buffer.toString('base64')

    const ext = imagePath.toLowerCase().split('.').pop()
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'

    return { data: base64, mimeType }
  } catch (error) {
    console.error(`[image] Failed to load reference image: ${imagePath}`, error)
    return null
  }
}

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

/**
 * Generate image with reference images for style transfer
 * Uses Gemini 3 Pro Preview which supports up to 14 reference images
 */
export async function generateImageWithReferences(
  prompt: string,
  referenceImagePaths: string[],
  options: {
    aspectRatio?: AspectRatio
    resolution?: ImageResolution
    modelConfig?: ImageGenerationConfig
  } = {}
): Promise<ImageResult | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set')
  }

  const {
    aspectRatio = '1:1',
    resolution = '2K',
    modelConfig
  } = options

  const ai = new GoogleGenAI({ apiKey })

  // Load reference images (handles both local files and URLs)
  const loadedImages: { data: string; mimeType: string }[] = []
  for (const imagePath of referenceImagePaths.slice(0, 6)) {
    const imageData = await loadImageAsBase64(imagePath)
    if (imageData) {
      loadedImages.push(imageData)
    }
  }

  console.log(`[image] Loaded ${loadedImages.length}/${referenceImagePaths.length} reference images`)

  if (loadedImages.length === 0) {
    console.log(`[image] No reference images available, falling back to text-only generation`)
    return generateImage(prompt, { aspectRatio, preferExpensive: true })
  }

  // Build content array with prompt + reference images
  const contents: any[] = [
    { text: prompt }
  ]

  for (const img of loadedImages) {
    contents.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data
      }
    })
  }

  const primaryModel = modelConfig?.primary_model || MODELS.expensive
  const fallbackModel = modelConfig?.fallback_model || MODELS.cheap
  const modelsToTry = [primaryModel, fallbackModel]

  for (const model of modelsToTry) {
    try {
      console.log(`[image] Trying ${model} with ${loadedImages.length} reference images...`)

      const imageConfig: any = { aspectRatio }
      if (model === MODELS.expensive) {
        imageConfig.imageSize = resolution
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig
        }
      } as any)

      const candidate = response.candidates?.[0]
      if (!candidate?.content?.parts) {
        console.log(`[image] No content in response from ${model}`)
        continue
      }

      for (const part of candidate.content.parts) {
        if ((part as any).thought) {
          continue
        }

        if ((part as any).inlineData?.data) {
          const imageBase64 = (part as any).inlineData.data
          console.log(`[image] Generated with ${model} (${resolution}, ${loadedImages.length} refs)`)

          return {
            url: `data:image/png;base64,${imageBase64}`,
            prompt,
            model,
            metadata: {
              format: 'png',
              aspectRatio,
              b64: imageBase64,
              referenceCount: loadedImages.length,
              resolution
            }
          }
        }

        if ((part as any).text && !(part as any).thought) {
          console.log(`[image] Model says: ${(part as any).text.substring(0, 100)}...`)
        }
      }

      console.log(`[image] No image data in response from ${model}`)
    } catch (error: any) {
      console.error(`[image] ${model} failed:`, error?.message || error)
    }
  }

  console.log(`[image] Reference-based generation failed, trying text-only fallback`)
  return generateImage(prompt, { aspectRatio, preferExpensive: true })
}

/**
 * Save base64 image to file
 */
export function saveImage(imageResult: ImageResult, outputPath: string): string {
  const dir = dirname(outputPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const b64 = imageResult.metadata.b64 || imageResult.url.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(b64, 'base64')
  writeFileSync(outputPath, buffer)

  console.log(`[image] Saved to ${outputPath}`)
  return outputPath
}
