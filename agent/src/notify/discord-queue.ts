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
// Which agent session to route through — 'main' for Orb, 'mira' for Mira
const OPENCLAW_SESSION_KEY = process.env.OPENCLAW_SESSION_KEY ?? 'main'
// Which Discord bot account to send as — matches openclaw.json accounts
const OPENCLAW_DISCORD_ACCOUNT = process.env.OPENCLAW_DISCORD_ACCOUNT ?? ''

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
 * Post a queue item to #content-queue.
 * Always uses direct Discord API (Components v2 with media gallery) for inline image rendering.
 * Gateway path does not support inline images reliably.
 */
export async function notifyContentQueue(opts: NotifyOptions): Promise<{ messageId: string } | null> {
  return notifyContentQueueDirect(opts)
}

/**
 * Direct Discord API post using Components v2 with media gallery (type 12).
 * This is the ONLY method that renders images inline in Discord.
 * The gateway path sends images as file attachments — not inline.
 */
async function notifyContentQueueDirect(opts: NotifyOptions): Promise<{ messageId: string } | null> {
  // Use Mira's bot token for GiveCare content — Orb should not post in content-queue
  const botToken = process.env.DISCORD_BOT_TOKEN_MIRA ?? process.env.DISCORD_BOT_TOKEN
  if (!botToken) {
    console.warn('[discord-queue] DISCORD_BOT_TOKEN not set — skipping')
    return null
  }

  const { item, imagePath, evalScore, platform, format } = opts

  if (!existsSync(imagePath)) {
    console.warn(`[discord-queue] Image not found: ${imagePath} — skipping`)
    return null
  }

  const imageBuffer = readFileSync(imagePath)
  const brand = item.source.brandName
  const topic = item.content.topic
  const queueId = item.id
  const score = evalScore ?? 0
  const emoji = scoreEmoji(score)
  const platformStr = [platform, format].filter(Boolean).join(' · ')
  const snippet = item.content.twitter?.text
    ? truncate(item.content.twitter.text, 120)
    : truncate(topic, 120)
  const scoreStr = evalScore !== undefined ? `Score: **${score}/100**` : ''

  let textContent = `**${brand} · ${truncate(topic, 50)}** ${emoji}\n`
  if (platformStr) textContent += `\n> *${platformStr}*`
  if (snippet) textContent += `\n\n${snippet}`
  if (scoreStr) textContent += `\n\n${scoreStr}`
  textContent += `\n\nQueue ID: \`${queueId}\` — reply "post it", "regen", or "discard" to act.`

  const IS_COMPONENTS_V2 = 1 << 15
  const components = [{
    type: 17,
    components: [
      { type: 10, content: textContent },
      { type: 12, items: [{ media: { url: `attachment://poster.png` } }] },
    ],
  }]

  const boundary = `----FormBoundary${Date.now().toString(36)}`
  const CRLF = '\r\n'
  const payloadJson = JSON.stringify({ flags: IS_COMPONENTS_V2, components })

  const part1 = [`--${boundary}`, `Content-Disposition: form-data; name="payload_json"`, `Content-Type: application/json`, ``, payloadJson].join(CRLF)
  const part2Header = [`--${boundary}`, `Content-Disposition: form-data; name="files[0]"; filename="poster.png"`, `Content-Type: image/png`, ``, ``].join(CRLF)
  const body = Buffer.concat([
    Buffer.from(part1 + CRLF, 'utf-8'),
    Buffer.from(part2Header, 'utf-8'),
    imageBuffer,
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf-8'),
  ])

  const response = await fetch(`https://discord.com/api/v10/channels/${CONTENT_QUEUE_CHANNEL}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${botToken}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  })

  if (!response.ok) {
    console.error(`[discord-queue] Discord API error ${response.status}: ${await response.text()}`)
    return null
  }

  const msg = await response.json() as { id: string }
  console.log(`[discord-queue] Posted message ${msg.id} (direct)`)
  return { messageId: msg.id }
}

async function notifyContentQueueGateway(opts: NotifyOptions): Promise<{ messageId: string } | null> {
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

  const args: Record<string, any> = {
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
  }

  // Route through specific Discord bot account if configured
  if (OPENCLAW_DISCORD_ACCOUNT) {
    args.accountId = OPENCLAW_DISCORD_ACCOUNT
  }

  const payload = {
    tool: 'message',
    args,
    sessionKey: OPENCLAW_SESSION_KEY,
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
    const args: Record<string, any> = {
      action: 'send',
      channel: 'discord',
      target: `channel:${channelId}`,
      message: content,
    }
    if (OPENCLAW_DISCORD_ACCOUNT) {
      args.accountId = OPENCLAW_DISCORD_ACCOUNT
    }

    const resp = await fetch(`${OPENCLAW_GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        tool: 'message',
        args,
        sessionKey: OPENCLAW_SESSION_KEY,
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
