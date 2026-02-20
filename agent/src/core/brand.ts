/**
 * Brand profile loading and management
 */

import { readFileSync, existsSync, statSync } from 'fs'
import yaml from 'js-yaml'
import type { BrandProfile } from './types'
import { getBrandConfigPath, validateBrand, getDefaultBrand } from './paths'

// Cache loaded brands with modification time for invalidation
interface CacheEntry {
  brand: BrandProfile
  mtime: number
}
const brandCache = new Map<string, CacheEntry>()

/**
 * Load brand profile from YAML file
 * Automatically invalidates cache when file changes
 */
export function loadBrand(brandName?: string): BrandProfile {
  const name = brandName || getDefaultBrand()
  validateBrand(name)

  const brandPath = getBrandConfigPath(name)

  if (!existsSync(brandPath)) {
    throw new Error(`Brand not found: ${name} (looked at ${brandPath})`)
  }

  // Check if cache is still valid
  let mtime: number
  try {
    mtime = statSync(brandPath).mtimeMs
  } catch {
    brandCache.delete(name)
    // File disappeared between existsSync and statSync — re-throw
    throw new Error(`Brand not found: ${name} (looked at ${brandPath})`)
  }
  const cached = brandCache.get(name)

  if (cached && cached.mtime === mtime) {
    return cached.brand
  }

  // Cache miss or stale - reload
  const content = readFileSync(brandPath, 'utf-8')
  const brand = yaml.load(content) as BrandProfile

  brandCache.set(name, { brand, mtime })
  return brand
}

/**
 * Clear brand cache (useful for testing/reloading)
 */
export function clearBrandCache(): void {
  brandCache.clear()
}

/**
 * Detect frame type from topic
 */
export function detectFrameType(topic: string): 'announcement' | 'weekly_update' | 'event' | 'partnership' | 'thought' | 'practical_tip' {
  const topicLower = topic.toLowerCase()

  // Announcement keywords
  if (topicLower.includes('release') || topicLower.includes('launch') || topicLower.includes('ship') ||
      topicLower.includes('new feature') || topicLower.includes('announcing')) {
    return 'announcement'
  }

  // Event keywords
  if (topicLower.includes('conference') || topicLower.includes('summit') || topicLower.includes('speaking') ||
      topicLower.includes('event') || topicLower.includes('workshop')) {
    return 'event'
  }

  // Partnership keywords
  if (topicLower.includes('partner') || topicLower.includes('collaborat') || topicLower.includes('working with')) {
    return 'partnership'
  }

  // Weekly update keywords
  if (topicLower.includes('this week') || topicLower.includes('working on') || topicLower.includes('building')) {
    return 'weekly_update'
  }

  // Practical tip keywords
  if (topicLower.includes('tip') || topicLower.includes('how to') || topicLower.includes('ways to') ||
      topicLower.includes('reset') || topicLower.includes('recovery') || topicLower.includes('self-care')) {
    return 'practical_tip'
  }

  // Default to thought/observation
  return 'thought'
}

/**
 * Build content generation context from brand
 *
 * Voice modes:
 * - practical_tip: Warm brand voice (like a friend who gets it)
 * - thought: Writing system (operational, diagnostic)
 * - announcement/event/partnership: Product voice (founder/builder)
 */
export function buildVoiceContext(brand: BrandProfile, frameType?: string): string {
  const frames = brand.voice.frames
  const frame = frameType && frames ? frames[frameType] : null

  // Determine which voice mode to use
  const isProductVoice = ['announcement', 'event', 'partnership', 'weekly_update'].includes(frameType || '')
  const isBrandVoice = frameType === 'practical_tip'
  const isThoughtVoice = frameType === 'thought'

  let context = `You are writing for ${brand.name}.

VOICE:
- Tone: ${brand.voice.tone}
- Style: ${brand.voice.style}

CORE RULES:
${brand.voice.rules.map(r => `- ${r}`).join('\n')}`

  // Add product-specific rules for announcements/events
  if (isProductVoice) {
    const productRules = brand.voice.product_rules
    if (productRules) {
      context += `

PRODUCT VOICE (for this content type):
${productRules.map((r: string) => `- ${r}`).join('\n')}`
    }
  }

  // Add frame-specific guidance with examples
  if (frame) {
    context += `

=== CONTENT FRAME: ${frameType?.toUpperCase()} ===
${frame.description}

STRUCTURE:
${frame.structure}`

    // Include ALL examples for practical_tip to show the tone
    if (isBrandVoice) {
      context += `

EXAMPLE 1:
${frame.example || ''}

${frame.example_2 ? `EXAMPLE 2:\n${frame.example_2}` : ''}

${frame.example_3 ? `EXAMPLE 3:\n${frame.example_3}` : ''}

CRITICAL: Match the warm, direct tone of these examples. NO clinical language. NO jargon. Write like a friend texting, not a company posting.`
    } else if (frame.example) {
      context += `

EXAMPLE:
${frame.example}`
    }
  }

  // Only apply writing_system for "thought" posts
  if (isThoughtVoice) {
    const ws = brand.voice.writing_system
    if (ws) {
      context += `

=== WRITING SYSTEM (for thought posts only) ===
${ws.goal}

CORE RULES:
${ws.core_rules?.map((r: string) => `- ${r}`).join('\n') || ''}

LANGUAGE:
- Prefer: ${ws.language?.prefer?.join(', ') || 'concrete nouns'}
- Limit: ${ws.language?.limit?.join(', ') || 'adverbs'}

TERM REPLACEMENTS (use these operational terms):
${Object.entries(ws.language?.replacements || {}).map(([k, v]) => `- ${k} → "${v}"`).join('\n')}

HUMAN MARKERS (include 1-2):
${ws.human_markers?.slice(0, 3).map((m: string) => `- ${m}`).join('\n') || ''}

ENDING: Stop after observation. No CTA.`
    }
  }

  if (brand.voice.avoid_phrases && brand.voice.avoid_phrases.length > 0) {
    context += `

NEVER USE THESE PHRASES:
${brand.voice.avoid_phrases.map((p: string) => `- "${p}"`).join('\n')}`
  }

  return context
}
