/**
 * Simple file-based queue for content items
 * In production, replace with Redis/Postgres
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { QueueItem } from '../core/types'

type QueueStage = 'review' | 'publishing' | 'done' | 'failed'

const QUEUE_DIR = join(process.cwd(), '..', 'output', 'queue')

// Ensure queue directory exists
function ensureDir() {
  if (!existsSync(QUEUE_DIR)) {
    mkdirSync(QUEUE_DIR, { recursive: true })
  }
}

// Generate unique ID
function generateId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// Get queue file path
function getQueuePath(): string {
  ensureDir()
  return join(QUEUE_DIR, 'queue.json')
}

// Load queue from file
export function loadQueue(): QueueItem[] {
  const path = getQueuePath()
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

// Save queue to file
export function saveQueue(items: QueueItem[]): void {
  const path = getQueuePath()
  writeFileSync(path, JSON.stringify(items, null, 2))
}

// Add item to queue
export function addToQueue(item: QueueItem): QueueItem {
  const queue = loadQueue()
  queue.push(item)
  saveQueue(queue)
  console.log(`[queue] Added ${item.id} (stage: ${item.stage})`)
  return item
}

// Update item in queue
export function updateQueueItem(id: string, updates: Partial<QueueItem>): QueueItem | null {
  const queue = loadQueue()
  const index = queue.findIndex(item => item.id === id)

  if (index === -1) {
    console.error(`[queue] Item not found: ${id}`)
    return null
  }

  queue[index] = {
    ...queue[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  saveQueue(queue)
  console.log(`[queue] Updated ${id} (stage: ${queue[index].stage})`)
  return queue[index]
}

// Get items by stage
export function getByStage(stage: QueueStage): QueueItem[] {
  return loadQueue().filter(item => item.stage === stage)
}

// Get single item
export function getQueueItem(id: string): QueueItem | null {
  return loadQueue().find(item => item.id === id) || null
}

// Remove item
export function removeFromQueue(id: string): boolean {
  const queue = loadQueue()
  const filtered = queue.filter(item => item.id !== id)
  if (filtered.length < queue.length) {
    saveQueue(filtered)
    console.log(`[queue] Removed ${id}`)
    return true
  }
  return false
}

// Get queue stats
export function getQueueStats() {
  const queue = loadQueue()
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
