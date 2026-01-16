/**
 * Copy generation
 */

import { GoogleGenAI } from '@google/genai'
import type { ContentType } from './classify'
import { extractJson } from '../core/json'
import { getCopyContext } from '../eval/learnings'

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

// Voice templates by content type
const VOICE: Record<ContentType, string> = {
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

  // Inject learnings from past evaluations
  const learningsContext = getCopyContext(brandName)

  const prompt = `You are a social media writer for ${brandName}.

${VOICE[contentType]}
${learningsContext}

Write about: ${topic}
${hookPattern ? `\nHook pattern to adapt: "${hookPattern}"` : ''}
${evalFeedback ? `\n⚠️ PREVIOUS ATTEMPT FAILED EVALUATION. FIX THESE ISSUES:\n${evalFeedback}\n` : ''}

Generate for each platform:
- Twitter: max 280 chars, 2-3 hashtags (without #)
- LinkedIn: max 1500 chars, 3-5 hashtags (without #)
- Instagram: max 1000 chars, 5 hashtags (without #)
- Threads: max 500 chars, 2-3 hashtags (without #)

Also generate:
- headline: Punchy 5-10 word hook for image overlay. Conversational, provocative. NOT the topic verbatim. Examples: "Your brain is running 20 tabs", "Nobody warns you about this part", "The thing nobody tells caregivers"
- imageDirection: 1-2 sentences describing the visual.

FORMATTING RULES for LinkedIn/Instagram/Threads:
- Vary the rhythm: some lines stand alone, some cluster in 2-3 sentence groups
- Use blank lines to create breathing room, not after every line
- Mix short punches (5 words) with medium builds (15-20 words)
- Think poetry: tension, release, tension, release. Not metronome.
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

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { thinkingConfig: { thinkingLevel: 'low' } } as any
  })

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
