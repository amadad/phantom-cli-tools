import { writeFileSync } from 'fs'
import { join } from 'path'
import { createCanvas, type CanvasRenderingContext2D } from 'canvas'
import type { BrandFoundation } from '../domain/types'
import { ensureParentDir, type RuntimePaths } from '../core/paths'

interface ImageBriefOptions {
  brand: BrandFoundation
  topic: string
  headline: string
  imageDirection: string
}

interface SourceImageOptions {
  brand: BrandFoundation
  paths: RuntimePaths
  runId: string
  topic: string
  headline: string
}

interface Rgb {
  r: number
  g: number
  b: number
}

function hashValue(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createRandom(seed: number): () => number {
  let state = seed || 1
  return () => {
    state |= 0
    state = (state + 0x6D2B79F5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function shift(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgb(${clamp(r + amount)}, ${clamp(g + amount)}, ${clamp(b + amount)})`
}

export function buildSocialImageBrief(options: ImageBriefOptions): Record<string, unknown> {
  const motif = options.brand.visual.motif ?? 'bold brand geometry'
  const imageStyle = options.brand.visual.imageStyle ?? `${options.brand.voice.tone} ${options.brand.voice.style}`

  return {
    brand: options.brand.id,
    channel: 'social',
    topic: options.topic,
    headline: options.headline,
    concept: `${options.brand.name} framing ${options.topic} as a systems-level issue.`,
    treatment: imageStyle,
    motif,
    direction: options.imageDirection,
    palette: options.brand.visual.palette,
  }
}

function buildSourceImagePrompt(options: SourceImageOptions): string {
  const { brand, topic } = options

  // Use brand.yml image_prompt if available — fill [SUBJECT] with topic
  if (brand.visual.imagePrompt) {
    return brand.visual.imagePrompt.replace(/\[SUBJECT\]/gi, topic)
  }

  // Fallback: generic editorial prompt
  return [
    `A warm, editorial documentary photograph about ${topic}.`,
    `Medium shot, slightly off-center composition with negative space.`,
    `Color palette: ${brand.visual.palette.background}, ${brand.visual.palette.primary}, ${brand.visual.palette.accent}.`,
    `No text, no logos, no watermarks.`,
  ].join(' ')
}

async function generateWithGemini(options: SourceImageOptions): Promise<{ imagePath: string; width: number; height: number; provider: string } | null> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!key) return null

  const outputPath = join(options.paths.artifactsDir, options.runId, 'source-image.png')
  const prompt = buildSourceImagePrompt(options)

  try {
    const { GoogleGenAI } = await import('@google/genai')
    const client = new GoogleGenAI({ apiKey: key })

    const response = await client.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    })

    const parts = response.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find(
      (part) => part.inlineData?.mimeType?.startsWith('image/'),
    )

    if (!imagePart?.inlineData?.data) return null

    const imageBytes = Buffer.from(imagePart.inlineData.data, 'base64')
    ensureParentDir(outputPath)
    writeFileSync(outputPath, imageBytes)

    return { imagePath: outputPath, width: 1600, height: 1600, provider: 'gemini-3.1-flash-image-preview' }
  } catch {
    return null
  }
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
}

function drawSoftMotif(ctx: CanvasRenderingContext2D, width: number, height: number, brand: BrandFoundation, random: () => number): void {
  for (let index = 0; index < 7; index += 1) {
    ctx.beginPath()
    const radius = 140 + random() * 260
    const x = width * (0.2 + random() * 0.6)
    const y = height * (0.2 + random() * 0.6)
    ctx.lineWidth = 12 + random() * 18
    ctx.strokeStyle = rgba(index % 2 === 0 ? brand.visual.palette.accent : brand.visual.palette.primary, 0.18 + random() * 0.12)
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.stroke()
  }

  for (let index = 0; index < 4; index += 1) {
    ctx.fillStyle = rgba(brand.visual.palette.background, 0.28 + random() * 0.08)
    const x = 120 + random() * (width - 520)
    const y = 120 + random() * (height - 520)
    const w = 240 + random() * 220
    const h = 160 + random() * 220
    ctx.beginPath()
    roundedRectPath(ctx, x, y, w, h, 28)
    ctx.fill()
  }
}

function drawGridMotif(ctx: CanvasRenderingContext2D, width: number, height: number, brand: BrandFoundation, random: () => number): void {
  ctx.strokeStyle = rgba(brand.visual.palette.primary, 0.12)
  ctx.lineWidth = 2
  const step = 72
  for (let x = 0; x <= width; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let y = 0; y <= height; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  for (let index = 0; index < 12; index += 1) {
    ctx.fillStyle = rgba(index % 2 === 0 ? brand.visual.palette.accent : brand.visual.palette.primary, 0.14 + random() * 0.16)
    const x = random() * width
    const y = random() * height
    const w = 180 + random() * 260
    const h = 12 + random() * 36
    ctx.fillRect(x - w / 2, y - h / 2, w, h)
  }
}

export async function generateSourceImage(options: SourceImageOptions): Promise<{ imagePath: string; width: number; height: number; seed?: number; provider?: string }> {
  const apiResult = await generateWithGemini(options)
  if (apiResult) {
    return apiResult
  }

  return generateSourceImageCanvas(options)
}

export function generateSourceImageCanvas(options: SourceImageOptions): { imagePath: string; width: number; height: number; seed: number } {
  const width = 1600
  const height = 1600
  const seed = hashValue(`${options.brand.id}:${options.topic}:${options.headline}`)
  const random = createRandom(seed)
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const outputPath = join(options.paths.artifactsDir, options.runId, 'source-image.png')

  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, options.brand.visual.palette.background)
  gradient.addColorStop(0.6, shift(options.brand.visual.palette.background, 12))
  gradient.addColorStop(1, rgba(options.brand.visual.palette.accent, 0.24))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = rgba(options.brand.visual.palette.accent, 0.12)
  ctx.fillRect(0, height - 240, width, 240)

  const motif = (options.brand.visual.layout ?? options.brand.visual.motif ?? options.brand.voice.tone).toLowerCase()
  if (motif.includes('signal') || motif.includes('grid') || motif.includes('system')) {
    drawGridMotif(ctx, width, height, options.brand, random)
  } else {
    drawSoftMotif(ctx, width, height, options.brand, random)
  }

  ctx.fillStyle = rgba(options.brand.visual.palette.primary, 0.08)
  ctx.fillRect(96, 96, width - 192, height - 192)

  ensureParentDir(outputPath)
  writeFileSync(outputPath, canvas.toBuffer('image/png'))

  return { imagePath: outputPath, width, height, seed }
}
