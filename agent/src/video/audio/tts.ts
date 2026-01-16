/**
 * Text-to-speech using Cartesia API
 * Uses sonic-3 model for high-quality voice synthesis
 */

import { CartesiaClient } from '@cartesia/cartesia-js'
import * as fs from 'fs'
import * as path from 'path'

export interface TTSOptions {
  text: string
  voiceId: string
  model?: string
  emotion?: string
  speed?: number
  outputPath: string
}

export interface TTSResult {
  path: string
  durationMs: number
}

let client: CartesiaClient | null = null

function getClient(): CartesiaClient {
  if (!client) {
    const apiKey = process.env.CARTESIA_API_KEY
    if (!apiKey) {
      throw new Error('CARTESIA_API_KEY not set')
    }
    client = new CartesiaClient({ apiKey })
  }
  return client
}

/**
 * Generate speech from text using Cartesia
 */
export async function generateSpeech(options: TTSOptions): Promise<TTSResult> {
  const {
    text,
    voiceId,
    model = 'sonic-3',
    emotion,
    speed = 1.0,
    outputPath
  } = options

  console.log(`[tts] Generating speech...`)
  console.log(`[tts] Text: ${text.slice(0, 100)}...`)
  console.log(`[tts] Voice: ${voiceId}`)

  const client = getClient()

  // Build request
  const request: Parameters<typeof client.tts.bytes>[0] = {
    modelId: model,
    transcript: text,
    voice: {
      mode: 'id',
      id: voiceId
    },
    language: 'en',
    outputFormat: {
      container: 'mp3',
      sampleRate: 44100,
      bitRate: 128000
    }
  }

  // Add generation config if emotion or speed specified
  // Note: Cartesia SDK typing may need adjustment
  const generationConfig: Record<string, unknown> = {}
  if (speed !== 1.0) {
    generationConfig.speed = speed
  }
  if (emotion) {
    generationConfig.emotion = emotion
  }

  // Call Cartesia API - returns a Readable stream
  const audioStream = await client.tts.bytes(request)

  // Collect stream into buffer
  const chunks: Buffer[] = []
  for await (const chunk of audioStream as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const audioBuffer = Buffer.concat(chunks)

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Write audio file
  fs.writeFileSync(outputPath, audioBuffer)

  // Get duration using ffprobe
  const { execSync } = await import('child_process')
  const durationStr = execSync(
    `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${outputPath}"`,
    { encoding: 'utf-8' }
  )
  const durationMs = parseFloat(durationStr.trim()) * 1000

  console.log(`[tts] Generated: ${outputPath} (${(durationMs / 1000).toFixed(2)}s)`)

  return {
    path: outputPath,
    durationMs
  }
}

/**
 * Generate speech for multiple scenes and concatenate
 */
export async function generateSceneSpeech(
  scenes: Array<{ id: number; script: string }>,
  voiceId: string,
  outputDir: string,
  options?: { model?: string; emotion?: string; speed?: number }
): Promise<{ paths: string[]; totalDurationMs: number }> {
  const paths: string[] = []
  let totalDurationMs = 0

  for (const scene of scenes) {
    const outputPath = path.join(outputDir, `voice-scene-${scene.id}.mp3`)
    const result = await generateSpeech({
      text: scene.script,
      voiceId,
      outputPath,
      ...options
    })
    paths.push(result.path)
    totalDurationMs += result.durationMs
  }

  return { paths, totalDurationMs }
}
