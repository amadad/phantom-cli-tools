/**
 * Discord content-queue notification
 *
 * Posts a review card to #content-queue with:
 *  - Image attachment (the generated poster)
 *  - Components v2: Container → TextDisplay + MediaGallery + Buttons
 *
 * Requires DISCORD_BOT_TOKEN in env.
 * Channel ID: 1473770540958482655 (#content-queue)
 */

import { readFileSync, existsSync } from 'fs'
import { basename, join } from 'path'
import type { QueueItem } from '../core/types'

const CONTENT_QUEUE_CHANNEL = process.env.DISCORD_CONTENT_QUEUE_CHANNEL ?? '1473770540958482655'

// Component v2 flag
const IS_COMPONENTS_V2 = 1 << 15 // 32768

// Emoji status by eval score
function scoreEmoji(score: number): string {
  if (score >= 85) return '🟢'
  if (score >= 70) return '🟡'
  return '🔴'
}

// Truncate text for display
function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…'
}

export interface NotifyOptions {
  item: QueueItem
  imagePath: string        // Local path to the poster PNG
  evalScore?: number       // 0–100 eval score
  evalPassed?: boolean
  platform?: string        // e.g. "Instagram"
  format?: string          // e.g. "portrait"
}

export async function notifyContentQueue(opts: NotifyOptions): Promise<{ messageId: string } | null> {
  const botToken = process.env.DISCORD_BOT_TOKEN
  if (!botToken) {
    console.warn('[discord-queue] DISCORD_BOT_TOKEN not set — skipping Discord notification')
    return null
  }

  const { item, imagePath, evalScore, platform, format } = opts

  if (!existsSync(imagePath)) {
    console.warn(`[discord-queue] Image not found: ${imagePath} — skipping Discord notification`)
    return null
  }

  const imageBuffer = readFileSync(imagePath)
  const imageFilename = basename(imagePath) // e.g. "twitter.png"

  const brand = item.source.brandName
  const topic = item.content.topic
  const queueId = item.id
  const score = evalScore ?? 0
  const emoji = scoreEmoji(score)

  // Build text content
  const scoreStr = evalScore !== undefined ? `Score: **${score}/100**` : ''
  const platformStr = [platform, format].filter(Boolean).join(' · ')
  const snippet = item.content.twitter?.text
    ? truncate(item.content.twitter.text, 120)
    : truncate(topic, 120)

  let textContent = `**${brand} · ${truncate(topic, 50)}** ${emoji}\n`
  if (platformStr) textContent += `\n> *${platformStr}*`
  if (snippet) textContent += `\n\n${snippet}`
  if (scoreStr) textContent += `\n\n${scoreStr}`

  // Custom IDs encode brand+queueId for agent callback handling
  const ids = {
    approve: `pla:${queueId}:${brand}`,
    regen:   `plr:${queueId}:${brand}`,
    feedback:`plf:${queueId}:${brand}`,
    discard: `pld:${queueId}:${brand}`,
  }

  // Discord Components v2 payload
  const components = [
    {
      type: 17, // Container
      components: [
        {
          type: 10, // TextDisplay
          content: textContent,
        },
        {
          type: 12, // MediaGallery
          items: [
            { media: { url: `attachment://${imageFilename}` } },
          ],
        },
        {
          type: 1, // ActionRow
          components: [
            { type: 2, style: 3, label: '✅ Post it',   custom_id: ids.approve },
            { type: 2, style: 2, label: '♻️ Regen',     custom_id: ids.regen },
            { type: 2, style: 1, label: '📝 Feedback',  custom_id: ids.feedback },
            { type: 2, style: 4, label: '🗑️ Discard',  custom_id: ids.discard },
          ],
        },
      ],
    },
  ]

  // Build multipart form-data manually (no external dep)
  const boundary = `----FormBoundary${Date.now().toString(36)}`
  const CRLF = '\r\n'

  const payloadJson = JSON.stringify({ flags: IS_COMPONENTS_V2, components })

  // Part 1: payload_json
  const part1 = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="payload_json"`,
    `Content-Type: application/json`,
    ``,
    payloadJson,
  ].join(CRLF)

  // Part 2: image file
  const part2Header = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="files[0]"; filename="${imageFilename}"`,
    `Content-Type: image/png`,
    ``,
    ``,
  ].join(CRLF)

  // Assemble binary body
  const part1Buf = Buffer.from(part1 + CRLF, 'utf-8')
  const part2HeaderBuf = Buffer.from(part2Header, 'utf-8')
  const closingBuf = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf-8')
  const body = Buffer.concat([part1Buf, part2HeaderBuf, imageBuffer, closingBuf])

  console.log(`[discord-queue] Posting to #content-queue (${imageFilename}, ${Math.round(imageBuffer.length / 1024)}KB)…`)

  const response = await fetch(
    `https://discord.com/api/v10/channels/${CONTENT_QUEUE_CHANNEL}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    }
  )

  if (!response.ok) {
    const err = await response.text()
    console.error(`[discord-queue] Discord API error ${response.status}: ${err}`)
    return null
  }

  const msg = await response.json() as { id: string }
  console.log(`[discord-queue] Posted message ${msg.id}`)
  return { messageId: msg.id }
}

/**
 * Post a simple text notification to a channel via Bot token.
 * Used for #content-shipped and #content-intel.
 */
async function postTextMessage(channelId: string, content: string): Promise<{ messageId: string } | null> {
  const botToken = process.env.DISCORD_BOT_TOKEN
  if (!botToken) return null

  const response = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    }
  )

  if (!response.ok) {
    console.error(`[discord-queue] Post failed ${response.status}: ${await response.text()}`)
    return null
  }

  const msg = await response.json() as { id: string }
  return { messageId: msg.id }
}

/**
 * Notify #content-shipped when a queue item is successfully posted to social platforms.
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

  return postTextMessage(SHIPPED_CHANNEL, lines.join('\n'))
}

/**
 * Notify #content-intel with a research digest (plain text / markdown).
 */
export async function notifyContentIntel(brand: string, digest: string): Promise<{ messageId: string } | null> {
  const INTEL_CHANNEL = process.env.DISCORD_CONTENT_INTEL_CHANNEL ?? '1473770521551311030'
  const header = `**${brand} · Content Intel** 📊\n\n`
  // Discord message limit: 2000 chars
  const body = (header + digest).slice(0, 1990)
  return postTextMessage(INTEL_CHANNEL, body)
}
