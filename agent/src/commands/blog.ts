/**
 * Blog command - Long-form Blog Post Generator
 *
 * Usage:
 *   blog <brand> "<topic>" [options]
 *
 * Options:
 *   --publish    Copy post to brand's publish_path (if configured)
 *   --dry-run    Skip saving/publishing
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { loadBrand } from '../core/brand'
import { getBrandDir, getDefaultBrand, join } from '../core/paths'
import { grade, loadRubric } from '../eval/grader'
import type { CommandContext } from '../cli/types'
import type { EvalResult } from '../eval/grader'

export interface BlogResult {
  brand: string
  topic: string
  date: string
  slug: string
  post: string
  eval: {
    score: number
    passed: boolean
    critique: string
  }
  dryRun: boolean
  saved?: string
  published?: string
}

/**
 * Slugify a topic for filenames
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

/**
 * Build a voice context string for blog posts from brand config
 */
function buildBlogVoiceContext(brandConfig: any): string {
  const voice = brandConfig.voice || {}
  const audience = voice.audience || 'general audience'
  const tone = voice.tone || 'informative'
  const principles: string[] = voice.principles || voice.rules || []
  const avoid: string[] = voice.avoid || voice.avoid_phrases || []

  let ctx = `You are a content writer for ${brandConfig.name}.

BRAND: ${brandConfig.name}
AUDIENCE: ${audience}
TONE: ${tone}
`

  if (principles.length > 0) {
    ctx += `\nVOICE PRINCIPLES:\n${principles.map((p: string) => `- ${p}`).join('\n')}`
  }

  if (avoid.length > 0) {
    ctx += `\n\nNEVER USE THESE PHRASES:\n${avoid.map((p: string) => `- "${p}"`).join('\n')}`
  }

  return ctx
}

/**
 * Generate blog post using Gemini
 */
async function generateBlogPost(
  topic: string,
  brandConfig: any
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const voiceContext = buildBlogVoiceContext(brandConfig)

  const prompt = `${voiceContext}

Write a blog post on this topic: "${topic}"

STRUCTURE (follow exactly):
1. Headline — compelling, specific, reflects the topic
2. Introduction (2-3 sentences) — hook the reader, state the core tension or insight
3. Section 1 (with a subheading) — open the topic, set context
4. Section 2 (with a subheading) — go deeper, address the real issue
5. Section 3 (with a subheading) — practical angle, actionable insight or nuance
6. (Optional) Section 4 (with a subheading) — if needed for a complete treatment
7. Conclusion (2-3 sentences) — land the core message, leave the reader with something

LENGTH: 600-900 words total. Not shorter. Not much longer.

FORMATTING:
- Use markdown: # for headline, ## for subheadings
- No bold/italic emphasis on random phrases
- Write in second person ("you") where natural
- Short paragraphs (2-4 sentences max)
- No bullet lists unless the content genuinely demands it

Return the full blog post in markdown. No preamble, no explanation — just the post.`

  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  })

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || ''

  if (!text.trim()) {
    throw new Error('Gemini returned empty blog post')
  }

  return text.trim()
}

/**
 * Build markdown file with frontmatter for publishing
 */
function buildPublishFrontmatter(
  topic: string,
  brandName: string,
  date: string,
  slug: string,
  post: string,
  tags: string[]
): string {
  // Extract headline from the post (first # heading)
  const headlineMatch = post.match(/^#\s+(.+)$/m)
  const title = headlineMatch ? headlineMatch[1].trim() : topic

  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `date: "${date}"`,
    `brand: "${brandName}"`,
    `slug: "${slug}"`,
    `tags: [${tags.map(t => `"${t}"`).join(', ')}]`,
    '---',
    ''
  ].join('\n')

  return frontmatter + post
}

/**
 * Format the score bar display
 */
function formatScoreBar(score: number): string {
  const filled = Math.round(score / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

/**
 * Run the blog command
 */
export async function run(args: string[], ctx?: CommandContext): Promise<BlogResult> {
  const output = ctx?.output ?? {
    print: (m: string) => console.log(m),
    info: (m: string) => console.log(m),
    warn: (m: string) => console.warn(m),
    error: (m: string) => console.error(m),
    json: (d: unknown) => console.log(JSON.stringify(d, null, 2))
  }

  // Parse args
  const dryRun = args.includes('--dry-run')
  const publish = args.includes('--publish')

  const positional = args.filter(a => !a.startsWith('--'))
  const brand = positional[0] || getDefaultBrand()
  const topic = positional.slice(1).join(' ')

  if (!topic) {
    output.error('Usage: blog <brand> "<topic>" [--publish] [--dry-run]')
    throw new Error('Missing topic argument')
  }

  // Load brand
  const brandConfig = loadBrand(brand)

  const date = new Date().toISOString().split('T')[0]
  const slug = slugify(topic)

  output.print(`\n${'─'.repeat(60)}`)
  output.print(`BLOG GENERATOR: ${brandConfig.name.toUpperCase()}`)
  output.print(`Topic: ${topic}`)
  output.print(`Slug:  ${slug}`)
  output.print(`Date:  ${date}`)
  output.print(`${'─'.repeat(60)}`)

  // Generate blog post
  let post: string

  if (dryRun) {
    output.print('\n[blog] Dry run — using stub post')
    post = `# ${topic}: What You Need to Know

This is a dry-run stub post. In production, Gemini would generate a full 600-900 word blog post here.

## The Core Issue

Family caregivers face unique challenges every day.

## What It Looks Like in Practice

Real examples and practical insights would go here.

## What You Can Do

Actionable steps tailored to the brand's audience.

## The Bigger Picture

Connecting individual experience to broader context.

Every caregiver deserves support. That's what ${brandConfig.name} is about.`
  } else {
    output.print('\n[blog] Generating post with Gemini...')
    post = await generateBlogPost(topic, brandConfig)
    output.print(`[blog] Generated ${post.split(/\s+/).length} words`)
  }

  // Grade the post
  output.print('\n[blog] Grading against rubric...')
  let evalResult: EvalResult

  if (dryRun) {
    // Stub eval for dry run
    evalResult = {
      passed: true,
      score: 72,
      dimensions: { voice: 7, value: 8, clarity: 7 },
      hard_fails: [],
      red_flags: [],
      platform_issues: [],
      critique: 'Dry run stub — no real eval performed'
    }
  } else {
    try {
      evalResult = await grade(post, brand, { log: false })
    } catch (e: any) {
      output.warn(`[blog] Grading failed: ${e.message}`)
      evalResult = {
        passed: false,
        score: 0,
        dimensions: {},
        hard_fails: [],
        red_flags: [],
        platform_issues: [],
        critique: `Grading error: ${e.message}`
      }
    }
  }

  const scoreBar = formatScoreBar(evalResult.score)
  output.print(`[blog] Score: ${scoreBar} ${evalResult.score}/100 ${evalResult.passed ? '✓ PASS' : '✗ FAIL'}`)
  if (evalResult.critique) {
    output.print(`[blog] Critique: ${evalResult.critique}`)
  }

  // Print the post
  output.print(`\n${'═'.repeat(60)}`)
  output.print(post)
  output.print(`${'═'.repeat(60)}`)

  // Print dimension scores
  if (Object.keys(evalResult.dimensions).length > 0) {
    output.print('\nRubric Dimensions:')
    for (const [dim, score] of Object.entries(evalResult.dimensions)) {
      const bar = '█'.repeat(score as number) + '░'.repeat(10 - (score as number))
      output.print(`  ${dim.padEnd(16)} ${bar} ${score}/10`)
    }
  }

  // Save to file
  let savedPath: string | undefined
  if (!dryRun) {
    const blogDir = join(getBrandDir(brand), 'blog')
    mkdirSync(blogDir, { recursive: true })
    const filename = `${date}-${slug}.md`
    savedPath = join(blogDir, filename)

    const fileContent = [
      `<!-- score: ${evalResult.score}/100 | ${evalResult.passed ? 'PASS' : 'FAIL'} | ${new Date().toISOString()} -->`,
      `<!-- critique: ${evalResult.critique?.replace(/\n/g, ' ')} -->`,
      '',
      post
    ].join('\n')

    writeFileSync(savedPath, fileContent)
    output.print(`\n[blog] Saved: ${savedPath}`)
  } else {
    output.print('\n[blog] Dry run — skipping save')
  }

  // Publish if requested
  let publishedPath: string | undefined
  if (publish && !dryRun) {
    const publishPath = (brandConfig as any).blog?.publish_path

    if (!publishPath) {
      output.warn('[blog] --publish set but blog.publish_path not found in brand config')
    } else {
      const postsDir = join(publishPath, 'posts')
      mkdirSync(postsDir, { recursive: true })

      const brandTopics: string[] = (brandConfig as any).topics || []
      const tags = [brand, ...brandTopics.slice(0, 3)]

      const publishContent = buildPublishFrontmatter(topic, brandConfig.name, date, slug, post, tags)
      publishedPath = join(postsDir, `${date}-${slug}.md`)

      writeFileSync(publishedPath, publishContent)
      output.print(`[blog] Published: ${publishedPath}`)
    }
  } else if (publish && dryRun) {
    output.print('[blog] Dry run — skipping publish')
  }

  output.print(`\n${'─'.repeat(60)}`)
  output.print(`Score: ${evalResult.score}/100 ${evalResult.passed ? '✓' : '✗'}${savedPath ? ` | Saved: ${savedPath}` : ''}`)
  output.print(`${'─'.repeat(60)}`)

  return {
    brand,
    topic,
    date,
    slug,
    post,
    eval: {
      score: evalResult.score,
      passed: evalResult.passed,
      critique: evalResult.critique
    },
    dryRun,
    saved: savedPath,
    published: publishedPath
  }
}
