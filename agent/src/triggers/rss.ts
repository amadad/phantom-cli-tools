/**
 * RSS/Blog monitor - watches feeds for new content
 */

import Parser from 'rss-parser'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { FeedItem, ContentSource } from '../types'

const parser = new Parser()
const STATE_DIR = join(process.cwd(), '..', 'output', 'state')

// Track seen items to avoid duplicates
interface FeedState {
  lastChecked: string
  seenIds: string[]
}

function ensureStateDir() {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true })
  }
}

function getStateFile(feedUrl: string): string {
  ensureStateDir()
  const hash = Buffer.from(feedUrl).toString('base64').slice(0, 20)
  return join(STATE_DIR, `feed_${hash}.json`)
}

function loadFeedState(feedUrl: string): FeedState {
  const path = getStateFile(feedUrl)
  if (!existsSync(path)) {
    return { lastChecked: '', seenIds: [] }
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return { lastChecked: '', seenIds: [] }
  }
}

function saveFeedState(feedUrl: string, state: FeedState): void {
  const path = getStateFile(feedUrl)
  writeFileSync(path, JSON.stringify(state, null, 2))
}

/**
 * Check a feed for new items
 */
export async function checkFeed(feedUrl: string, brandName: string): Promise<FeedItem[]> {
  console.log(`[rss] Checking ${feedUrl}`)

  const state = loadFeedState(feedUrl)
  const feed = await parser.parseURL(feedUrl)

  const newItems: FeedItem[] = []

  for (const item of feed.items) {
    const itemId = item.guid || item.link || item.title || ''

    if (!itemId || state.seenIds.includes(itemId)) {
      continue
    }

    // New item found
    newItems.push({
      title: item.title || 'Untitled',
      link: item.link || '',
      pubDate: item.pubDate || new Date().toISOString(),
      content: item.content,
      contentSnippet: item.contentSnippet
    })

    state.seenIds.push(itemId)
  }

  // Keep only last 100 seen IDs
  if (state.seenIds.length > 100) {
    state.seenIds = state.seenIds.slice(-100)
  }

  state.lastChecked = new Date().toISOString()
  saveFeedState(feedUrl, state)

  if (newItems.length > 0) {
    console.log(`[rss] Found ${newItems.length} new items`)
  }

  return newItems
}

/**
 * Convert feed item to content source
 */
export function feedItemToSource(item: FeedItem, brandName: string): ContentSource {
  return {
    type: 'rss',
    url: item.link,
    topic: item.title,
    brandName
  }
}

/**
 * Monitor multiple feeds (one-shot check)
 */
export async function checkAllFeeds(
  feeds: { url: string; brandName: string }[]
): Promise<{ source: ContentSource; item: FeedItem }[]> {
  const results: { source: ContentSource; item: FeedItem }[] = []

  for (const feed of feeds) {
    try {
      const items = await checkFeed(feed.url, feed.brandName)
      for (const item of items) {
        results.push({
          source: feedItemToSource(item, feed.brandName),
          item
        })
      }
    } catch (error) {
      console.error(`[rss] Error checking ${feed.url}:`, error)
    }
  }

  return results
}

/**
 * Start continuous monitoring
 */
export function startMonitor(
  feeds: { url: string; brandName: string; checkInterval: number }[],
  onNewItem: (source: ContentSource, item: FeedItem) => void
): () => void {
  const intervals: NodeJS.Timeout[] = []

  for (const feed of feeds) {
    const interval = setInterval(async () => {
      try {
        const items = await checkFeed(feed.url, feed.brandName)
        for (const item of items) {
          onNewItem(feedItemToSource(item, feed.brandName), item)
        }
      } catch (error) {
        console.error(`[rss] Error checking ${feed.url}:`, error)
      }
    }, feed.checkInterval * 60 * 1000)

    intervals.push(interval)
  }

  console.log(`[rss] Started monitoring ${feeds.length} feeds`)

  // Return cleanup function
  return () => {
    for (const interval of intervals) {
      clearInterval(interval)
    }
    console.log('[rss] Stopped monitoring')
  }
}
