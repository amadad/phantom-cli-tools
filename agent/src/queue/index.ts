/**
 * Per-brand file-based queue for content items
 * Each brand has its own queue: brands/<brand>/queue.json
 */

import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs'
import type { QueueItem } from '../core/types'
import { getBrandDir, discoverBrands } from '../core/paths'

type QueueStage = 'review' | 'publishing' | 'done' | 'failed'

// Get queue file path for a brand
function getQueuePath(brand: string): string {
  return `${getBrandDir(brand)}/queue.json`
}

// Load queue from file for a specific brand
export function loadQueue(brand?: string): QueueItem[] {
  // If no brand specified, load all queues (for backwards compat / viewing)
  if (!brand) {
    return loadAllQueues()
  }

  const path = getQueuePath(brand)
  if (!existsSync(path)) {
    return []
  }
  try {
    const data = readFileSync(path, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

// Load all queues across all brands (for queue list command)
function loadAllQueues(): QueueItem[] {
  const brands = discoverBrands()
  const allItems: QueueItem[] = []

  for (const brand of brands) {
    const items = loadQueue(brand)
    allItems.push(...items)
  }

  // Sort by creation date
  return allItems.sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
}

// Save queue to file for a specific brand (atomic write via temp+rename)
export function saveQueue(brand: string, items: QueueItem[]): void {
  const path = getQueuePath(brand)
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(items, null, 2))
  renameSync(tmp, path)
}

// Add item to queue (brand is required on the item)
export function addToQueue(item: QueueItem): QueueItem {
  if (!item.brand) {
    throw new Error('[queue] Cannot add item without brand')
  }

  const queue = loadQueue(item.brand)
  queue.push(item)
  saveQueue(item.brand, queue)
  console.log(`[queue] Added ${item.id} to ${item.brand} (stage: ${item.stage})`)
  return item
}

// Update item in queue
export function updateQueueItem(brand: string, id: string, updates: Partial<QueueItem>): QueueItem | null {
  const queue = loadQueue(brand)
  const index = queue.findIndex(item => item.id === id)

  if (index === -1) {
    console.error(`[queue] Item not found: ${id} in ${brand}`)
    return null
  }

  queue[index] = {
    ...queue[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  saveQueue(brand, queue)
  console.log(`[queue] Updated ${id} in ${brand} (stage: ${queue[index].stage})`)
  return queue[index]
}

// Get items by stage for a brand
export function getByStage(brand: string, stage: QueueStage): QueueItem[] {
  return loadQueue(brand).filter(item => item.stage === stage)
}

// Get single item from a brand's queue
export function getQueueItem(brand: string, id: string): QueueItem | null {
  return loadQueue(brand).find(item => item.id === id) || null
}

// Remove item from a brand's queue
export function removeFromQueue(brand: string, id: string): boolean {
  const queue = loadQueue(brand)
  const filtered = queue.filter(item => item.id !== id)
  if (filtered.length < queue.length) {
    saveQueue(brand, filtered)
    console.log(`[queue] Removed ${id} from ${brand}`)
    return true
  }
  return false
}

// Get queue stats for a brand (or all brands)
export function getQueueStats(brand?: string) {
  const queue = loadQueue(brand)
  const stages: Record<QueueStage, number> = {
    review: 0,
    publishing: 0,
    done: 0,
    failed: 0
  }

  for (const item of queue) {
    if (item.stage in stages) {
      stages[item.stage as QueueStage]++
    }
  }

  return {
    total: queue.length,
    stages
  }
}
