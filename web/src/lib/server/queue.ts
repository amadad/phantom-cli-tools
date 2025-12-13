/**
 * Server functions for queue management
 */

import { createServerFn } from '@tanstack/react-start'

interface QueueItemData {
  id: string
  stage: string
  topic: string
  twitterText?: string
  linkedinText?: string
  imageUrl?: string
  createdAt: string
  updatedAt: string
  requiresApproval: boolean
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string
}

interface QueueStats {
  total: number
  pendingApproval: number
  stages: Record<string, number>
}

/**
 * Get queue statistics
 */
export const getQueueStatsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<QueueStats> => {
    const { readFileSync, existsSync } = await import('fs')
    const { join } = await import('path')

    const queuePath = join(process.cwd(), '..', 'output', 'queue', 'queue.json')

    if (!existsSync(queuePath)) {
      return {
        total: 0,
        pendingApproval: 0,
        stages: {}
      }
    }

    try {
      const data = JSON.parse(readFileSync(queuePath, 'utf-8'))
      const stages: Record<string, number> = {}

      for (const item of data) {
        stages[item.stage] = (stages[item.stage] || 0) + 1
      }

      const pendingApproval = data.filter(
        (item: any) =>
          item.stage === 'review' &&
          item.requiresApproval &&
          !item.approvedAt &&
          !item.rejectedAt
      ).length

      return {
        total: data.length,
        pendingApproval,
        stages
      }
    } catch {
      return { total: 0, pendingApproval: 0, stages: {} }
    }
  }
)

/**
 * Get all queue items
 */
export const getQueueItemsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<QueueItemData[]> => {
    const { readFileSync, existsSync } = await import('fs')
    const { join } = await import('path')

    const queuePath = join(process.cwd(), '..', 'output', 'queue', 'queue.json')

    if (!existsSync(queuePath)) {
      return []
    }

    try {
      const data = JSON.parse(readFileSync(queuePath, 'utf-8'))
      return data.map((item: any) => ({
        id: item.id,
        stage: item.stage,
        topic: item.content?.topic || item.source?.topic || 'Untitled',
        twitterText: item.content?.twitter?.text,
        linkedinText: item.content?.linkedin?.text,
        imageUrl: item.image?.url,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        requiresApproval: item.requiresApproval,
        approvedAt: item.approvedAt,
        rejectedAt: item.rejectedAt,
        rejectionReason: item.rejectionReason
      }))
    } catch {
      return []
    }
  }
)

/**
 * Approve a queue item
 */
export const approveQueueItemFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const { readFileSync, writeFileSync, existsSync } = await import('fs')
    const { join } = await import('path')

    const queuePath = join(process.cwd(), '..', 'output', 'queue', 'queue.json')

    if (!existsSync(queuePath)) {
      return { success: false, error: 'Queue not found' }
    }

    try {
      const queue = JSON.parse(readFileSync(queuePath, 'utf-8'))
      const index = queue.findIndex((item: any) => item.id === data.id)

      if (index === -1) {
        return { success: false, error: 'Item not found' }
      }

      queue[index] = {
        ...queue[index],
        approvedAt: new Date().toISOString(),
        stage: 'post',
        updatedAt: new Date().toISOString()
      }

      writeFileSync(queuePath, JSON.stringify(queue, null, 2))
      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to approve' }
    }
  })

/**
 * Reject a queue item
 */
export const rejectQueueItemFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string; reason?: string }) => data)
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const { readFileSync, writeFileSync, existsSync } = await import('fs')
    const { join } = await import('path')

    const queuePath = join(process.cwd(), '..', 'output', 'queue', 'queue.json')

    if (!existsSync(queuePath)) {
      return { success: false, error: 'Queue not found' }
    }

    try {
      const queue = JSON.parse(readFileSync(queuePath, 'utf-8'))
      const index = queue.findIndex((item: any) => item.id === data.id)

      if (index === -1) {
        return { success: false, error: 'Item not found' }
      }

      queue[index] = {
        ...queue[index],
        rejectedAt: new Date().toISOString(),
        rejectionReason: data.reason || 'Rejected',
        stage: 'failed',
        updatedAt: new Date().toISOString()
      }

      writeFileSync(queuePath, JSON.stringify(queue, null, 2))
      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to reject' }
    }
  })
