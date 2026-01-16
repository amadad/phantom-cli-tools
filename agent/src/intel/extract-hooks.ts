#!/usr/bin/env npx tsx
/**
 * Extract Hooks from Viral Content using Gemini
 *
 * Analyzes outlier posts and extracts:
 * - Hook (first 3 seconds / first line)
 * - Retention pattern
 * - CTA (call to action)
 * - Why it worked
 *
 * Usage:
 *   npx tsx extract-hooks.ts <brand> [--min-multiplier=50] [--limit=10]
 */

import { config } from 'dotenv'
import { getOutliersByPriority, markOutlierAnalyzed, type ContentOutlier } from './detect-outliers'
import { addHook, type HookCategory } from './hook-bank'
import { getProjectRoot, join, getDefaultBrand } from '../core/paths'

// Load env from project root
config({ path: join(getProjectRoot(), '.env') })

interface ExtractedHook {
  hook: string
  hookAmplified: string
  category: HookCategory
  retentionPattern: string
  cta: string
  whyItWorked: string
  themes: string[]
}

async function extractHookWithGemini(
  outlier: ContentOutlier
): Promise<ExtractedHook | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set')
    return null
  }

  const prompt = `Analyze this viral social media post and extract the hook pattern.

POST DETAILS:
- Platform: ${outlier.post.platform}
- Views: ${outlier.post.views.toLocaleString()} (${outlier.multiplier}x the account's median)
- Likes: ${outlier.post.likes.toLocaleString()}
- Comments: ${outlier.post.comments.toLocaleString()}
- Caption: "${outlier.post.caption}"

EXTRACT:
1. HOOK: The first line or opening that grabbed attention (exact quote or description)
2. HOOK_AMPLIFIED: Make it 10x more extreme/compelling while keeping the essence
3. CATEGORY: One of: curiosity, controversy, transformation, secret, listicle, story, question, statistic
4. RETENTION_PATTERN: What technique keeps viewers engaged (e.g., "open loop", "before/after reveal", "countdown")
5. CTA: The call to action (explicit or implicit)
6. WHY_IT_WORKED: 2-3 sentences on why this specific post went viral
7. THEMES: 3-5 content themes this hook could apply to (e.g., "caregiving", "burnout", "self-care")

Return JSON only:
{
  "hook": "...",
  "hookAmplified": "...",
  "category": "...",
  "retentionPattern": "...",
  "cta": "...",
  "whyItWorked": "...",
  "themes": ["...", "..."]
}`

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      }
    )

    const data = await response.json() as any

    if (data.error) {
      console.error('Gemini API error:', data.error.message)
      return null
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      console.error('No response from Gemini')
      return null
    }

    const parsed = JSON.parse(text)
    return {
      hook: parsed.hook,
      hookAmplified: parsed.hookAmplified,
      category: parsed.category as HookCategory,
      retentionPattern: parsed.retentionPattern,
      cta: parsed.cta,
      whyItWorked: parsed.whyItWorked,
      themes: parsed.themes || []
    }
  } catch (error: any) {
    console.error('Hook extraction failed:', error.message)
    return null
  }
}

async function processOutliers(
  brand: string,
  options: { minMultiplier?: number; limit?: number } = {}
): Promise<void> {
  const outliers = getOutliersByPriority(brand, {
    minMultiplier: (options.minMultiplier || 50) as any,
    unanalyzedOnly: true,
    limit: options.limit || 10
  })

  if (outliers.length === 0) {
    console.log('No unanalyzed outliers found.')
    console.log('Run detect-outliers.ts or enrich-apify.ts --include-posts first.')
    return
  }

  console.log(`\nProcessing ${outliers.length} outliers...\n`)

  let extracted = 0
  let failed = 0

  for (const outlier of outliers) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`[${outlier.multiplier}x] @${outlier.post.authorUsername}`)
    console.log(`Caption: ${outlier.post.caption.slice(0, 100)}...`)

    const hook = await extractHookWithGemini(outlier)

    if (hook) {
      // Save to hook bank
      addHook(brand, {
        original: hook.hook,
        amplified: hook.hookAmplified,
        category: hook.category,
        multiplier: outlier.multiplier,
        platform: outlier.post.platform,
        sourceUrl: outlier.post.url,
        themes: hook.themes
      })

      // Mark outlier as analyzed
      markOutlierAnalyzed(brand, outlier.post.url)

      console.log(`\n✓ EXTRACTED:`)
      console.log(`  Hook: "${hook.hook}"`)
      console.log(`  Amplified: "${hook.hookAmplified}"`)
      console.log(`  Category: ${hook.category}`)
      console.log(`  Retention: ${hook.retentionPattern}`)
      console.log(`  CTA: ${hook.cta}`)
      console.log(`  Why: ${hook.whyItWorked}`)
      console.log(`  Themes: ${hook.themes.join(', ')}`)

      extracted++
    } else {
      console.log(`✗ Failed to extract hook`)
      failed++
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`COMPLETE: Extracted ${extracted} hooks, ${failed} failed`)
  console.log(`${'='.repeat(60)}`)
}

// CLI
async function main() {
  const args = process.argv.slice(2)
  const brand = args[0] || getDefaultBrand()
  const minMultiplierArg = args.find(a => a.startsWith('--min-multiplier='))
  const limitArg = args.find(a => a.startsWith('--limit='))

  const minMultiplier = minMultiplierArg
    ? parseInt(minMultiplierArg.split('=')[1])
    : 50
  const limit = limitArg
    ? parseInt(limitArg.split('=')[1])
    : 10

  console.log(`\n${'='.repeat(60)}`)
  console.log(`HOOK EXTRACTION: ${brand.toUpperCase()}`)
  console.log(`Min multiplier: ${minMultiplier}x | Limit: ${limit}`)
  console.log(`${'='.repeat(60)}`)

  await processOutliers(brand, { minMultiplier, limit })
}

main().catch(console.error)
