/**
 * Video generation module using Replicate
 * Supports image-to-video and text-to-video generation
 */

export interface VideoGenerationResult {
  success: boolean
  videoUrl?: string
  error?: string
  model: string
  duration?: number
}

export interface VideoGenerationOptions {
  // For image-to-video
  imageUrl?: string
  // For text-to-video
  prompt?: string
  // Common options
  aspectRatio?: '16:9' | '9:16' | '1:1'
  duration?: number // seconds
  fps?: number
}

/**
 * Generate video from an image using Replicate's Stable Video Diffusion
 * Great for creating subtle motion from static images
 */
export async function generateVideoFromImage(
  imageUrl: string,
  options: {
    motionBucketId?: number // 1-255, higher = more motion
    fps?: number
    seed?: number
  } = {}
): Promise<VideoGenerationResult> {
  const apiToken = process.env.REPLICATE_API_TOKEN
  if (!apiToken) {
    return { success: false, error: 'REPLICATE_API_TOKEN not set', model: 'stable-video-diffusion' }
  }

  try {
    console.log('[video] Starting image-to-video generation...')

    // Use Stable Video Diffusion
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'dc6e55fb4c79e8f7684ec1c4e3b4fca00f8ea8b9b9c5bcba4d1f0e9f2a75dc0b',
        input: {
          input_image: imageUrl,
          motion_bucket_id: options.motionBucketId || 127,
          fps: options.fps || 6,
          seed: options.seed
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.status}`)
    }

    const prediction = await response.json()
    console.log(`[video] Prediction created: ${prediction.id}`)

    // Poll for completion
    const result = await pollForCompletion(prediction.id, apiToken)

    if (result.status === 'succeeded' && result.output) {
      console.log('[video] Video generation complete')
      return {
        success: true,
        videoUrl: result.output,
        model: 'stable-video-diffusion',
        duration: 4 // SVD generates ~4 second clips
      }
    } else {
      throw new Error(result.error || 'Video generation failed')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[video] Error:', message)
    return { success: false, error: message, model: 'stable-video-diffusion' }
  }
}

/**
 * Generate video from text prompt using Replicate's AnimateDiff
 * Good for creating animated content from descriptions
 */
export async function generateVideoFromText(
  prompt: string,
  options: {
    negativePrompt?: string
    width?: number
    height?: number
    numFrames?: number
    fps?: number
    seed?: number
  } = {}
): Promise<VideoGenerationResult> {
  const apiToken = process.env.REPLICATE_API_TOKEN
  if (!apiToken) {
    return { success: false, error: 'REPLICATE_API_TOKEN not set', model: 'animatediff' }
  }

  try {
    console.log('[video] Starting text-to-video generation...')

    // Use AnimateDiff Lightning for fast generation
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'c5c1d8c80e9e3a5f0c9b8c4a7d6f2e1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4',
        input: {
          prompt: prompt,
          negative_prompt: options.negativePrompt || 'low quality, blurry, distorted',
          width: options.width || 512,
          height: options.height || 512,
          num_frames: options.numFrames || 16,
          fps: options.fps || 8,
          seed: options.seed
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.status}`)
    }

    const prediction = await response.json()
    console.log(`[video] Prediction created: ${prediction.id}`)

    // Poll for completion
    const result = await pollForCompletion(prediction.id, apiToken)

    if (result.status === 'succeeded' && result.output) {
      console.log('[video] Video generation complete')
      return {
        success: true,
        videoUrl: result.output,
        model: 'animatediff',
        duration: (options.numFrames || 16) / (options.fps || 8)
      }
    } else {
      throw new Error(result.error || 'Video generation failed')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[video] Error:', message)
    return { success: false, error: message, model: 'animatediff' }
  }
}

/**
 * Generate a YouTube Short from an image
 * Uses image-to-video with vertical aspect ratio
 */
export async function generateYouTubeShort(
  imageUrl: string,
  options: {
    prompt?: string
    motionIntensity?: 'low' | 'medium' | 'high'
  } = {}
): Promise<VideoGenerationResult> {
  const motionBucketId = {
    low: 50,
    medium: 127,
    high: 200
  }[options.motionIntensity || 'medium']

  return generateVideoFromImage(imageUrl, {
    motionBucketId,
    fps: 24 // Higher FPS for Shorts
  })
}

/**
 * Poll Replicate for prediction completion
 */
async function pollForCompletion(
  predictionId: string,
  apiToken: string,
  maxWaitMs: number = 300000 // 5 minutes
): Promise<{ status: string; output?: string; error?: string }> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${apiToken}` }
    })

    if (!response.ok) {
      throw new Error(`Polling failed: ${response.status}`)
    }

    const prediction = await response.json()

    if (prediction.status === 'succeeded') {
      return { status: 'succeeded', output: prediction.output }
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      return { status: prediction.status, error: prediction.error }
    }

    // Wait 2 seconds before polling again
    await new Promise(r => setTimeout(r, 2000))
    console.log(`[video] Status: ${prediction.status}...`)
  }

  return { status: 'timeout', error: 'Video generation timed out' }
}

/**
 * Download video from URL to local file
 */
export async function downloadVideo(
  videoUrl: string,
  outputPath: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const fs = await import('fs/promises')
    const response = await fetch(videoUrl)

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    await fs.writeFile(outputPath, buffer)

    console.log(`[video] Downloaded to: ${outputPath}`)
    return { success: true, path: outputPath }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}
