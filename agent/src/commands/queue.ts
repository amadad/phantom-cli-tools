import { loadQueue, getQueueItem } from '../queue'
import { discoverBrands } from '../core/paths'
import type { QueueItem } from '../core/types'
import type { CommandContext, Output } from '../cli/types'
import { createConsoleOutput } from '../cli/output'

export interface QueueListResult {
  brand: string | null
  items: QueueItem[]
}

export type QueueShowResult = QueueItem

let output: Output = createConsoleOutput()

function setOutput(next?: Output): void {
  output = next ?? createConsoleOutput()
}

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
    output.info(brand ? `Queue for ${brand} is empty.` : 'Queue is empty.')
    return { brand: brand ?? null, items: [] }
  }

  output.info(`\nQueue (${queue.length} items):\n`)

  for (const item of queue) {
    output.info(`${formatStatus(item.stage)} [${item.stage}] ${item.id}`)
    output.info(`  Topic: ${item.content.topic}`)
    output.info(`  Brand: ${item.source.brandName}`)
    output.info(`  Created: ${item.createdAt}`)
    if (item.posts && item.posts.length > 0) {
      for (const post of item.posts) {
        if (post.success) {
          output.info(`  ${post.platform}: ${post.postUrl}`)
        }
      }
    }
    output.info('')
  }

  return { brand: brand ?? null, items: queue }
}

function showQueueItem(args: string[]): QueueShowResult {
  const [id, brandArg] = args
  if (!id) {
    output.error('Usage: queue show <id> [brand]')
    throw new Error('Missing queue id')
  }

  const brands = discoverBrands()
  const brand = brandArg && brands.includes(brandArg) ? brandArg : undefined

  if (brand) {
    const item = getQueueItem(brand, id)
    if (!item) {
      output.error(`Queue item not found: ${id} in ${brand}`)
      throw new Error(`Queue item not found: ${id} in ${brand}`)
    }

    printQueueItem(item)
    return item
  }

  const allItems = loadQueue()
  const match = allItems.find((item) => item.id === id)

  if (!match) {
    output.error(`Queue item not found: ${id}`)
    throw new Error(`Queue item not found: ${id}`)
  }

  printQueueItem(match)
  return match
}

function printQueueItem(item: QueueItem): void {
  output.info(`\n${item.id}`)
  output.info(`Stage: ${item.stage}`)
  output.info(`Brand: ${item.source.brandName}`)
  output.info(`Topic: ${item.content.topic}`)
  output.info(`Created: ${item.createdAt}`)
  output.info(`Updated: ${item.updatedAt}`)

  if (item.image) {
    output.info(`Image: ${item.image.url}`)
  }

  if (item.video) {
    output.info(`Video: ${item.video.url}`)
  }

  if (item.posts && item.posts.length > 0) {
    output.info('\nPosts:')
    for (const post of item.posts) {
      const status = post.success ? '✓' : '✗'
      const detail = post.postUrl || post.error || ''
      output.info(`  ${status} ${post.platform}${detail ? ` ${detail}` : ''}`)
    }
  }

  output.info('')
}

export async function run(args: string[], ctx?: CommandContext): Promise<QueueListResult | QueueShowResult> {
  setOutput(ctx?.output)
  const [subcommand, ...rest] = args
  const normalized = subcommand && !subcommand.startsWith('-') ? subcommand : 'list'

  if (normalized === 'list') {
    return listQueue(rest)
  }

  if (normalized === 'show') {
    return showQueueItem(rest)
  }

  output.error(`Unknown queue subcommand: ${normalized}`)
  output.error('Usage: queue [list|show <id>] [brand]')
  throw new Error(`Unknown queue subcommand: ${normalized}`)
}
