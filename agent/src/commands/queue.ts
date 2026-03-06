import { loadQueue, getQueueItem, saveQueue } from '../queue'
import { discoverBrands } from '../core/paths'
import { notifyContentQueue } from '../notify/discord-queue'
import type { QueueItem } from '../core/types'
import type { CommandContext } from '../cli/types'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { getBrandDir } from '../core/paths'

export interface QueueListResult {
  brand: string | null
  items: QueueItem[]
}

export type QueueShowResult = QueueItem

function formatStatus(stage: QueueItem['stage']): string {
  if (stage === 'done') return '✓'
  if (stage === 'failed') return '✗'
  if (stage === 'review') return '○'
  return '◐'
}

function listQueue(args: string[]): QueueListResult {
  const brands = discoverBrands()
  const brand = args.find((arg) => brands.includes(arg))
  const queue = loadQueue(brand)

  if (queue.length === 0) {
    console.log(brand ? `Queue for ${brand} is empty.` : 'Queue is empty.')
    return { brand: brand ?? null, items: [] }
  }

  console.log(`\nQueue (${queue.length} items):\n`)

  for (const item of queue) {
    console.log(`${formatStatus(item.stage)} [${item.stage}] ${item.id}`)
    console.log(`  Topic: ${item.content.topic}`)
    console.log(`  Brand: ${item.source.brandName}`)
    console.log(`  Created: ${item.createdAt}`)
    if (item.posts && item.posts.length > 0) {
      for (const post of item.posts) {
        if (post.success) {
          console.log(`  ${post.platform}: ${post.postUrl}`)
        }
      }
    }
    console.log('')
  }

  return { brand: brand ?? null, items: queue }
}

function showQueueItem(args: string[]): QueueShowResult {
  const [id, brandArg] = args
  if (!id) {
    console.error('Usage: queue show <id> [brand]')
    throw new Error('Missing queue id')
  }

  const brands = discoverBrands()
  const brand = brandArg && brands.includes(brandArg) ? brandArg : undefined

  if (brand) {
    const item = getQueueItem(brand, id)
    if (!item) {
      console.error(`Queue item not found: ${id} in ${brand}`)
      throw new Error(`Queue item not found: ${id} in ${brand}`)
    }

    printQueueItem(item)
    return item
  }

  const allItems = loadQueue()
  const match = allItems.find((item) => item.id === id)

  if (!match) {
    console.error(`Queue item not found: ${id}`)
    throw new Error(`Queue item not found: ${id}`)
  }

  printQueueItem(match)
  return match
}

function printQueueItem(item: QueueItem): void {
  console.log(`\n${item.id}`)
  console.log(`Stage: ${item.stage}`)
  console.log(`Brand: ${item.source.brandName}`)
  console.log(`Topic: ${item.content.topic}`)
  console.log(`Created: ${item.createdAt}`)
  console.log(`Updated: ${item.updatedAt}`)

  if (item.image) {
    console.log(`Image: ${item.image.url}`)
  }

  if (item.video) {
    console.log(`Video: ${item.video.url}`)
  }

  if (item.posts && item.posts.length > 0) {
    console.log('\nPosts:')
    for (const post of item.posts) {
      const status = post.success ? '✓' : '✗'
      const detail = post.postUrl || post.error || ''
      console.log(`  ${status} ${post.platform}${detail ? ` ${detail}` : ''}`)
    }
  }

  console.log('')
}

async function notifyQueueItem(args: string[]): Promise<QueueShowResult> {
  const [id, brandArg] = args
  if (!id) {
    console.error('Usage: queue notify <id> <brand>')
    throw new Error('Missing queue id')
  }

  const brands = discoverBrands()
  const brand = brandArg && brands.includes(brandArg) ? brandArg : undefined

  let item: QueueItem | null = null
  if (brand) {
    item = getQueueItem(brand, id)
  } else {
    const all = loadQueue()
    item = all.find(i => i.id === id) ?? null
  }

  if (!item) {
    console.error(`Queue item not found: ${id}`)
    throw new Error(`Queue item not found: ${id}`)
  }

  // Find best available image: twitter.png in same dir as item.image.url
  let imagePath: string | undefined
  if (item.image?.url) {
    const dir = dirname(item.image.url)
    const candidates = ['twitter.png', 'instagram.png', 'linkedin.png']
    for (const f of candidates) {
      const p = join(dir, f)
      if (existsSync(p)) { imagePath = p; break }
    }
    if (!imagePath && existsSync(item.image.url)) {
      imagePath = item.image.url
    }
  }

  if (!imagePath) {
    console.error('No image found for this queue item')
    throw new Error('No image found')
  }

  console.log(`Notifying #content-queue for ${id}…`)
  const result = await notifyContentQueue({ item, imagePath })
  if (result) {
    console.log(`✓ Posted Discord message ${result.messageId}`)
  } else {
    console.warn('⚠ Discord notify returned null (check DISCORD_BOT_TOKEN)')
  }

  return item
}

/**
 * Archive done/failed items older than 30 days to queue-archive.json
 */
function archiveQueue(args: string[]): { brand: string; archived: number } {
  const brands = discoverBrands()
  const brand = args.find((arg) => brands.includes(arg))

  if (!brand) {
    console.error('Usage: queue archive <brand>')
    throw new Error('Missing brand')
  }

  const queue = loadQueue(brand)
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const toArchive = queue.filter(
    (item) =>
      (item.stage === 'done' || item.stage === 'failed') &&
      new Date(item.updatedAt).getTime() < cutoff
  )

  if (toArchive.length === 0) {
    console.log(`No items older than 30 days to archive for ${brand}.`)
    return { brand, archived: 0 }
  }

  // Append to archive file
  const archivePath = join(getBrandDir(brand), 'queue-archive.json')
  let existing: QueueItem[] = []
  if (existsSync(archivePath)) {
    try {
      existing = JSON.parse(readFileSync(archivePath, 'utf-8'))
    } catch {
      existing = []
    }
  }
  existing.push(...toArchive)
  writeFileSync(archivePath, JSON.stringify(existing, null, 2))

  // Remove archived items from active queue
  const remaining = queue.filter((item) => !toArchive.includes(item))
  saveQueue(brand, remaining)

  console.log(`Archived ${toArchive.length} items for ${brand} (${remaining.length} remain).`)
  return { brand, archived: toArchive.length }
}

export async function run(args: string[], _ctx?: CommandContext): Promise<QueueListResult | QueueShowResult | { brand: string; archived: number }> {
  const [subcommand, ...rest] = args
  const normalized = subcommand && !subcommand.startsWith('-') ? subcommand : 'list'

  switch (normalized) {
    case 'list': return listQueue(rest)
    case 'show': return showQueueItem(rest)
    case 'notify': return notifyQueueItem(rest)
    case 'archive': return archiveQueue(rest)
    default:
      console.error(`Unknown queue subcommand: ${normalized}`)
      console.error('Usage: queue [list|show|notify|archive] [brand]')
      throw new Error(`Unknown queue subcommand: ${normalized}`)
  }
}
