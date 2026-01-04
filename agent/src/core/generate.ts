/**
 * Content generation - copy + image
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { GoogleGenAI } from '@google/genai'
import {
  loadBrand,
  getBrandVisualStyle,
  buildImagePrompt,
  buildVoiceContext,
  detectFrameType,
  selectReferenceStyle,
  getAbsoluteReferenceImagePaths,
  buildImagePromptWithStyleContext
} from './brand'
import { generateImage, generateImageWithReferences, saveImage } from './image'
import type { GenerationResult, PlatformContent, QueueItem } from './types'
import { addToQueue } from '../queue'

/**
 * Get relevant hook patterns from hook bank for a topic
 */
function getHooksForTopic(topic: string, brandName: string): {
  hook?: string
  amplified?: string
  category?: string
} | null {
  const hookBankPath = join(process.cwd(), 'src', 'intelligence', 'data', `${brandName}-hooks.json`)

  if (!existsSync(hookBankPath)) {
    return null
  }

  try {
    const bank = JSON.parse(readFileSync(hookBankPath, 'utf-8'))
    const hooks = bank.hooks || []

    if (hooks.length === 0) return null

    const topicLower = topic.toLowerCase()

    // Find hooks matching topic themes
    let matches = hooks.filter((h: any) =>
      h.themes?.some((t: string) => topicLower.includes(t.toLowerCase())) ||
      h.original?.toLowerCase().includes(topicLower.slice(0, 20))
    )

    // If no theme matches, get highest multiplier hooks
    if (matches.length === 0) {
      matches = hooks.filter((h: any) => h.multiplier >= 50)
    }

    if (matches.length === 0) return null

    // Sort by multiplier desc, least used first
    matches.sort((a: any, b: any) => {
      if (b.multiplier !== a.multiplier) return b.multiplier - a.multiplier
      return (a.usedCount || 0) - (b.usedCount || 0)
    })

    const best = matches[0]
    return {
      hook: best.original,
      amplified: best.amplified,
      category: best.category
    }
  } catch {
    return null
  }
}

export interface GenerateOptions {
  topic: string
  brandName?: string
  skipImage?: boolean
  saveImageTo?: string  // Optional path to save image file
}

/**
 * Generate content for a topic
 */
export async function generateContent(options: GenerateOptions): Promise<GenerationResult> {
  const { topic, brandName = 'givecare', skipImage = false, saveImageTo } = options

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set')
  }

  console.log(`\n[generate] Topic: "${topic}"`)

  // Load brand
  const brand = loadBrand(brandName)
  console.log(`[generate] Brand: ${brand.name}`)

  // Get visual style
  const visualStyle = getBrandVisualStyle(brand)

  // Get proven hooks from hook bank
  const hookPattern = getHooksForTopic(topic, brandName)
  if (hookPattern) {
    console.log(`[generate] Using hook pattern: "${hookPattern.hook?.slice(0, 50)}..." (${hookPattern.category})`)
  }

  // Detect frame type from topic
  const frameType = detectFrameType(topic)
  console.log(`[generate] Frame type: ${frameType}`)

  // Generate copy with Gemini
  console.log(`[generate] Generating copy...`)
  const voiceContext = buildVoiceContext(brand, frameType)

  const ai = new GoogleGenAI({ apiKey })

  // Build image direction context based on frame type
  const imageDirection = brand.visual.image_direction
  const isPracticalTip = frameType === 'practical_tip'

  // Build hook guidance if we have a proven pattern (skip for practical_tip)
  const hookGuidance = (hookPattern && !isPracticalTip) ? `
=== PROVEN HOOK PATTERN (use this structure) ===
Category: ${hookPattern.category}
Example hook: "${hookPattern.hook}"
${hookPattern.amplified ? `Amplified version: "${hookPattern.amplified}"` : ''}

Use this hook STRUCTURE (not exact words) to open your content. Make it specific to the topic.
=== END HOOK PATTERN ===
` : ''

  // Different image guidance for practical_tip vs other content
  const imageGuidance = isPracticalTip ? `
=== IMAGE DESCRIPTION (ABSTRACT VISUAL) ===

For this type of content, describe an ABSTRACT or ILLUSTRATIVE visual, NOT a literal scene.

STYLE OPTIONS (pick one):
1. ORGANIC TEXTURE: "Abstract cellular pattern in warm oranges and browns, organic blob shapes like cross-section of fruit or tree bark, fills entire frame, no recognizable objects"
2. VINTAGE ILLUSTRATION: "Flat-color illustration on dark brown background, simplified silhouettes of vessels/cups/plants in lilac and coral, 1960s cookbook aesthetic, no gradients"
3. BOTANICAL: "Vintage botanical illustration style, warm earthy tones with pops of coral/orange, hand-drawn quality, retro seed catalog aesthetic"

MOOD TO CONVEY: ${brand.visual.mood}

CRITICAL REQUIREMENTS:
- NO literal scenes of people resting, stretching, or doing self-care
- NO stock photography aesthetics
- Think: graphic design poster, not photograph
- Abstract visuals that FEEL like rest/renewal without depicting it literally

BAD: "Person stretching in morning light" or "Hands holding tea"
GOOD: "Abstract organic cellular texture in warm amber and cream tones, resembling a cross-section of honeycomb or tree rings, fills entire frame edge-to-edge, warm earthy color palette"
` : `
=== IMAGE DESCRIPTION (SPECIFIC SCENE) ===

You must write a DETAILED, SPECIFIC image description. This will be used to generate the image, so be precise.

GOOD SUBJECTS FOR THIS BRAND:
  ${imageDirection?.subjects?.slice(0, 3).join('\n  ') || 'authentic moments, natural settings'}

EMOTIONAL TONE TO CONVEY: ${imageDirection?.emotions?.join(', ') || brand.visual.mood}

${imageDirection?.scene_templates ? `EXAMPLE SCENE TEMPLATES:\n${Object.entries(imageDirection.scene_templates).map(([k, v]) => `  ${k}: "${v}"`).join('\n')}\n` : ''}
REQUIREMENTS FOR YOUR IMAGE DESCRIPTION:
1. Describe a SPECIFIC scene, not an abstract concept
2. Include lighting direction (e.g., "soft morning light from the left")
3. Include camera perspective (e.g., "close-up", "overhead shot", "eye-level")
4. Describe textures and materials (e.g., "weathered wooden table", "linen fabric")
5. Set a mood through environmental details
6. AVOID: generic stock photo scenes, people smiling at camera, office settings, medical settings

BAD: "A caregiver taking a break"
GOOD: "Close-up of weathered hands wrapped around a ceramic mug of tea, soft morning light streaming through gauze curtains, steam rising, a well-worn journal open on a wooden table in the background, shallow depth of field, muted warm tones"
`

  const prompt = `You are a social media copywriter and art director. Generate content for this topic.

TOPIC: ${topic}
${hookGuidance}
BRAND VOICE:
${voiceContext}

Generate content for these platforms:
- Twitter: max ${brand.platforms?.twitter?.max_chars || 280} chars, ${brand.platforms?.twitter?.hashtags || 3} hashtags, punchy and engaging
- LinkedIn: max ${brand.platforms?.linkedin?.max_chars || 3000} chars, ${brand.platforms?.linkedin?.hashtags || 5} hashtags, professional and insightful
- Facebook: similar to LinkedIn but slightly more casual, community-focused
- Instagram: visual-first caption, max 2200 chars, 5-10 hashtags, use emojis sparingly
- Threads: short and conversational like Twitter, max 500 chars, 2-3 hashtags
${imageGuidance}
Respond in this exact JSON format:
{
  "twitterText": "the twitter post text without hashtags",
  "twitterHashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "linkedinText": "the linkedin post text without hashtags",
  "linkedinHashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "facebookText": "the facebook post text without hashtags",
  "facebookHashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "instagramText": "the instagram caption without hashtags",
  "instagramHashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "threadsText": "the threads post text without hashtags",
  "threadsHashtags": ["hashtag1", "hashtag2"],
  "imageDescription": "DETAILED scene description following the requirements above - at least 2-3 sentences with specific visual details"
}`

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse LLM response as JSON')
  }

  const result = JSON.parse(jsonMatch[0])

  // Build platform content
  const twitterText = String(result.twitterText || '')
  const linkedinText = String(result.linkedinText || '')
  const facebookText = String(result.facebookText || linkedinText)
  const instagramText = String(result.instagramText || linkedinText)
  const threadsText = String(result.threadsText || twitterText)

  const twitterHashtags = (result.twitterHashtags || []).slice(0, brand.platforms?.twitter?.hashtags || 3)
  const linkedinHashtags = (result.linkedinHashtags || []).slice(0, brand.platforms?.linkedin?.hashtags || 5)
  const facebookHashtags = (result.facebookHashtags || linkedinHashtags).slice(0, 3)
  const instagramHashtags = (result.instagramHashtags || linkedinHashtags).slice(0, 5)
  const threadsHashtags = (result.threadsHashtags || twitterHashtags).slice(0, 2)

  const imageDescription = String(result.imageDescription || result.imageSubject || topic)

  const twitterContent: PlatformContent = {
    platform: 'twitter',
    text: twitterText,
    hashtags: twitterHashtags,
    characterCount: twitterText.length + twitterHashtags.join(' #').length + 2
  }

  const linkedinContent: PlatformContent = {
    platform: 'linkedin',
    text: linkedinText,
    hashtags: linkedinHashtags,
    characterCount: linkedinText.length
  }

  const facebookContent: PlatformContent = {
    platform: 'facebook',
    text: facebookText,
    hashtags: facebookHashtags,
    characterCount: facebookText.length
  }

  const instagramContent: PlatformContent = {
    platform: 'instagram',
    text: instagramText,
    hashtags: instagramHashtags,
    characterCount: instagramText.length
  }

  const threadsContent: PlatformContent = {
    platform: 'threads',
    text: threadsText,
    hashtags: threadsHashtags,
    characterCount: threadsText.length
  }

  console.log(`[generate] Copy done (Twitter: ${twitterContent.characterCount} chars)`)

  // Generate image (unless skipped)
  let image = null
  let imagePrompt = ''

  if (!skipImage) {
    console.log(`[generate] Generating image...`)
    console.log(`[generate] Image description: ${imageDescription}`)

    const referenceStyle = selectReferenceStyle(topic, imageDescription, brand)

    if (referenceStyle && brand.visual.reference_styles) {
      const referenceImagePaths = getAbsoluteReferenceImagePaths(referenceStyle, brandName)
      imagePrompt = buildImagePromptWithStyleContext(imageDescription, brand, visualStyle, referenceStyle)

      console.log(`[generate] Using reference style: ${referenceStyle.name} (${referenceImagePaths.length} images)`)

      const imageGenConfig = brand.visual.image_generation
      image = await generateImageWithReferences(imagePrompt, referenceImagePaths, {
        aspectRatio: (imageGenConfig?.default_aspect_ratio || '1:1') as any,
        resolution: imageGenConfig?.default_resolution || '2K',
        modelConfig: imageGenConfig
      })
    } else {
      console.log(`[generate] No reference styles available, using text-only generation`)
      imagePrompt = buildImagePrompt(imageDescription, brand, visualStyle)
      image = await generateImage(imagePrompt, { aspectRatio: '1:1' })
    }

    if (!image) {
      throw new Error('Image generation failed')
    }

    console.log(`[generate] Image done (${image.model})`)

    // Save image to file if requested
    if (saveImageTo) {
      saveImage(image, saveImageTo)
    }
  }

  const id = `gen_${Date.now()}`
  const now = new Date().toISOString()

  // Add to queue
  const queueItem: QueueItem = {
    id,
    source: { type: 'manual', topic, brandName },
    stage: 'review',
    createdAt: now,
    updatedAt: now,
    requiresApproval: true,
    content: {
      topic,
      twitter: { text: twitterText, hashtags: twitterHashtags },
      linkedin: { text: linkedinText, hashtags: linkedinHashtags },
      facebook: { text: facebookText, hashtags: facebookHashtags },
      instagram: { text: instagramText, hashtags: instagramHashtags },
      threads: { text: threadsText, hashtags: threadsHashtags }
    },
    image: image ? { url: image.url, prompt: imagePrompt, model: image.model } : undefined
  }

  addToQueue(queueItem)
  console.log(`[generate] Added to queue: ${id}`)

  return {
    id,
    topic,
    imageUrl: image?.url || '',
    imagePrompt,
    imageModel: image?.model || '',
    content: {
      twitter: twitterContent,
      linkedin: linkedinContent,
      facebook: facebookContent,
      instagram: instagramContent,
      threads: threadsContent
    },
    brand: brand.name,
    generatedAt: now
  }
}

/**
 * Generate copy only (no image)
 */
export async function generateCopyOnly(topic: string, brandName: string = 'givecare'): Promise<GenerationResult> {
  return generateContent({ topic, brandName, skipImage: true })
}
