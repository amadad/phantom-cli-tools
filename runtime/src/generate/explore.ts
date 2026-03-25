import { writeFileSync } from 'fs'
import { join } from 'path'
import type { BrandFoundation } from '../domain/types'
import { ensureParentDir, type RuntimePaths } from '../core/paths'

interface ExploreGridOptions {
  brand: BrandFoundation
  paths: RuntimePaths
  runId: string
  topic: string
  headline: string
  imageDirection: string
}

interface ExploreGridResult {
  gridImagePath: string
  prompt: string
  provider: string
  width: number
  height: number
}

function buildExplorePrompt(options: ExploreGridOptions): string {
  const { brand, topic, imageDirection } = options
  const palette = brand.visual.palette
  const motif = brand.visual.motif ?? 'strong brand geometry'

  return [
    `Create a 3×3 grid in 3:4 aspect ratio for ${brand.name}.`,
    '',
    `Topic: ${topic}`,
    `Visual direction: ${imageDirection}`,
    `Palette: background ${palette.background}, primary ${palette.primary}, accent ${palette.accent}`,
    `Motif: ${motif}`,
    '',
    'Grid concepts (one per cell):',
    `1. Hero composition — ${topic} framed as a systems-level issue`,
    '2. Macro detail — texture, materiality, close-up',
    '3. Environmental context — the world this topic lives in',
    '4. Human element — hands, gesture, interaction (minimal)',
    '5. Data or structure visualization — the system behind the topic',
    '6. Contrast or tension — what is broken vs. what could be',
    `7. Brand color story — palette-driven abstract using ${palette.primary} and ${palette.accent}`,
    `8. Proof point visual — ${brand.proofPoints[0] ?? brand.positioning}`,
    '9. Bold editorial — unexpected framing, visually striking',
    '',
    'No text, no logos, no watermarks. Clean separation between panels.',
    'Studio-quality lighting. Consistent mood across all nine.',
  ].join('\n')
}

interface FalQueueResponse {
  status: string
  request_id: string
  response_url: string
  status_url: string
  images?: Array<{ url: string }>
  [key: string]: unknown
}

async function pollFalResult(statusUrl: string, responseUrl: string, key: string): Promise<{ images: Array<{ url: string }> }> {
  const headers = { Authorization: `Key ${key}` }

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const statusResponse = await fetch(statusUrl, { headers })
    if (!statusResponse.ok) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      continue
    }

    const status = await statusResponse.json() as { status: string }
    if (status.status === 'IN_QUEUE' || status.status === 'IN_PROGRESS') {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      continue
    }

    if (status.status === 'COMPLETED') {
      const resultResponse = await fetch(responseUrl, { headers })
      if (!resultResponse.ok) {
        throw new Error(`fal.ai result fetch failed: ${resultResponse.status}`)
      }
      const result = await resultResponse.json() as { images: Array<{ url: string }> }
      if (result.images?.[0]?.url) {
        return { images: result.images }
      }
      throw new Error('fal.ai completed but returned no images')
    }

    throw new Error(`fal.ai generation failed with status: ${status.status}`)
  }

  throw new Error('fal.ai image generation timed out after 120 seconds')
}

async function generateWithFal(prompt: string): Promise<{ imageUrl: string; provider: string }> {
  const key = process.env.FAL_KEY
  if (!key) {
    throw new Error('FAL_KEY not set')
  }

  const response = await fetch('https://queue.fal.run/fal-ai/flux-pro/v1.1', {
    method: 'POST',
    headers: {
      Authorization: `Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: {
        width: 1024,
        height: 1365,
      },
      num_images: 1,
      safety_tolerance: '5',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`fal.ai Flux request failed: ${response.status} ${text}`)
  }

  const queued = await response.json() as FalQueueResponse

  // Direct result (synchronous)
  if (queued.images?.[0]?.url) {
    return { imageUrl: queued.images[0].url, provider: 'fal-flux-pro-1.1' }
  }

  // Queued — poll status, then fetch result
  if (queued.status_url && queued.response_url) {
    const result = await pollFalResult(queued.status_url, queued.response_url, key)
    return { imageUrl: result.images[0].url, provider: 'fal-flux-pro-1.1' }
  }

  throw new Error('fal.ai returned no images and no queue URL')
}

async function generateWithGemini(prompt: string): Promise<{ imageUrl: string; provider: string; imageBytes?: Buffer }> {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    throw new Error('GEMINI_API_KEY not set')
  }

  const { GoogleGenAI } = await import('@google/genai')
  const client = new GoogleGenAI({ apiKey: key })

  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  })

  const parts = response.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find(
    (part) => part.inlineData?.mimeType?.startsWith('image/'),
  )

  if (!imagePart?.inlineData?.data) {
    throw new Error('Gemini returned no image')
  }

  const imageBytes = Buffer.from(imagePart.inlineData.data, 'base64')
  return { imageUrl: '', provider: 'gemini-2.0-flash-exp', imageBytes }
}

async function downloadToFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  ensureParentDir(outputPath)
  writeFileSync(outputPath, buffer)
}

export async function generateExploreGrid(options: ExploreGridOptions): Promise<ExploreGridResult> {
  const prompt = buildExplorePrompt(options)
  const outputPath = join(options.paths.artifactsDir, options.runId, 'explore-grid.png')
  const width = 1024
  const height = 1365

  if (process.env.FAL_KEY) {
    const result = await generateWithFal(prompt)
    await downloadToFile(result.imageUrl, outputPath)
    return { gridImagePath: outputPath, prompt, provider: result.provider, width, height }
  }

  if (process.env.GEMINI_API_KEY) {
    const result = await generateWithGemini(prompt)
    if (result.imageBytes) {
      ensureParentDir(outputPath)
      writeFileSync(outputPath, result.imageBytes)
    }
    return { gridImagePath: outputPath, prompt, provider: result.provider, width, height }
  }

  throw new Error('No image generation API configured. Set FAL_KEY or GEMINI_API_KEY.')
}

export { buildExplorePrompt }
