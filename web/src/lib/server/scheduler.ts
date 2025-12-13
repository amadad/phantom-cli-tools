/**
 * Content scheduling system
 * Manages scheduled posts and executes them at the right time
 */

import { createServerFn } from '@tanstack/react-start'

export interface ScheduledPost {
  id: string
  generationId: string
  brand: string
  platforms: string[]
  scheduledFor: string // ISO date string
  status: 'pending' | 'published' | 'failed'
  createdAt: string
  publishedAt?: string
  error?: string
}

interface ScheduleResult {
  success: boolean
  scheduleId?: string
  error?: string
}

/**
 * Get the schedule file path
 */
async function getSchedulePath(): Promise<string> {
  const { join } = await import('path')
  return join(process.cwd(), '..', 'output', 'queue', 'schedule.json')
}

/**
 * Load scheduled posts
 */
async function loadSchedule(): Promise<ScheduledPost[]> {
  const { existsSync, readFileSync } = await import('fs')
  const schedulePath = await getSchedulePath()

  if (!existsSync(schedulePath)) {
    return []
  }

  return JSON.parse(readFileSync(schedulePath, 'utf-8'))
}

/**
 * Save scheduled posts
 */
async function saveSchedule(schedule: ScheduledPost[]): Promise<void> {
  const { writeFileSync, mkdirSync, existsSync } = await import('fs')
  const { dirname } = await import('path')
  const schedulePath = await getSchedulePath()

  const dir = dirname(schedulePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  writeFileSync(schedulePath, JSON.stringify(schedule, null, 2))
}

/**
 * Schedule a post for future publishing
 */
export const schedulePostFn = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    generationId: string
    brand: string
    platforms: string[]
    scheduledFor: string
  }) => data)
  .handler(async ({ data }): Promise<ScheduleResult> => {
    try {
      const schedule = await loadSchedule()

      const newPost: ScheduledPost = {
        id: `sched_${Date.now()}`,
        generationId: data.generationId,
        brand: data.brand,
        platforms: data.platforms,
        scheduledFor: data.scheduledFor,
        status: 'pending',
        createdAt: new Date().toISOString()
      }

      schedule.push(newPost)
      await saveSchedule(schedule)

      console.log(`[scheduler] Scheduled post ${newPost.id} for ${data.scheduledFor}`)

      return {
        success: true,
        scheduleId: newPost.id
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Scheduling failed'
      }
    }
  })

/**
 * Get all scheduled posts
 */
export const getScheduledPostsFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<ScheduledPost[]> => {
    return loadSchedule()
  })

/**
 * Cancel a scheduled post
 */
export const cancelScheduledPostFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { scheduleId: string }) => data)
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    try {
      const schedule = await loadSchedule()
      const index = schedule.findIndex(p => p.id === data.scheduleId)

      if (index === -1) {
        return { success: false, error: 'Scheduled post not found' }
      }

      if (schedule[index].status !== 'pending') {
        return { success: false, error: 'Cannot cancel non-pending post' }
      }

      schedule.splice(index, 1)
      await saveSchedule(schedule)

      console.log(`[scheduler] Cancelled scheduled post ${data.scheduleId}`)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cancellation failed'
      }
    }
  })

/**
 * Process due scheduled posts
 * Call this periodically (e.g., every minute via cron or background job)
 */
export const processDuePostsFn = createServerFn({ method: 'POST' })
  .handler(async (): Promise<{ processed: number; errors: number }> => {
    const { postToAll } = await import('./social')
    type Platform = 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'threads' | 'youtube'
    type Brand = 'scty' | 'givecare'
    const { existsSync, readFileSync } = await import('fs')
    const { join } = await import('path')

    const schedule = await loadSchedule()
    const now = new Date()
    let processed = 0
    let errors = 0

    for (const post of schedule) {
      if (post.status !== 'pending') continue

      const scheduledTime = new Date(post.scheduledFor)
      if (scheduledTime > now) continue

      console.log(`[scheduler] Processing due post ${post.id}...`)

      try {
        // Get content from queue
        const queuePath = join(process.cwd(), '..', 'output', 'queue', 'queue.json')
        if (!existsSync(queuePath)) {
          throw new Error('Queue not found')
        }

        const queue = JSON.parse(readFileSync(queuePath, 'utf-8'))
        const item = queue.find((i: { id: string }) => i.id === post.generationId)

        if (!item) {
          throw new Error('Content not found in queue')
        }

        // Build text from content
        const content = item.content?.twitter || item.content?.linkedin
        if (!content) {
          throw new Error('No content available')
        }

        const text = `${content.text}\n\n${content.hashtags.map((h: string) => `#${h}`).join(' ')}`
        const imageUrl = item.image?.url

        // Post to platforms
        const results = await postToAll({
          brand: post.brand as Brand,
          text,
          imageUrl,
          platforms: post.platforms as Platform[]
        })

        const allSuccess = results.every(r => r.success)

        post.status = allSuccess ? 'published' : 'failed'
        post.publishedAt = new Date().toISOString()

        if (!allSuccess) {
          post.error = results.filter(r => !r.success).map(r => `${r.platform}: ${r.error}`).join('; ')
          errors++
        } else {
          processed++
        }

        console.log(`[scheduler] Post ${post.id}: ${post.status}`)
      } catch (error) {
        post.status = 'failed'
        post.error = error instanceof Error ? error.message : 'Unknown error'
        errors++
        console.error(`[scheduler] Error processing ${post.id}:`, post.error)
      }
    }

    await saveSchedule(schedule)
    return { processed, errors }
  })

/**
 * Get upcoming scheduled posts (next 24 hours)
 */
export const getUpcomingPostsFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<ScheduledPost[]> => {
    const schedule = await loadSchedule()
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    return schedule.filter(post => {
      if (post.status !== 'pending') return false
      const scheduledTime = new Date(post.scheduledFor)
      return scheduledTime >= now && scheduledTime <= tomorrow
    }).sort((a, b) =>
      new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
    )
  })
