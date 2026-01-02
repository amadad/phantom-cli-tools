/**
 * Gen command - Generate content (copy + image)
 *
 * Usage:
 *   gen <brand> "<topic>" [options]
 *
 * Options:
 *   --no-image       Generate copy only, skip image
 *   --save-image     Save image to output/ directory
 */

import { join } from 'path'
import { generateContent } from '../core/generate'

export interface GenOptions {
  brand: string
  topic: string
  skipImage?: boolean
  saveImage?: boolean
}

export async function gen(options: GenOptions): Promise<void> {
  const { brand, topic, skipImage, saveImage } = options

  console.log(`\nGenerating content for "${topic}"...`)

  const saveImageTo = saveImage
    ? join(process.cwd(), '..', 'output', 'images', `${Date.now()}.png`)
    : undefined

  const result = await generateContent({
    topic,
    brandName: brand,
    skipImage,
    saveImageTo
  })

  // Print result summary
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`GENERATED: ${result.id}`)
  console.log(`${'─'.repeat(60)}`)

  console.log(`\n[Twitter] ${result.content.twitter.characterCount} chars`)
  console.log(result.content.twitter.text)
  console.log(`#${result.content.twitter.hashtags.join(' #')}`)

  console.log(`\n[LinkedIn] ${result.content.linkedin.characterCount} chars`)
  console.log(result.content.linkedin.text.slice(0, 200) + '...')

  if (result.imageUrl) {
    console.log(`\n[Image] ${result.imageModel}`)
    if (saveImageTo) {
      console.log(`Saved to: ${saveImageTo}`)
    } else {
      console.log(`Use --save-image to save to file`)
    }
  }

  console.log(`\n✓ Added to queue. Run 'post ${brand}' to publish.`)
}

/**
 * Parse CLI args and run
 */
export async function run(args: string[]): Promise<void> {
  // Find brand (first non-flag, non-quoted arg)
  let brand = 'givecare'
  let topic = ''

  // Parse args
  const nonFlags = args.filter(a => !a.startsWith('--'))
  if (nonFlags.length >= 2) {
    brand = nonFlags[0]
    topic = nonFlags.slice(1).join(' ')
  } else if (nonFlags.length === 1) {
    // Could be brand or topic
    if (['givecare', 'scty'].includes(nonFlags[0])) {
      brand = nonFlags[0]
    } else {
      topic = nonFlags[0]
    }
  }

  // Check for quoted topic
  const quotedMatch = args.join(' ').match(/"([^"]+)"/)
  if (quotedMatch) {
    topic = quotedMatch[1]
  }

  if (!topic) {
    console.error('Usage: gen <brand> "<topic>" [--no-image] [--save-image]')
    console.error('Example: gen givecare "caregiving burnout"')
    process.exit(1)
  }

  await gen({
    brand,
    topic,
    skipImage: args.includes('--no-image'),
    saveImage: args.includes('--save-image')
  })
}
