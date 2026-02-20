/**
 * Moodboard command — 3×3 image grid for fast visual selection
 *
 * Usage:
 *   moodboard <brand> "<topic>" [--json]
 *
 * Generates 9 image variations in parallel, composites into a numbered 3×3 grid,
 * posts to Discord #content-queue with numbered buttons (1–9 + Cancel).
 * User clicks a number → the selected cell image goes into the full explore pipeline.
 *
 * Button custom_id format: plm:{cellIndex}:{queueId}:{brand}
 * Cancel custom_id format:  plx:{queueId}:{brand}
 */

import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { join, slugify, createSessionDir } from '../core/paths'
import { extractBrandTopic } from '../cli/args'
import { generateImage } from '../generate/image'
import { loadBrandVisual } from '../core/visual'
import type { CommandContext } from '../cli/types'

export interface MoodboardResult {
  outputDir: string
  gridPath: string
  cells: string[]          // absolute paths: cell-1.png … cell-9.png
  messageId: string | null
  queueId: string
  brand: string
  topic: string
}

const CELL_SIZE = 512
const COLS = 3
const ROWS = 3
const GAP = 8
const BADGE_SIZE = 52
const GRID_W = COLS * CELL_SIZE + (COLS + 1) * GAP
const GRID_H = ROWS * CELL_SIZE + (ROWS + 1) * GAP

const CONTENT_QUEUE_CHANNEL = process.env.DISCORD_CONTENT_QUEUE_CHANNEL ?? '1473770540958482655'
const IS_COMPONENTS_V2 = 1 << 15 // 32768

// ─── Grid builder ───────────────────────────────────────────────────────────

async function buildGrid(
  cells: Buffer[],
  bgColor: string,
  accentColor: string
): Promise<Buffer> {
  const bg = sharp({
    create: {
      width: GRID_W,
      height: GRID_H,
      channels: 4,
      background: hexToRgba(bgColor),
    },
  })

  const overlays: sharp.OverlayOptions[] = []

  for (let i = 0; i < cells.length && i < 9; i++) {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = GAP + col * (CELL_SIZE + GAP)
    const y = GAP + row * (CELL_SIZE + GAP)

    const cell = await sharp(cells[i])
      .resize(CELL_SIZE, CELL_SIZE, { fit: 'cover' })
      .png()
      .toBuffer()

    overlays.push({ input: cell, left: x, top: y })

    // Number badge: filled circle with white numeral
    const num = i + 1
    const badge = `<svg width="${BADGE_SIZE}" height="${BADGE_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${BADGE_SIZE / 2}" cy="${BADGE_SIZE / 2}" r="${BADGE_SIZE / 2}" fill="${accentColor}" opacity="0.92"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
            font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffffff">${num}</text>
    </svg>`

    overlays.push({
      input: Buffer.from(badge),
      left: x + 8,
      top: y + 8,
    })
  }

  return bg.composite(overlays).png().toBuffer()
}

function hexToRgba(hex: string): { r: number; g: number; b: number; alpha: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    alpha: 1,
  }
}

// ─── Discord posting ─────────────────────────────────────────────────────────

async function postMoodboardToDiscord(
  brand: string,
  topic: string,
  queueId: string,
  gridBuffer: Buffer,
  cellCount: number
): Promise<string | null> {
  const botToken = process.env.DISCORD_BOT_TOKEN
  if (!botToken) {
    console.warn('[moodboard] DISCORD_BOT_TOKEN not set — skipping Discord post')
    return null
  }

  const row1Buttons = []
  const row2Buttons = []

  for (let i = 1; i <= Math.min(cellCount, 9); i++) {
    const btn = {
      type: 2,
      style: 2, // secondary / gray
      label: `${i}`,
      custom_id: `plm:${i}:${queueId}:${brand}`,
    }
    if (i <= 5) row1Buttons.push(btn)
    else row2Buttons.push(btn)
  }

  // Cancel button
  row2Buttons.push({
    type: 2,
    style: 4, // danger / red
    label: '✗ Cancel',
    custom_id: `plx:${queueId}:${brand}`,
  })

  const components: object[] = [
    {
      type: 17, // Container
      components: [
        {
          type: 10, // TextDisplay
          content: `**${brand} · ${topic}**\nPick an image →`,
        },
        {
          type: 12, // MediaGallery
          items: [{ media: { url: 'attachment://moodboard.png' } }],
        },
        { type: 1, components: row1Buttons },
        ...(row2Buttons.length ? [{ type: 1, components: row2Buttons }] : []),
      ],
    },
  ]

  const payloadJson = JSON.stringify({ flags: IS_COMPONENTS_V2, components })
  const CRLF = '\r\n'
  const boundary = `----MoodboardBoundary${Date.now().toString(36)}`

  const part1 = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="payload_json"`,
    `Content-Type: application/json`,
    ``,
    payloadJson,
  ].join(CRLF)

  const part2Header = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="files[0]"; filename="moodboard.png"`,
    `Content-Type: image/png`,
    ``,
    ``,
  ].join(CRLF)

  const body = Buffer.concat([
    Buffer.from(part1 + CRLF, 'utf-8'),
    Buffer.from(part2Header, 'utf-8'),
    gridBuffer,
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf-8'),
  ])

  console.log(`[moodboard] Posting grid (${Math.round(gridBuffer.length / 1024)}KB) to #content-queue…`)

  const res = await fetch(
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

  if (!res.ok) {
    console.error(`[moodboard] Discord error ${res.status}: ${await res.text()}`)
    return null
  }

  const msg = (await res.json()) as { id: string }
  console.log(`[moodboard] Posted message ${msg.id}`)
  return msg.id
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function run(
  args: string[],
  _ctx?: CommandContext
): Promise<MoodboardResult> {
  const parsed = extractBrandTopic(args, [])
  if (!parsed.topic) throw new Error('Missing topic. Usage: moodboard <brand> "<topic>"')

  const brand = parsed.brand
  const topic = parsed.topic
  const outputDir = createSessionDir(slugify(topic), '-moodboard')

  console.log(`[moodboard] Brand: ${brand}, Topic: "${topic}"`)
  console.log(`[moodboard] Output: ${outputDir}`)

  // Load brand visual for palette
  const visual = loadBrandVisual(brand)
  const accentColor = visual.palette.accent ?? '#5046E5'
  const bgColor = visual.palette.background ?? '#FDFBF7'

  const VARIATION_SEEDS = [
    'emphasize texture and materiality',
    'focus on geometric forms',
    'high contrast, minimal composition',
    'organic flowing shapes',
    'layered, collage-like depth',
    'bold, poster-like simplicity',
    'intricate pattern and repetition',
    'soft, atmospheric quality',
    'dynamic tension and movement',
  ]

  console.log(`[moodboard] Generating ${VARIATION_SEEDS.length} variations in parallel…`)
  const start = Date.now()

  const results = await Promise.all(
    VARIATION_SEEDS.map(async (seed, i) => {
      const variedTopic = `${topic}. Variation emphasis: ${seed}`
      const result = await generateImage('abstract', variedTopic, brand)
      if (result) {
        console.log(`  cell ${i + 1} OK`)
        return Buffer.from(result.b64, 'base64')
      }
      console.log(`  cell ${i + 1} FAIL`)
      return null
    })
  )

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[moodboard] Generated in ${elapsed}s`)

  const successful: Buffer[] = []
  for (const r of results) {
    if (r !== null) successful.push(r)
    if (successful.length >= 9) break
  }
  if (successful.length === 0) throw new Error('All image generations failed')

  console.log(`[moodboard] ${successful.length}/9 images generated`)

  // Save individual cell images
  const cellPaths: string[] = []
  for (let i = 0; i < successful.length; i++) {
    const p = join(outputDir, `cell-${i + 1}.png`)
    writeFileSync(p, successful[i])
    cellPaths.push(p)
  }

  // Build 3×3 grid
  console.log('[moodboard] Compositing grid…')
  const grid = await buildGrid(successful, bgColor, accentColor)
  const gridPath = join(outputDir, 'moodboard.png')
  writeFileSync(gridPath, grid)
  console.log(`[moodboard] Grid saved: ${gridPath}`)

  // Save metadata for button handler
  const queueId = `mb_${randomUUID()}`
  const meta = { queueId, brand, topic, cells: cellPaths, gridPath }
  writeFileSync(join(outputDir, 'moodboard-meta.json'), JSON.stringify(meta, null, 2))

  // Post to Discord
  const messageId = await postMoodboardToDiscord(
    brand, topic, queueId, grid, successful.length
  )

  return {
    outputDir,
    gridPath,
    cells: cellPaths,
    messageId: messageId ?? null,
    queueId,
    brand,
    topic,
  }
}
