/**
 * Reve AI image generation provider
 * Supports create (text-to-image) and remix (image editing with references)
 */

import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResult
} from './index'

interface ReveCreateRequest {
  prompt: string
  aspect_ratio: string
  version: string
}

interface ReveRemixRequest {
  prompt: string
  reference_images: string[]  // base64 strings
  aspect_ratio: string
  version: string
}

interface ReveResponse {
  image: string  // base64
  request_id: string
  credits_used: number
  credits_remaining: number
  content_violation?: boolean
}

/**
 * Map phantom-loom aspect ratios to Reve format
 */
function mapAspectRatio(ratio: string): string {
  const mapping: Record<string, string> = {
    '1:1': '1:1',
    '2:3': '2:3',
    '3:2': '3:2',
    '3:4': '3:4',
    '4:3': '4:3',
    '4:5': '4:3',  // Reve doesn't support 4:5, use 4:3
    '5:4': '4:3',  // Reve doesn't support 5:4, use 4:3
    '9:16': '9:16',
    '16:9': '16:9',
    '21:9': '16:9'  // Reve doesn't support 21:9, use 16:9
  }
  return mapping[ratio] || '3:2'
}

export class ReveProvider implements ImageProvider {
  name = 'reve'
  private apiKey: string | undefined
  private baseUrl = 'https://api.reve.com/v1'

  constructor() {
    this.apiKey = process.env.REVE_API_KEY
  }

  isAvailable(): boolean {
    return !!this.apiKey
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!this.apiKey) {
      throw new Error('REVE_API_KEY not set')
    }

    const aspectRatio = mapAspectRatio(request.aspectRatio)

    // Use remix endpoint if reference images available, otherwise create
    if (request.reference || request.additionalReferences) {
      return this.remix(request, aspectRatio)
    } else {
      return this.create(request, aspectRatio)
    }
  }

  /**
   * Create new image from text prompt
   */
  private async create(request: ImageGenerationRequest, aspectRatio: string): Promise<ImageGenerationResult> {
    console.log('[reve] Using /v1/image/create endpoint')

    const payload: ReveCreateRequest = {
      prompt: request.prompt,
      aspect_ratio: aspectRatio,
      version: 'latest'
    }

    const response = await fetch(`${this.baseUrl}/image/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Reve create failed: ${response.status} ${error}`)
    }

    const result: ReveResponse = await response.json()

    if (result.content_violation) {
      throw new Error('Reve flagged content policy violation')
    }

    if (!result.image) {
      throw new Error('Reve response missing image data')
    }

    console.log(`[reve] Created image (request: ${result.request_id})`)
    console.log(`[reve] Credits: ${result.credits_used} used, ${result.credits_remaining} remaining`)

    return {
      b64: result.image,
      model: 'reve/create',
      creditsUsed: result.credits_used,
      creditsRemaining: result.credits_remaining,
      requestId: result.request_id
    }
  }

  /**
   * Remix images with references
   * Can reference images in prompt as <img>1</img>, <img>2</img>, etc.
   */
  private async remix(request: ImageGenerationRequest, aspectRatio: string): Promise<ImageGenerationResult> {
    console.log('[reve] Using /v1/image/remix endpoint')

    const referenceImages: string[] = []

    if (request.reference) {
      referenceImages.push(request.reference.b64)
    }

    if (request.additionalReferences) {
      referenceImages.push(...request.additionalReferences.map(r => r.b64))
    }

    // Enhance prompt to reference the images
    let enhancedPrompt = request.prompt
    if (referenceImages.length === 1) {
      enhancedPrompt = `Match the style, mood, and aesthetic of <img>1</img>. ${request.prompt}`
    } else if (referenceImages.length > 1) {
      enhancedPrompt = `Combine elements from the reference images. ${request.prompt}`
    }

    const payload: ReveRemixRequest = {
      prompt: enhancedPrompt,
      reference_images: referenceImages,
      aspect_ratio: aspectRatio,
      version: 'latest'
    }

    console.log(`[reve] Remixing with ${referenceImages.length} reference(s)`)

    const response = await fetch(`${this.baseUrl}/image/remix`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Reve remix failed: ${response.status} ${error}`)
    }

    const result: ReveResponse = await response.json()

    if (result.content_violation) {
      throw new Error('Reve flagged content policy violation')
    }

    if (!result.image) {
      throw new Error('Reve response missing image data')
    }

    console.log(`[reve] Remixed image (request: ${result.request_id})`)
    console.log(`[reve] Credits: ${result.credits_used} used, ${result.credits_remaining} remaining`)

    return {
      b64: result.image,
      model: 'reve/remix',
      creditsUsed: result.credits_used,
      creditsRemaining: result.credits_remaining,
      requestId: result.request_id
    }
  }
}
