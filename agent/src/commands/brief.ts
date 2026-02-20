/**
 * Brief command - Daily Research Digest
 *
 * Usage:
 *   brief <brand> [options]
 *
 * Options:
 *   --topic <text>   Focus on a specific subtopic
 *   --channel        Post digest to Discord webhook
 *   --dry-run        Skip saving/posting output
 */

import { mkdirSync, writeFileSync } from 'fs'
import { loadBrand } from '../core/brand'
import { getBrandDir, getDefaultBrand, join } from '../core/paths'
import type { CommandContext } from '../cli/types'

export interface BriefItem {
  title: string
  url: string
  summary: string
}

export interface BriefResult {
  brand: string
  date: string
  topic?: string
  headline: string
  items: BriefItem[]
  digest: string
  source: 'exa' | 'gemini'
  dryRun: boolean
  saved?: string
  posted?: boolean
}

/**
 * Search for recent articles via Exa API
 */
async function searchWithExa(
  query: string,
  numResults: number = 8
): Promise<BriefItem[]> {
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) throw new Error('EXA_API_KEY not set')

  const Exa = (await import('exa-js')).default
  const exa = new Exa(apiKey)

  // Search last 48 hours
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0]

  const results = await exa.searchAndContents(query, {
    numResults,
    startPublishedDate: cutoff,
    type: 'neural',
    useAutoprompt: true,
    summary: { query: `One sentence summary of what this article covers about ${query}` }
  })

  const items: BriefItem[] = []
  for (const r of results.results) {
    const title = r.title || r.url
    const url = r.url
    const summary = (r as any).summary?.text ||
      (r as any).text?.slice(0, 180)?.replace(/\n+/g, ' ') ||
      'No summary available.'

    if (title && url) {
      items.push({ title, url, summary })
    }
  }

  return items
}

/**
 * Fallback: Use Gemini to generate a grounded digest when Exa unavailable
 */
async function searchWithGemini(
  query: string,
  brandName: string,
  audience: string
): Promise<BriefItem[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })

  const prompt = `You are a research assistant generating a daily briefing for ${brandName}.

Audience: ${audience}
Topic area: ${query}

Generate a research digest of 6-8 recent developments (from the past 24-48 hours) that would be relevant to this audience. These should be real-world topics, trends, signals, or news that a content team would want to know about.

For each item, provide:
- A clear title describing the news/trend/signal
- A plausible source URL (real news outlets, research orgs, advocacy sites)
- A one-sentence summary of why it matters to the audience

Return JSON:
{
  "items": [
    {
      "title": "...",
      "url": "https://...",
      "summary": "..."
    }
  ]
}`

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Extract JSON
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ||
    text.match(/\{[\s\S]*"items"[\s\S]*\}/)
  const raw = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text

  try {
    const parsed = JSON.parse(raw.trim())
    return (parsed.items || []) as BriefItem[]
  } catch {
    // Try to extract any partial JSON
    return []
  }
}

/**
 * Format the markdown digest
 */
function formatDigest(
  brandName: string,
  date: string,
  topic: string | undefined,
  items: BriefItem[],
  source: 'exa' | 'gemini'
): { headline: string; digest: string } {
  const topicLabel = topic ? ` — ${topic}` : ''
  const headline = `${brandName} Daily Brief${topicLabel} · ${date}`

  const lines: string[] = [
    `# ${headline}`,
    '',
    `> Generated ${date} · ${items.length} items · Source: ${source === 'exa' ? 'Exa news search' : 'Gemini grounding'}`,
    ''
  ]

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    lines.push(`## ${i + 1}. ${item.title}`)
    lines.push('')
    lines.push(`**[Read →](${item.url})**`)
    lines.push('')
    lines.push(item.summary)
    lines.push('')
  }

  return { headline, digest: lines.join('\n') }
}

/**
 * Post digest to Discord webhook
 */
async function postToDiscord(webhookUrl: string, headline: string, items: BriefItem[]): Promise<void> {
  // Discord embeds: send as a series of bullet points (no tables)
  const lines = [
    `**${headline}**`,
    ''
  ]
  for (const item of items.slice(0, 10)) {
    lines.push(`• **${item.title}**`)
    lines.push(`  ${item.summary}`)
    lines.push(`  <${item.url}>`)
    lines.push('')
  }

  const content = lines.join('\n').slice(0, 2000)

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  })

  if (!response.ok) {
    throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`)
  }
}

/**
 * Run the brief command
 */
export async function run(args: string[], _ctx?: CommandContext): Promise<BriefResult> {
  // Parse args
  const positional = args.filter(a => !a.startsWith('--'))
  const brand = positional[0] || getDefaultBrand()

  const dryRun = args.includes('--dry-run')
  const postToChannel = args.includes('--channel')

  // Parse --topic flag
  let topic: string | undefined
  const topicIdx = args.findIndex(a => a === '--topic')
  if (topicIdx !== -1 && args[topicIdx + 1]) {
    topic = args[topicIdx + 1]
  }
  const topicEq = args.find(a => a.startsWith('--topic='))
  if (topicEq) topic = topicEq.slice('--topic='.length)

  // Load brand
  const brandConfig = loadBrand(brand)
  const audience = (brandConfig as any).voice?.audience ||
    (brandConfig as any).audience ||
    'general audience'
  const brandTopics: string[] = (brandConfig as any).topics || []

  // Build search query
  const searchQuery = topic
    ? `${topic} ${brandConfig.name}`
    : brandTopics.length > 0
      ? `${brandTopics.slice(0, 3).join(' ')} ${brandConfig.name} latest`
      : `${brandConfig.name} ${audience} news trends`

  const date = new Date().toISOString().split('T')[0]

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`DAILY BRIEF: ${brandConfig.name.toUpperCase()}`)
  console.log(`Date: ${date}`)
  if (topic) console.log(`Topic: ${topic}`)
  console.log(`Query: ${searchQuery}`)
  console.log(`${'─'.repeat(60)}`)

  // Fetch articles
  let items: BriefItem[] = []
  let source: 'exa' | 'gemini' = 'exa'

  const hasExa = !!process.env.EXA_API_KEY

  if (hasExa && !dryRun) {
    console.log('\n[brief] Searching with Exa...')
    try {
      items = await searchWithExa(searchQuery, 8)
      console.log(`[brief] Found ${items.length} articles via Exa`)
    } catch (e: any) {
      console.warn(`[brief] Exa search failed: ${e.message}, falling back to Gemini`)
      source = 'gemini'
    }
  } else if (!hasExa && !dryRun) {
    console.log('[brief] EXA_API_KEY not set, using Gemini fallback...')
    source = 'gemini'
  }

  if (source === 'gemini' && !dryRun) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Neither EXA_API_KEY nor GEMINI_API_KEY is set')
    }
    items = await searchWithGemini(searchQuery, brandConfig.name, audience)
    console.log(`[brief] Generated ${items.length} items via Gemini`)
  }

  // Dry run: produce stub items
  if (dryRun) {
    source = 'exa'
    items = [
      {
        title: 'Example: Caregiver Support Programs Expand in 2025',
        url: 'https://example.com/caregiver-support-2025',
        summary: 'New federal initiatives aim to extend support services to family caregivers across 30 states.'
      },
      {
        title: 'Example: Burnout Among Family Caregivers Reaches Record High',
        url: 'https://example.com/caregiver-burnout-study',
        summary: 'A new study finds 68% of unpaid family caregivers report moderate to severe burnout symptoms.'
      }
    ]
    console.log('[brief] Dry run — using stub items')
  }

  if (items.length === 0) {
    console.warn('[brief] No items found')
  }

  // Format digest
  const { headline, digest } = formatDigest(brandConfig.name, date, topic, items, source)

  // Print digest
  console.log('\n' + digest)

  // Save to file
  let savedPath: string | undefined
  if (!dryRun) {
    const briefsDir = join(getBrandDir(brand), 'briefs')
    mkdirSync(briefsDir, { recursive: true })
    savedPath = join(briefsDir, `${date}.md`)
    writeFileSync(savedPath, digest)
    console.log(`\n[brief] Saved: ${savedPath}`)
  } else {
    console.log('\n[brief] Dry run — skipping save')
  }

  // Post to Discord if requested
  let posted = false
  if (postToChannel && !dryRun) {
    const webhookUrl = process.env.DISCORD_CONTENT_INTEL_WEBHOOK ||
      (brandConfig as any).discord?.content_intel_webhook

    if (!webhookUrl) {
      console.warn('[brief] --channel set but no webhook URL found (DISCORD_CONTENT_INTEL_WEBHOOK or brand config)')
    } else {
      try {
        console.log('[brief] Posting to Discord...')
        await postToDiscord(webhookUrl, headline, items)
        posted = true
        console.log('[brief] Posted to Discord ✓')
      } catch (e: any) {
        console.warn(`[brief] Discord post failed: ${e.message}`)
      }
    }
  } else if (postToChannel && dryRun) {
    console.log('[brief] Dry run — skipping Discord post')
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Items: ${items.length} | Source: ${source}${savedPath ? ` | Saved: ${savedPath}` : ''}`)
  console.log(`${'─'.repeat(60)}`)

  return {
    brand,
    date,
    topic,
    headline,
    items,
    digest,
    source,
    dryRun,
    saved: savedPath,
    posted
  }
}
