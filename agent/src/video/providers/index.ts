/**
 * Video provider abstraction
 * Handles different input modes (local file, public URL, data URI)
 */

export type InputMode = 'local_path' | 'public_url' | 'data_uri' | 'upload_uri'

export interface VideoGenerationOptions {
  duration: 5 | 10
  motionStyle: 'subtle' | 'moderate' | 'dynamic'
  negativePrompt?: string
}

export interface RawVideoResult {
  buffer: Buffer
  reportedDuration: number  // Don't trust - measure with ffprobe
  width: number
  height: number
  provider: string
}

export interface VideoProvider {
  name: string
  inputModes: InputMode[]

  /**
   * Prepare input for this provider
   * If provider needs URL but we have file, upload first
   */
  prepareInput(input: string | Buffer): Promise<string>

  /**
   * Generate video from image
   */
  generateFromImage(
    preparedInput: string,
    prompt: string,
    options: VideoGenerationOptions
  ): Promise<RawVideoResult>
}

export async function createProvider(name: string): Promise<VideoProvider> {
  switch (name) {
    case 'replicate': {
      const { ReplicateProvider } = await import('./replicate')
      return new ReplicateProvider()
    }
    case 'runway':
      throw new Error('Runway provider not implemented yet')
    case 'luma':
      throw new Error('Luma provider not implemented yet')
    default:
      throw new Error(`Unknown video provider: ${name}`)
  }
}
