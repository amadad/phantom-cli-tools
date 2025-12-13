/**
 * Content generation pipeline
 * research → write → image
 */

import { GoogleGenAI } from '@google/genai'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'
import type { ContentItem, ContentSource, Brand } from '../types'
import { addToQueue, updateQueueItem } from '../queue'

const OUTPUT_DIR = join(process.cwd(), '..', 'output', 'images')

function ensureOutputDir() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }
}

/**
 * Load brand configuration from YAML
 */
export function loadBrand(brandName: string): Brand {
  const brandPath = join(process.cwd(), '..', 'brands', `${brandName}.yml`)
  if (!existsSync(brandPath)) {
    throw new Error(`Brand not found: ${brandName}`)
  }
  const content = readFileSync(brandPath, 'utf-8')
  return yaml.load(content) as Brand
}

/**
 * Research stage - extract key points and angles
 */
export async function research(
  source: ContentSource,
  ai: GoogleGenAI
): Promise<ContentItem['research']> {
  console.log(`[pipeline] Research: ${source.topic || source.url}`)

  const prompt = `Analyze this content source and extract key information for social media posts.

SOURCE: ${source.type}
${source.url ? `URL: ${source.url}` : ''}
${source.topic ? `TOPIC: ${source.topic}` : ''}

Provide a brief summary, 3-5 key points, and 2-3 different angles for social media posts.

Respond in this exact JSON format:
{
  "summary": "Brief 1-2 sentence summary",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "angles": ["angle 1 for social", "angle 2 for social"]
}`

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-lite',
    contents: prompt
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse research response')
  }

  return JSON.parse(jsonMatch[0])
}

/**
 * Write stage - generate platform-specific copy
 */
export async function write(
  research: ContentItem['research'],
  brand: Brand,
  ai: GoogleGenAI
): Promise<ContentItem['content']> {
  console.log(`[pipeline] Write: generating copy`)

  const voiceContext = `
Brand: ${brand.name}
Tone: ${brand.voice.tone}
Style: ${brand.voice.style}
Rules: ${brand.voice.rules.join(', ')}
`

  const prompt = `You are a social media copywriter. Generate content based on this research.

RESEARCH:
Summary: ${research?.summary}
Key Points: ${research?.keyPoints.join(', ')}
Angles: ${research?.angles.join(', ')}

BRAND VOICE:
${voiceContext}

Generate content for:
- Twitter (max ${brand.platforms.twitter.max_chars} chars, ${brand.platforms.twitter.hashtags} hashtags)
- LinkedIn (max ${brand.platforms.linkedin.max_chars} chars, ${brand.platforms.linkedin.hashtags} hashtags)

Pick the best angle and write compelling, on-brand copy.

Respond in this exact JSON format:
{
  "topic": "the main topic/angle chosen",
  "twitter": {
    "text": "the twitter post text without hashtags",
    "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
  },
  "linkedin": {
    "text": "the linkedin post text without hashtags",
    "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
  }
}`

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-lite',
    contents: prompt
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse write response')
  }

  return JSON.parse(jsonMatch[0])
}

/**
 * Image stage - generate visual
 */
export async function generateImage(
  content: ContentItem['content'],
  brand: Brand,
  ai: GoogleGenAI
): Promise<ContentItem['image']> {
  console.log(`[pipeline] Image: generating visual`)

  const visualContext = `
Style: ${brand.visual.style}
Mood: ${brand.visual.mood}
Palette: ${brand.visual.palette.primary}, ${brand.visual.palette.secondary}, ${brand.visual.palette.accent}
Avoid: ${brand.visual.avoid.join(', ')}
`

  // Generate image prompt
  const promptResponse = await ai.models.generateContent({
    model: 'gemini-2.0-flash-lite',
    contents: `Create a concise image generation prompt for this social media content.

TOPIC: ${content?.topic}
CONTENT: ${content?.twitter.text}

VISUAL STYLE:
${visualContext}

Write a single paragraph prompt (max 100 words) describing what the image should show.
Focus on mood, composition, and visual elements. Do not include text in the image.`
  })

  const imagePrompt = promptResponse.candidates?.[0]?.content?.parts?.[0]?.text || content?.topic || ''

  // Try image generation models in order
  const models = ['gemini-2.0-flash-preview-image-generation', 'imagen-3.0-generate-002']
  let imageResult: { url: string; model: string } | null = null

  for (const model of models) {
    try {
      console.log(`[pipeline] Trying ${model}...`)

      if (model.includes('imagen')) {
        // Imagen API
        const response = await ai.models.generateImages({
          model,
          prompt: imagePrompt,
          config: { numberOfImages: 1 }
        })

        const image = response.generatedImages?.[0]
        if (image?.image?.imageBytes) {
          const base64 = Buffer.from(image.image.imageBytes).toString('base64')
          imageResult = {
            url: `data:image/png;base64,${base64}`,
            model
          }
          break
        }
      } else {
        // Gemini with image generation
        const response = await ai.models.generateContent({
          model,
          contents: imagePrompt,
          config: {
            responseModalities: ['TEXT', 'IMAGE']
          }
        })

        const parts = response.candidates?.[0]?.content?.parts || []
        for (const part of parts) {
          if (part.inlineData?.mimeType?.startsWith('image/')) {
            imageResult = {
              url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
              model
            }
            break
          }
        }
        if (imageResult) break
      }
    } catch (error) {
      console.log(`[pipeline] ${model} failed:`, error)
      continue
    }
  }

  if (!imageResult) {
    throw new Error('All image generation models failed')
  }

  // Save image to file
  ensureOutputDir()
  const filename = `img_${Date.now()}.png`
  const filepath = join(OUTPUT_DIR, filename)

  const base64Data = imageResult.url.split(',')[1]
  writeFileSync(filepath, Buffer.from(base64Data, 'base64'))
  console.log(`[pipeline] Saved image: ${filepath}`)

  return {
    url: imageResult.url,
    prompt: imagePrompt,
    model: imageResult.model
  }
}

/**
 * Run full pipeline for a content source
 */
export async function runPipeline(
  source: ContentSource,
  options: {
    apiKey: string
    skipImage?: boolean
    autoApprove?: boolean
  }
): Promise<ContentItem> {
  const ai = new GoogleGenAI({ apiKey: options.apiKey })
  const brand = loadBrand(source.brandName)

  // Create queue item at research stage
  const queueItem = addToQueue({
    source,
    stage: 'research'
  })

  try {
    // Research
    const researchResult = await research(source, ai)
    updateQueueItem(queueItem.id, {
      research: researchResult,
      stage: 'write'
    })

    // Write
    const contentResult = await write(researchResult, brand, ai)
    updateQueueItem(queueItem.id, {
      content: contentResult,
      stage: options.skipImage ? 'review' : 'image'
    })

    // Image (optional)
    let imageResult: ContentItem['image'] | undefined
    if (!options.skipImage) {
      imageResult = await generateImage(contentResult, brand, ai)
      updateQueueItem(queueItem.id, {
        image: imageResult,
        stage: 'review'
      })
    }

    // Auto-approve if configured
    if (options.autoApprove) {
      updateQueueItem(queueItem.id, {
        approvedAt: new Date().toISOString(),
        stage: 'post'
      })
    }

    console.log(`[pipeline] Complete: ${queueItem.id}`)

    return {
      id: queueItem.id,
      source,
      stage: options.autoApprove ? 'post' : 'review',
      createdAt: queueItem.createdAt,
      updatedAt: new Date().toISOString(),
      research: researchResult,
      content: contentResult,
      image: imageResult
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    updateQueueItem(queueItem.id, {
      stage: 'failed',
      error: errorMessage
    })
    throw error
  }
}
