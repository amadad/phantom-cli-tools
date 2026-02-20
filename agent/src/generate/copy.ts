/**
 * Copy generation
 */

import { GoogleGenAI } from '@google/genai'
import type { ContentType } from './classify'
import { extractJson } from '../core/json'
import { withTimeout } from '../core/http'
import { getCopyContext } from '../eval/learnings'
import { loadBrand, buildVoiceContext, detectFrameType } from '../core/brand'
import { SLOP_WORDS } from '../core/slop'
import type { BrandProfile } from '../core/types'

export interface PlatformCopy {
  text: string
  hashtags: string[]
}

export interface CopyResult {
  headline: string
  twitter: PlatformCopy
  linkedin: PlatformCopy
  instagram: PlatformCopy
  threads: PlatformCopy
  imageDirection: string
}

// Fallback voice templates (used when brand has no frames/writing system)
const FALLBACK_VOICE: Record<ContentType, string> = {
  warm: `Voice: Warm, direct, honest - like a friend who gets it.
- Acknowledge the hard thing first, then offer something useful
- Short sentences, speak directly with "you"
- One idea per post, not a list
- NEVER: "You're allowed to", "Give yourself grace", "Self-care isn't selfish"`,

  product: `Voice: Builder shipping real tools. Specific, substantive.
- Be specific - mention real features, tools, outcomes
- Write as founder, not marketing department
- End with action: link, DM invitation, or question
- Use arrows (→) for lists`,

  thought: `Voice: Observational, precise. Stack observations without forcing a conclusion.
- Start with concrete observation, not abstract claim
- Stack 2-3 observations, then stop
- No call to action, no encouragement
- Leave space for reader to draw meaning`
}

/**
 * Build platform limits string from brand config
 */
function buildPlatformLimits(brand: BrandProfile): string {
  const tw = brand.platforms?.twitter
  const li = brand.platforms?.linkedin
  const ig = brand.platforms?.instagram
  const th = brand.platforms?.threads

  return `Generate for each platform:
- Twitter: max ${tw?.max_chars ?? 280} chars, ${tw?.hashtags ?? 2}-${(tw?.hashtags ?? 2) + 1} hashtags (without #)
- LinkedIn: max ${li?.max_chars ?? 1500} chars, ${li?.hashtags ?? 3}-${(li?.hashtags ?? 3) + 2} hashtags (without #)
- Instagram: max ${ig?.max_chars ?? 1000} chars, ${ig?.hashtags ?? 5} hashtags (without #)
- Threads: max ${th?.max_chars ?? 500} chars, ${th?.hashtags ?? 2}-${(th?.hashtags ?? 2) + 1} hashtags (without #)`
}

// ── Writing quality (universal, not brand-specific) ─────────────────────────

const WRITING_RULES = `WRITING RULES (apply to all output, all platforms):
Do not sound like AI. Write like a specific human with opinions.

Kill words (never use): ${SLOP_WORDS.join(', ')}

Kill patterns:
- Zero em dashes. Use commas, periods, or colons.
- Never "It's not just X, it's Y"
- Never "serves as" or "stands as"
- Never -ing pileups ("highlighting, showcasing, ensuring...")
- Never start with "In today's" or "In a world where"

Sentence rhythm:
- Vary length wildly. 4 words. Then 22. Fragment. Then a breath.
- Max one rhetorical triple per post.
- No uniform cadence. Break patterns.

Tone:
- Have opinions. "I don't know what to make of this" beats neutral reporting.
- Show uncertainty, mixed feelings, specificity.
- State things. Skip "It's worth noting that..." and say the thing.
- Use "you" and "I" when it fits. Address the reader.`

/**
 * Generate copy for all platforms
 */
export async function generateCopy(
  topic: string,
  brandName: string,
  contentType: ContentType,
  hookPattern?: string,
  evalFeedback?: string
): Promise<CopyResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  // Load brand profile for voice config and platform limits
  const brand = loadBrand(brandName)
  const frameType = detectFrameType(topic)

  // Use brand voice config if available, fall back to hardcoded templates
  const hasVoiceConfig = brand.voice?.frames || brand.voice?.writing_system
  const voiceContext = hasVoiceConfig
    ? buildVoiceContext(brand, frameType)
    : FALLBACK_VOICE[contentType]

  // Inject learnings from past evaluations
  const learningsContext = getCopyContext(brandName)

  // Platform limits from brand config
  const platformLimits = buildPlatformLimits(brand)

  const prompt = `${WRITING_RULES}

${voiceContext}
${learningsContext}

Write about: ${topic}
${hookPattern ? `\nHook pattern to adapt: "${hookPattern}"` : ''}
${evalFeedback ? `\n⚠️ PREVIOUS ATTEMPT FAILED EVALUATION. FIX THESE ISSUES:\n${evalFeedback}\n` : ''}

${platformLimits}

Also generate:
- headline: Punchy 5-10 word hook for image overlay. Conversational, provocative. NOT the topic verbatim. Examples: "Your brain is running 20 tabs", "Nobody warns you about this part", "The thing nobody tells caregivers"
- imageDirection: 1-2 sentences describing the visual.

FORMATTING RULES for LinkedIn/Instagram/Threads:
- Vary the rhythm: some lines stand alone, some cluster in 2-3 sentence groups
- Use blank lines to create breathing room, not after every line
- Mix short punches (5 words) with medium builds (15-20 words)
- Group related thoughts, then pause. Let one line land hard alone.
- NO walls of text, but NO robotic staccato either
Requirements for imageDirection:
- Bold, editorial, high-contrast OR abstract
- Empowered, fierce - NOT sad, tired, defeated
- NEVER coffee mugs, hands holding tea, stock setups
- Think fashion editorial, bold portraiture, abstract textures

Respond in JSON:
{
  "headline": "...",
  "twitter": { "text": "...", "hashtags": ["...", "..."] },
  "linkedin": { "text": "...", "hashtags": ["...", "..."] },
  "instagram": { "text": "...", "hashtags": ["...", "..."] },
  "threads": { "text": "...", "hashtags": ["...", "..."] },
  "imageDirection": "..."
}`

  const ai = new GoogleGenAI({ apiKey })

  const response = await withTimeout(
    ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { thinkingConfig: { thinkingLevel: 'low' } } as any
    }),
    30_000,
    'Gemini copy generation'
  )

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const result = extractJson<any>(text, 'copy')

  if (!result.success) throw new Error(`Parse failed: ${result.error}`)

  const d = result.data
  return {
    headline: d.headline || topic,
    twitter: { text: d.twitter?.text || '', hashtags: d.twitter?.hashtags || [] },
    linkedin: { text: d.linkedin?.text || '', hashtags: d.linkedin?.hashtags || [] },
    instagram: { text: d.instagram?.text || '', hashtags: d.instagram?.hashtags || [] },
    threads: { text: d.threads?.text || '', hashtags: d.threads?.hashtags || [] },
    imageDirection: d.imageDirection || topic
  }
}
