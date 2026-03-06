/**
 * Discord content-queue notification
 *
 * Routes through OpenClaw message tool for inline images + working buttons.
 * Button clicks route back to Orb as inbound messages.
 *
 * Channels:
 *   #content-queue:   1473770540958482655
 *   #content-shipped: 1473770543097577502
 *   #content-intel:   1473770521551311030
 */

import { existsSync, readFileSync } from 'fs'
import type { QueueItem } from '../core/types'

const CONTENT_QUEUE_CHANNEL = process.env.DISCORD_CONTENT_QUEUE_CHANNEL ?? '1473770540958482655'
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? 'http://localhost:18789'
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? ''

function scoreEmoji(score: number): string {
  if (score >= 85) return '🟢'
  if (score >= 70) return '🟡'
  return '🔴'
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…'
}

export interface NotifyOptions {
  item: QueueItem
  imagePath: string
  evalScore?: number
  evalPassed?: boolean
  platform?: string
  format?: string
}

/**
 * Post a queue item to #content-queue via OpenClaw message tool.
 * Uses components v2 with media-gallery for inline images and action buttons.
 */
export async function notifyContentQueue(opts: NotifyOptions): Promise<{ messageId: string } | null> {
  const { item, imagePath, evalScore, platform, format } = opts

  if (!existsSync(imagePath)) {
    console.warn(`[discord-queue] Image not found: ${imagePath} — skipping`)
    return null
  }

  const brand = item.source.brandName
  const topic = item.content.topic
  const queueId = item.id
  const score = evalScore ?? 0
  const emoji = scoreEmoji(score)
  const platformStr = [platform, format].filter(Boolean).join(' · ')
  const twitterText = item.content.twitter?.text
  const snippet = truncate(twitterText ?? topic, 160)
  const scoreStr = evalScore !== undefined ? ` — Score: ${score}/100` : ''

  // Build message text
  let messageText = `**${brand} · ${truncate(topic, 50)}** ${emoji}${scoreStr}`
  if (platformStr) messageText += `\n> *${platformStr}*`
  if (snippet) messageText += `\n\n${snippet}`
  messageText += `\n\nQueue: \`${queueId}\``

  // Read image as base64 data URL for OpenClaw buffer
  const imageBuffer = readFileSync(imagePath)
  const imageB64 = `data:image/png;base64,${imageBuffer.toString('base64')}`

  const payload = {
    tool: 'message',
    args: {
      action: 'send',
      channel: 'discord',
      target: `channel:${CONTENT_QUEUE_CHANNEL}`,
      message: messageText,
      buffer: imageB64,
      filename: 'poster.png',
      components: {
        reusable: true,
        text: '',
        blocks: [
          {
            type: 'actions',
            buttons: [
              { label: `✅ Post ${queueId}`, style: 'success' },
              { label: `♻️ Regen ${brand} "${truncate(topic, 30)}"`, style: 'secondary' },
              { label: '🗑️ Discard', style: 'danger' },
            ],
          },
        ],
      },
    },
    sessionKey: 'main',
  }

  console.log(`[discord-queue] Posting to #content-queue via OpenClaw…`)

  try {
    const resp = await fetch(`${OPENCLAW_GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
      },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      const err = await resp.text()
      console.error(`[discord-queue] Gateway error ${resp.status}: ${err}`)
      return null
    }

    const result = await resp.json() as { result?: { messageId?: string } }
    const messageId = result?.result?.messageId ?? 'unknown'
    console.log(`[discord-queue] Posted message ${messageId}`)
    return { messageId }
  } catch (e: any) {
    console.error(`[discord-queue] Gateway unreachable: ${e.message}`)
    return null
  }
}

/**
 * Notify #content-shipped when a queue item is successfully posted.
 */
export interface ShippedOptions {
  brand: string
  topic: string
  queueId: string
  platforms: Array<{ platform: string; postUrl?: string; success: boolean }>
}

export async function notifyContentShipped(opts: ShippedOptions): Promise<{ messageId: string } | null> {
  const SHIPPED_CHANNEL = process.env.DISCORD_CONTENT_SHIPPED_CHANNEL ?? '1473770543097577502'
  const { brand, topic, queueId, platforms } = opts
  const succeeded = platforms.filter(p => p.success)
  const failed = platforms.filter(p => !p.success)

  const lines = [
    `**${brand} · ${truncate(topic, 60)}** ✅ Shipped`,
    `ID: \`${queueId}\``,
    '',
    ...succeeded.map(p => `  ✓ **${p.platform}**${p.postUrl ? ` — <${p.postUrl}>` : ''}`),
    ...failed.map(p => `  ✗ **${p.platform}** failed`),
  ]

  return sendViaGateway(SHIPPED_CHANNEL, lines.join('\n'))
}

/**
 * Notify #content-intel with a research digest.
 */
export async function notifyContentIntel(brand: string, digest: string): Promise<{ messageId: string } | null> {
  const INTEL_CHANNEL = process.env.DISCORD_CONTENT_INTEL_CHANNEL ?? '1473770521551311030'
  const header = `**${brand} · Content Intel** 📊\n\n`
  const body = (header + digest).slice(0, 1990)
  return sendViaGateway(INTEL_CHANNEL, body)
}

/**
 * Send text message via OpenClaw gateway.
 */
async function sendViaGateway(channelId: string, content: string): Promise<{ messageId: string } | null> {
  try {
    const resp = await fetch(`${OPENCLAW_GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        tool: 'message',
        args: {
          action: 'send',
          channel: 'discord',
          target: `channel:${channelId}`,
          message: content,
        },
        sessionKey: 'main',
      }),
    })

    if (!resp.ok) {
      console.error(`[discord-queue] Gateway error ${resp.status}: ${await resp.text()}`)
      return null
    }

    const result = await resp.json() as { result?: { messageId?: string } }
    return { messageId: result?.result?.messageId ?? 'unknown' }
  } catch (e: any) {
    console.error(`[discord-queue] Gateway unreachable: ${e.message}`)
    return null
  }
}
