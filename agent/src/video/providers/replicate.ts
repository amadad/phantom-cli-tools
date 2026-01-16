/**
 * Replicate provider for Kling video generation
 *
 * IMPORTANT: Kling ignores aspect_ratio when start_image is provided
 * Source image MUST be 9:16 (1080x1920) for vertical output
 */

import Replicate from 'replicate'
import * as fs from 'fs'
import * as path from 'path'
import type { VideoProvider, VideoGenerationOptions, RawVideoResult, InputMode } from './index'

const KLING_MODEL = 'kwaivgi/kling-v1.6-pro'

export class ReplicateProvider implements VideoProvider {
  name = 'replicate'
  inputModes: InputMode[] = ['public_url', 'local_path']

  private client: Replicate

  constructor() {
    this.client = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    })
  }

  async prepareInput(input: string | Buffer): Promise<string> {
    // If it's already a URL, return as-is
    if (typeof input === 'string' && input.startsWith('http')) {
      return input
    }

    // If it's a local file path, read and convert to data URI
    if (typeof input === 'string' && fs.existsSync(input)) {
      const buffer = fs.readFileSync(input)
      const ext = path.extname(input).slice(1).toLowerCase()
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
      return `data:${mimeType};base64,${buffer.toString('base64')}`
    }

    // If it's a buffer, convert to data URI
    if (Buffer.isBuffer(input)) {
      return `data:image/png;base64,${input.toString('base64')}`
    }

    throw new Error('Invalid input: expected URL, file path, or Buffer')
  }

  async generateFromImage(
    preparedInput: string,
    prompt: string,
    options: VideoGenerationOptions
  ): Promise<RawVideoResult> {
    console.log(`[replicate] Starting Kling generation...`)
    console.log(`[replicate] Prompt: ${prompt.slice(0, 100)}...`)
    console.log(`[replicate] Duration: ${options.duration}s`)

    // Map motion style to prompt modifiers
    const motionModifier = {
      subtle: 'subtle motion, minimal movement, steady',
      moderate: 'gentle motion, smooth movement',
      dynamic: 'dynamic motion, energetic movement'
    }[options.motionStyle]

    const fullPrompt = `${motionModifier}, ${prompt}`

    const input: Record<string, unknown> = {
      prompt: fullPrompt,
      start_image: preparedInput,
      duration: options.duration
    }

    if (options.negativePrompt) {
      input.negative_prompt = options.negativePrompt
    }

    // Run the model (this blocks until complete)
    const output = await this.client.run(KLING_MODEL, { input })

    // Output is a URL to the video
    const videoUrl = output as unknown as string
    console.log(`[replicate] Generation complete: ${videoUrl}`)

    // Download the video
    const response = await fetch(videoUrl)
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    return {
      buffer,
      reportedDuration: options.duration,
      width: 0,  // Unknown until we probe
      height: 0,
      provider: 'replicate'
    }
  }
}
