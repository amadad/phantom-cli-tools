/**
 * Enqueue command - Add content to the brand queue
 *
 * Usage:
 *   enqueue <brand> --topic "<topic>" --copy <path> --image <path> [--poster-dir <path>] [--json]
 *
 * --copy accepts either copy.json (preferred) or copy.md (legacy).
 */

import { readFileSync, existsSync } from 'fs'
import { addToQueue } from '../queue'
import { validateBrand, join } from '../core/paths'
import { parseArgs } from '../cli/args'
import { notifyContentQueue } from '../notify/discord-queue'
import type { QueueItem } from '../core/types'
import type { CommandContext } from '../cli/types'
import type { CopyResult } from '../generate/copy'

export interface EnqueueCommandResult {
  queueId: string
  brand: string
  stage: string
  notified?: boolean
}

export async function run(args: string[], _ctx?: CommandContext): Promise<EnqueueCommandResult> {
  const parsed = parseArgs(args, ['topic', 'copy', 'image', 'poster-dir'])
  const brand = parsed.brand
  const topic = parsed.flags.topic
  const copyPath = parsed.flags.copy
  const imagePath = parsed.flags.image
  const posterDir = parsed.flags['poster-dir']

  if (!topic) throw new Error('Missing --topic. Usage: enqueue <brand> --topic "<topic>" --copy <path> --image <path>')
  if (!copyPath) throw new Error('Missing --copy. Provide path to copy.json or copy.md')
  if (!imagePath) throw new Error('Missing --image. Provide path to selected image')
  if (!existsSync(copyPath)) throw new Error(`Copy file not found: ${copyPath}`)
  if (!existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`)
  validateBrand(brand)

  console.log(`[enqueue] Brand: ${brand}, Topic: "${topic}"`)

  const copy = loadCopy(copyPath)

  // Prefer twitter poster if poster-dir provided
  let posterImagePath = imagePath
  if (posterDir) {
    const twitterPoster = join(posterDir, 'twitter.png')
    if (existsSync(twitterPoster)) posterImagePath = twitterPoster
  }

  const now = new Date().toISOString()
  const queueItem: QueueItem = {
    id: `gen_${Date.now()}`,
    brand,
    source: { type: 'manual', topic, brandName: brand },
    stage: 'review',
    createdAt: now,
    updatedAt: now,
    requiresApproval: false,
    content: {
      topic,
      twitter: copy.twitter,
      linkedin: copy.linkedin,
      instagram: copy.instagram,
      threads: copy.threads
    },
    image: {
      url: posterImagePath,
      prompt: topic,
      model: 'manual'
    }
  }

  addToQueue(queueItem)
  console.log(`[enqueue] Added: ${queueItem.id} (stage: review)`)

  // --notify: post to #content-queue on Discord with image inline
  let notified = false
  if (parsed.booleans.has('notify')) {
    const notifyResult = await notifyContentQueue({
      item: queueItem,
      imagePath: posterImagePath,
    }).catch((e: Error) => {
      console.warn(`[enqueue] Discord notify failed: ${e.message}`)
      return null
    })
    notified = !!notifyResult
  }

  return { queueId: queueItem.id, brand, stage: 'review', notified }
}

/**
 * Load copy from JSON (preferred) or markdown (legacy fallback).
 */
function loadCopy(filePath: string): CopyResult {
  const raw = readFileSync(filePath, 'utf-8')

  // JSON path — structured, reliable
  if (filePath.endsWith('.json')) {
    return JSON.parse(raw) as CopyResult
  }

  // Markdown fallback — parse sections
  return parseCopyMarkdown(raw)
}

function parseCopyMarkdown(content: string): CopyResult {
  const sections: Record<string, string> = {}
  let currentSection = ''

  for (const line of content.split('\n')) {
    const heading = line.match(/^## (\w+)/)
    if (heading) {
      currentSection = heading[1].toLowerCase()
      sections[currentSection] = ''
    } else if (currentSection) {
      sections[currentSection] += line + '\n'
    }
  }

  function extractPlatform(key: string) {
    const raw = (sections[key] || '').trim()
    const hashtagLine = raw.match(/(#\w+[\s]*)+$/)?.[0] || ''
    const hashtags = hashtagLine.match(/#(\w+)/g)?.map(h => h.slice(1)) || []
    const text = raw.replace(/(#\w+[\s]*)+$/, '').trim()
    return { text, hashtags }
  }

  return {
    headline: '',
    imageDirection: '',
    twitter: extractPlatform('twitter'),
    linkedin: extractPlatform('linkedin'),
    instagram: extractPlatform('instagram'),
    threads: extractPlatform('threads')
  }
}
