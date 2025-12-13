#!/usr/bin/env node
/**
 * CLI for content pipeline
 *
 * Commands:
 *   pipeline <topic>  - Run pipeline for a topic
 *   monitor           - Start RSS feed monitoring
 *   post [id]         - Post approved content
 *   queue             - Show queue status
 *   approve <id>      - Approve item for posting
 *   reject <id>       - Reject item
 *   auth [platform]   - Check/setup social auth
 */

import { config } from 'dotenv'
import { join } from 'path'
import { runPipeline } from './pipeline/generate'
import { checkAllFeeds, startMonitor } from './triggers/rss'
import { processPostQueue, postById } from './social/post'
import { getAuthStatus, checkAuth, waitForAuth, postToAll } from './social/arcade'
import {
  getQueueStats,
  getPendingApproval,
  approveItem,
  rejectItem,
  addToQueue,
  loadQueue,
  updateQueueItem,
  getByStage
} from './queue'
import type { ContentSource, MonitorConfig } from './types'

// Load env
config({ path: join(process.cwd(), '..', '.env') })

const args = process.argv.slice(2)
const command = args[0]

async function main() {
  const apiKey = process.env.GEMINI_API_KEY
  const needsGemini = ['pipeline', 'monitor'].includes(command)
  const needsArcade = ['post', 'auth'].includes(command)

  if (needsGemini && !apiKey) {
    console.error('Error: GEMINI_API_KEY not set')
    process.exit(1)
  }

  if (needsArcade && !process.env.ARCADE_API_KEY) {
    console.error('Error: ARCADE_API_KEY not set')
    console.error('Get your API key at https://arcade.dev')
    process.exit(1)
  }

  switch (command) {
    case 'pipeline': {
      const topic = args.slice(1).join(' ')
      if (!topic) {
        console.error('Usage: pipeline <topic>')
        process.exit(1)
      }

      const source: ContentSource = {
        type: 'manual',
        topic,
        brandName: process.env.BRAND || 'givecare'
      }

      console.log(`\n[cli] Running pipeline for: "${topic}"`)
      const result = await runPipeline(source, {
        apiKey: apiKey!,
        autoApprove: process.env.AUTO_APPROVE === 'true'
      })

      console.log('\n[cli] Result:')
      console.log(`  ID: ${result.id}`)
      console.log(`  Stage: ${result.stage}`)
      console.log(`  Topic: ${result.content?.topic}`)
      console.log(`  Twitter: ${result.content?.twitter.text.slice(0, 50)}...`)
      break
    }

    case 'monitor': {
      // Load monitor config (or use defaults)
      const feeds = [
        {
          url: process.env.RSS_FEED_URL || 'https://example.com/feed',
          brandName: process.env.BRAND || 'givecare',
          checkInterval: 15 // minutes
        }
      ]

      console.log('[cli] Starting RSS monitor...')

      const stopMonitor = startMonitor(feeds, async (source, item) => {
        console.log(`\n[cli] New item: ${item.title}`)

        // Run pipeline for new items
        try {
          await runPipeline(source, {
            apiKey: apiKey!,
            autoApprove: process.env.AUTO_APPROVE === 'true'
          })
        } catch (error) {
          console.error('[cli] Pipeline error:', error)
        }
      })

      // Handle shutdown
      process.on('SIGINT', () => {
        console.log('\n[cli] Stopping monitor...')
        stopMonitor()
        process.exit(0)
      })

      // Keep process running
      console.log('[cli] Press Ctrl+C to stop')
      await new Promise(() => {})
      break
    }

    case 'post': {
      const id = args[1]

      if (id) {
        // Post specific item
        const items = getByStage('post')
        const item = items.find(i => i.id === id)

        if (!item) {
          console.error(`[cli] Item not found or not ready for posting: ${id}`)
          process.exit(1)
        }

        console.log(`[cli] Posting item: ${id}`)
        const results = await postToAll(item.content!, item.image?.url)

        let allSuccess = true
        for (const r of results) {
          const status = r.success ? 'success' : r.needsAuth ? 'needs auth' : 'failed'
          console.log(`  ${r.platform}: ${status}`)
          if (r.postUrl) console.log(`    URL: ${r.postUrl}`)
          if (r.needsAuth) console.log(`    Auth: ${r.authUrl}`)
          if (r.error) console.log(`    Error: ${r.error}`)
          if (!r.success) allSuccess = false
        }

        // Update queue
        updateQueueItem(id, {
          stage: allSuccess ? 'done' : 'failed',
          posts: results.map(r => ({
            platform: r.platform,
            success: r.success,
            postUrl: r.postUrl,
            error: r.error || (r.needsAuth ? 'Auth required' : undefined),
            postedAt: r.success ? new Date().toISOString() : undefined
          }))
        })
      } else {
        // Process all items in post queue
        const items = getByStage('post')
        if (items.length === 0) {
          console.log('[cli] No items ready to post')
          break
        }

        console.log(`[cli] Processing ${items.length} items...`)
        for (const item of items) {
          console.log(`\n[cli] Posting: ${item.id}`)
          const results = await postToAll(item.content!, item.image?.url)

          let allSuccess = true
          for (const r of results) {
            const status = r.success ? '✓' : r.needsAuth ? '⚠ auth' : '✗'
            console.log(`  ${status} ${r.platform}`)
            if (!r.success) allSuccess = false
          }

          updateQueueItem(item.id, {
            stage: allSuccess ? 'done' : 'failed',
            posts: results.map(r => ({
              platform: r.platform,
              success: r.success,
              postUrl: r.postUrl,
              error: r.error,
              postedAt: r.success ? new Date().toISOString() : undefined
            }))
          })
        }
      }
      break
    }

    case 'auth': {
      const platform = args[1] as 'twitter' | 'linkedin' | undefined

      if (platform && !['twitter', 'linkedin'].includes(platform)) {
        console.error('Usage: auth [twitter|linkedin]')
        process.exit(1)
      }

      console.log('\n[cli] Checking social media authorization...\n')

      if (platform) {
        // Check specific platform
        const result = await checkAuth(platform)
        console.log(`${platform}:`)
        if (result.authorized) {
          console.log('  ✓ Authorized')
        } else {
          console.log('  ✗ Not authorized')
          if (result.authUrl) {
            console.log(`\n  Authorize here: ${result.authUrl}`)
            console.log('\n  Waiting for authorization...')
            const success = await waitForAuth(result.authId!)
            if (success) {
              console.log('  ✓ Authorization complete!')
            } else {
              console.log('  ✗ Authorization failed or timed out')
            }
          }
        }
      } else {
        // Check all platforms
        const results = await getAuthStatus()
        for (const result of results) {
          const status = result.authorized ? '✓' : '✗'
          console.log(`  ${status} ${result.platform}`)
          if (!result.authorized && result.authUrl) {
            console.log(`      ${result.authUrl}`)
          }
        }

        const needsAuth = results.filter(r => !r.authorized)
        if (needsAuth.length > 0) {
          console.log('\nRun `npm run auth <platform>` to authorize each platform')
        }
      }
      break
    }

    case 'queue': {
      const stats = getQueueStats()
      console.log('\n[cli] Queue Status:')
      console.log(`  Total items: ${stats.total}`)
      console.log(`  Pending approval: ${stats.pendingApproval}`)
      console.log('\n  By stage:')
      for (const [stage, count] of Object.entries(stats.stages)) {
        if (count > 0) {
          console.log(`    ${stage}: ${count}`)
        }
      }

      const pending = getPendingApproval()
      if (pending.length > 0) {
        console.log('\n  Awaiting approval:')
        for (const item of pending) {
          console.log(`    ${item.id}: ${item.content?.topic || item.source.topic || 'Untitled'}`)
        }
      }
      break
    }

    case 'approve': {
      const id = args[1]
      if (!id) {
        console.error('Usage: approve <id>')
        process.exit(1)
      }

      const item = approveItem(id)
      if (item) {
        console.log(`[cli] Approved: ${id}`)
        console.log(`[cli] Ready for posting`)
      } else {
        console.error(`[cli] Item not found: ${id}`)
      }
      break
    }

    case 'reject': {
      const id = args[1]
      const reason = args.slice(2).join(' ') || 'Rejected'
      if (!id) {
        console.error('Usage: reject <id> [reason]')
        process.exit(1)
      }

      const item = rejectItem(id, reason)
      if (item) {
        console.log(`[cli] Rejected: ${id}`)
      } else {
        console.error(`[cli] Item not found: ${id}`)
      }
      break
    }

    case 'list': {
      const queue = loadQueue()
      if (queue.length === 0) {
        console.log('[cli] Queue is empty')
        break
      }

      console.log('\n[cli] All items:')
      for (const item of queue) {
        const status = item.approvedAt ? '✓' : item.rejectedAt ? '✗' : '○'
        console.log(`  ${status} ${item.id} [${item.stage}] ${item.content?.topic || item.source.topic || 'Untitled'}`)
      }
      break
    }

    default:
      console.log(`
Content Pipeline CLI

Commands:
  pipeline <topic>     Generate content for a topic
  monitor              Start RSS feed monitoring
  post [id]            Post approved content (or process all)
  auth [platform]      Check/setup Twitter & LinkedIn auth
  queue                Show queue statistics
  list                 List all queue items
  approve <id>         Approve item for posting
  reject <id> [reason] Reject item with optional reason

Environment:
  GEMINI_API_KEY       Required for generation
  ARCADE_API_KEY       Required for posting (get at arcade.dev)
  ARCADE_USER_ID       Your email or unique ID for Arcade
  BRAND                Brand name (default: givecare)
  AUTO_APPROVE         Skip review stage (true/false)
  RSS_FEED_URL         Feed to monitor

Examples:
  npm run pipeline "caregiver burnout and self-care"
  npm run auth                    # Check auth status
  npm run auth twitter            # Authorize Twitter
  npm run post                    # Post all approved items
`)
  }
}

main().catch(error => {
  console.error('[cli] Error:', error.message)
  process.exit(1)
})
