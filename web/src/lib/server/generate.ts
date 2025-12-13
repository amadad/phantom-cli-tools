/**
 * Server functions for content generation
 */

import { createServerFn } from '@tanstack/react-start'
import type { GenerationResult, PlatformContent } from './types'

/**
 * Generate content for a topic - runs on server
 */
export const generateContentFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { topic: string; brand?: string }) => data)
  .handler(async ({ data }): Promise<GenerationResult> => {
    // Dynamic imports for server-only modules
    const { config } = await import('dotenv')
    const { join } = await import('path')
    const { GoogleGenAI } = await import('@google/genai')
    const { loadBrand, getBrandVisualStyle, buildImagePrompt, buildVoiceContext } = await import('./brand')
    const { generateImage } = await import('./image')

    // Load env from project root
    config({ path: join(process.cwd(), '..', '.env') })

    const { topic, brand: brandName = 'givecare' } = data

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not set')
    }

    console.log(`\n[generate] Topic: "${topic}"`)

    // Load brand
    const brand = await loadBrand(brandName)
    console.log(`[generate] Brand: ${brand.name}`)

    // Get visual style
    const visualStyle = getBrandVisualStyle(brand)

    // Generate copy with Gemini
    console.log(`[generate] Generating copy...`)
    const voiceContext = buildVoiceContext(brand)

    const ai = new GoogleGenAI({ apiKey })

    // Build image direction context
    const imageDirection = brand.visual.image_direction
    const subjectsHint = imageDirection?.subjects?.slice(0, 3).join('\n  ') || 'authentic moments, natural settings'
    const emotionsHint = imageDirection?.emotions?.join(', ') || brand.visual.mood
    const sceneTemplates = imageDirection?.scene_templates
      ? Object.entries(imageDirection.scene_templates).map(([k, v]) => `  ${k}: "${v}"`).join('\n')
      : ''

    const prompt = `You are a social media copywriter and art director. Generate content for this topic.

TOPIC: ${topic}

BRAND VOICE:
${voiceContext}

Generate content for these platforms:
- Twitter: max ${brand.platforms?.twitter?.max_chars || 280} chars, ${brand.platforms?.twitter?.hashtags || 3} hashtags, punchy and engaging
- LinkedIn: max ${brand.platforms?.linkedin?.max_chars || 3000} chars, ${brand.platforms?.linkedin?.hashtags || 5} hashtags, professional and insightful
- Facebook: similar to LinkedIn but slightly more casual, community-focused
- Instagram: visual-first caption, max 2200 chars, 5-10 hashtags, use emojis sparingly
- Threads: short and conversational like Twitter, max 500 chars, 2-3 hashtags

=== IMAGE DESCRIPTION (CRITICAL) ===

You must write a DETAILED, SPECIFIC image description. This will be used to generate the image, so be precise.

GOOD SUBJECTS FOR THIS BRAND:
  ${subjectsHint}

EMOTIONAL TONE TO CONVEY: ${emotionsHint}

${sceneTemplates ? `EXAMPLE SCENE TEMPLATES:\n${sceneTemplates}\n` : ''}
REQUIREMENTS FOR YOUR IMAGE DESCRIPTION:
1. Describe a SPECIFIC scene, not an abstract concept
2. Include lighting direction (e.g., "soft morning light from the left")
3. Include camera perspective (e.g., "close-up", "overhead shot", "eye-level")
4. Describe textures and materials (e.g., "weathered wooden table", "linen fabric")
5. Set a mood through environmental details
6. AVOID: generic stock photo scenes, people smiling at camera, office settings, medical settings

BAD: "A caregiver taking a break"
GOOD: "Close-up of weathered hands wrapped around a ceramic mug of tea, soft morning light streaming through gauze curtains, steam rising, a well-worn journal open on a wooden table in the background, shallow depth of field, muted warm tones"

BAD: "Person feeling stressed"
GOOD: "A person seen from behind, silhouetted against a rain-spotted window, late afternoon grey light, the soft blur of a cozy living room behind them, a single houseplant in the corner, contemplative and quiet mood"

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
      model: 'gemini-2.5-flash-lite',
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

    // Use the detailed image description from LLM
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

    // Generate image
    console.log(`[generate] Generating image...`)
    console.log(`[generate] Image description: ${imageDescription}`)
    const imagePrompt = buildImagePrompt(imageDescription, brand, visualStyle)
    const image = await generateImage(imagePrompt, { aspectRatio: '1:1' })

    if (!image) {
      throw new Error('Image generation failed')
    }

    console.log(`[generate] Image done (${image.model})`)

    const id = `gen_${Date.now()}`
    const now = new Date().toISOString()

    // Add to queue for dashboard visibility
    const { writeFileSync, readFileSync, existsSync, mkdirSync } = await import('fs')
    const queueDir = join(process.cwd(), '..', 'output', 'queue')
    const queuePath = join(queueDir, 'queue.json')

    if (!existsSync(queueDir)) {
      mkdirSync(queueDir, { recursive: true })
    }

    const queue = existsSync(queuePath)
      ? JSON.parse(readFileSync(queuePath, 'utf-8'))
      : []

    queue.push({
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
      image: { url: image.url, prompt: imagePrompt, model: image.model }
    })

    writeFileSync(queuePath, JSON.stringify(queue, null, 2))
    console.log(`[generate] Added to queue: ${id}`)

    return {
      id,
      topic,
      imageUrl: image.url,
      imagePrompt,
      imageModel: image.model,
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
  })

/**
 * Get list of available brands - runs on server
 */
export const getBrandsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ brands: string[] }> => {
    return { brands: ['givecare'] }
  }
)

/**
 * Regenerate just the copy from source content
 */
export const refineCopyFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { sourceContent: string; brand: string }) => data)
  .handler(async ({ data }) => {
    const { config } = await import('dotenv')
    const { join } = await import('path')
    const { GoogleGenAI } = await import('@google/genai')
    const { loadBrand, buildVoiceContext } = await import('./brand')

    config({ path: join(process.cwd(), '..', '.env') })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY not set')

    const brand = await loadBrand(data.brand)
    const voiceContext = buildVoiceContext(brand)
    const ai = new GoogleGenAI({ apiKey })

    const prompt = `You are a social media copywriter. Adapt this source content for social media.

SOURCE CONTENT:
${data.sourceContent}

BRAND VOICE:
${voiceContext}

Generate content for Twitter (max ${brand.platforms?.twitter?.max_chars || 280} chars, ${brand.platforms?.twitter?.hashtags || 3} hashtags) and LinkedIn (max ${brand.platforms?.linkedin?.max_chars || 3000} chars, ${brand.platforms?.linkedin?.hashtags || 5} hashtags).

Respond in this exact JSON format:
{
  "twitterText": "the twitter post text without hashtags",
  "twitterHashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "linkedinText": "the linkedin post text without hashtags",
  "linkedinHashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt
    })

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Failed to parse response')

    const result = JSON.parse(jsonMatch[0])

    return {
      twitter: {
        platform: 'twitter' as const,
        text: String(result.twitterText || ''),
        hashtags: (result.twitterHashtags || []).slice(0, brand.platforms?.twitter?.hashtags || 3),
        characterCount: String(result.twitterText || '').length
      },
      linkedin: {
        platform: 'linkedin' as const,
        text: String(result.linkedinText || ''),
        hashtags: (result.linkedinHashtags || []).slice(0, brand.platforms?.linkedin?.hashtags || 5),
        characterCount: String(result.linkedinText || '').length
      }
    }
  })

/**
 * Regenerate just the image from a prompt
 */
export const refineImageFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { imagePrompt: string; brand: string }) => data)
  .handler(async ({ data }) => {
    const { config } = await import('dotenv')
    const { join } = await import('path')
    const { loadBrand, getBrandVisualStyle, buildImagePrompt } = await import('./brand')
    const { generateImage } = await import('./image')

    config({ path: join(process.cwd(), '..', '.env') })

    const brand = await loadBrand(data.brand)
    const visualStyle = getBrandVisualStyle(brand)

    // Build full prompt with brand styling
    const fullPrompt = buildImagePrompt(data.imagePrompt, brand, visualStyle)
    const image = await generateImage(fullPrompt, { aspectRatio: '1:1' })

    if (!image) throw new Error('Image generation failed')

    return {
      imageUrl: image.url,
      imagePrompt: fullPrompt,
      imageModel: image.model
    }
  })

/**
 * Generate video from image for YouTube Shorts
 */
export const generateVideoFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { imageUrl: string; brand: string; motionIntensity?: 'low' | 'medium' | 'high' }) => data)
  .handler(async ({ data }) => {
    const { config } = await import('dotenv')
    const { join } = await import('path')
    const { generateYouTubeShort, downloadVideo } = await import('./video')

    config({ path: join(process.cwd(), '..', '.env') })

    console.log(`[video] Generating video from image...`)

    const result = await generateYouTubeShort(data.imageUrl, {
      motionIntensity: data.motionIntensity || 'medium'
    })

    if (!result.success || !result.videoUrl) {
      throw new Error(result.error || 'Video generation failed')
    }

    // Download video to output folder
    const { mkdirSync, existsSync } = await import('fs')
    const outputDir = join(process.cwd(), '..', 'output', 'videos')
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }

    const videoPath = join(outputDir, `short_${Date.now()}.mp4`)
    const downloadResult = await downloadVideo(result.videoUrl, videoPath)

    if (!downloadResult.success) {
      throw new Error(downloadResult.error || 'Video download failed')
    }

    return {
      videoUrl: result.videoUrl,
      videoPath: downloadResult.path,
      model: result.model,
      duration: result.duration
    }
  })

/**
 * Upload video to YouTube as Short
 */
export const uploadYouTubeShortFn = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    videoPath: string
    title: string
    description: string
    brand: string
    tags?: string[]
    privacyStatus?: 'public' | 'private' | 'unlisted'
  }) => data)
  .handler(async ({ data }) => {
    const { config } = await import('dotenv')
    const { join } = await import('path')
    const { postToYouTube } = await import('./social')
    type Brand = 'scty' | 'givecare'

    config({ path: join(process.cwd(), '..', '.env') })

    console.log(`[youtube] Uploading Short for ${data.brand}...`)

    const result = await postToYouTube(
      data.brand as Brand,
      data.videoPath,
      data.title,
      data.description,
      {
        isShort: true,
        tags: data.tags || [],
        privacyStatus: data.privacyStatus || 'private'
      }
    )

    if (!result.success) {
      throw new Error(result.error || 'YouTube upload failed')
    }

    return {
      success: true,
      videoId: result.postId,
      videoUrl: result.postUrl
    }
  })

/**
 * Publish content via Direct APIs
 */
export const publishContentFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { generationId: string; platforms: string[]; brand?: string }) => data)
  .handler(async ({ data }) => {
    const { generationId, platforms, brand = 'givecare' } = data
    const { join } = await import('path')
    const { writeFileSync, readFileSync, existsSync } = await import('fs')
    const { config } = await import('dotenv')
    const { postToAll } = await import('./social')
    type Platform = 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'threads' | 'youtube'
    type Brand = 'scty' | 'givecare'

    config({ path: join(process.cwd(), '..', '.env') })

    console.log(`[publish] Publishing ${generationId} to ${platforms.join(', ')} for ${brand}`)

    // Get queue item for content
    const queuePath = join(process.cwd(), '..', 'output', 'queue', 'queue.json')
    if (!existsSync(queuePath)) {
      throw new Error('Queue not found')
    }

    const queue = JSON.parse(readFileSync(queuePath, 'utf-8'))
    const index = queue.findIndex((item: any) => item.id === generationId)

    if (index === -1) {
      throw new Error('Item not found in queue')
    }

    const item = queue[index]

    // Build text for each platform (use platform-specific content if available, fallback to twitter)
    const getTextForPlatform = (platform: string) => {
      const content = item.content?.[platform] || item.content?.twitter
      if (!content) return ''
      return `${content.text}\n\n${content.hashtags.map((h: string) => `#${h}`).join(' ')}`
    }

    // Use the twitter text as base (or any available text)
    const baseText = getTextForPlatform('twitter') || getTextForPlatform('linkedin')
    const imageUrl = item.image?.url

    // Post to all selected platforms using direct APIs
    const postResults = await postToAll({
      brand: brand as Brand,
      text: baseText,
      imageUrl,
      platforms: platforms as Platform[]
    })

    // Map results to expected format
    const results = postResults.map(r => ({
      platform: r.platform,
      success: r.success,
      postUrl: r.postUrl || '',
      error: r.error
    }))

    // Update queue
    const now = new Date().toISOString()
    const allSuccess = results.every(r => r.success)
    queue[index] = {
      ...queue[index],
      stage: allSuccess ? 'done' : 'failed',
      approvedAt: now,
      updatedAt: now,
      posts: results.map(r => ({
        platform: r.platform,
        success: r.success,
        postUrl: r.postUrl,
        error: r.error,
        postedAt: r.success ? now : undefined
      }))
    }
    writeFileSync(queuePath, JSON.stringify(queue, null, 2))

    return {
      generationId,
      dryRun: false,
      results
    }
  })
