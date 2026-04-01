/**
 * Card renderer — proportional typographic system
 *
 * Three decisions: figure, gravity, ground → PNG
 *
 * Sizes from √2 scale (base 12px, scaled to output resolution).
 * Margins from Renner ratios (2:3:3:6).
 * Dithered abstract imagery via Bayer 4×4 ordered dithering.
 */

import { createCanvas, registerFont, Image, type CanvasRenderingContext2D } from 'canvas'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { ensureParentDir } from '../core/paths'

// ── Register bundled fonts (critical for Linux/Hetzner where system fonts are absent) ──
const __dirname_card = dirname(fileURLToPath(import.meta.url))
const fontsDir = resolve(__dirname_card, '../../fonts')

const fontManifest: Array<{ file: string; family: string; weight?: string; style?: string }> = [
  { file: 'Alegreya-Regular.ttf', family: 'Alegreya', weight: '400' },
  { file: 'Alegreya-Bold.ttf', family: 'Alegreya', weight: '700' },
  { file: 'Alegreya-Italic.ttf', family: 'Alegreya', weight: '400', style: 'italic' },
  { file: 'Inter-Regular.ttf', family: 'Inter', weight: '400' },
  { file: 'Inter-Bold.ttf', family: 'Inter', weight: '700' },
  { file: 'JetBrainsMono-Regular.ttf', family: 'JetBrains Mono', weight: '400' },
  { file: 'JetBrainsMono-Medium.ttf', family: 'JetBrains Mono', weight: '500' },
]

for (const f of fontManifest) {
  const p = join(fontsDir, f.file)
  if (existsSync(p)) {
    registerFont(p, { family: f.family, weight: f.weight, style: f.style })
  }
}

// ── Types ──

export type Figure = 'statement' | 'stat' | 'passage' | 'index'
export type Gravity = 'high' | 'center' | 'low'

export interface Ground {
  id: string
  bg: string
  fg: string
  dark: boolean
  gradient?: { from: string; to: string; angle: number }
}

export interface CardInput {
  figure: Figure
  gravity: Gravity
  ground: Ground
  eyebrow: string
  headline: string
  body: string
  stat?: { num: string; label: string }
  image?: string // image subject id
  brandName: string
  logoPath?: string
}

export interface PlatformSpec {
  width: number
  height: number
  label: string
}

export const PLATFORMS: Record<string, PlatformSpec> = {
  linkedin: { width: 1200, height: 1200, label: 'LinkedIn 1:1' },
  twitter: { width: 1600, height: 900, label: 'Twitter 16:9' },
  instagram: { width: 1080, height: 1350, label: 'Instagram 4:5' },
  story: { width: 1080, height: 1920, label: 'Story 9:16' },
}

export const FIGURES: Figure[] = ['statement', 'stat', 'passage', 'index']
export const GRAVITIES: Gravity[] = ['high', 'center', 'low']

export const GROUNDS: Ground[] = [
  { id: 'cream', bg: '#FDF9EC', fg: '#3D1600', dark: false },
  { id: 'warm', bg: '#F0DCC0', fg: '#3D1600', dark: false },
  { id: 'slate', bg: '#E8E6E1', fg: '#1C1C1C', dark: false },
  { id: 'sage', bg: '#E4E8DC', fg: '#2A3328', dark: false },
  { id: 'grounded', bg: '#3D1600', fg: '#FDF9EC', dark: true },
  { id: 'mute', bg: '#1A0A00', fg: '#FDF9EC', dark: true },
  { id: 'ink', bg: '#1C1C1C', fg: '#E8E6E1', dark: true },
  { id: 'dusk', bg: '#2C2438', fg: '#E8E0F0', dark: true },
  { id: 'dawn', bg: '#FFF5E6', fg: '#3D1600', dark: false, gradient: { from: '#FFF5E6', to: '#F0D4C0', angle: 170 } },
  { id: 'ember', bg: '#3D1600', fg: '#FDF9EC', dark: true, gradient: { from: '#3D1600', to: '#5C2800', angle: 160 } },
  { id: 'fog', bg: '#F2F0ED', fg: '#1C1C1C', dark: false, gradient: { from: '#F2F0ED', to: '#D4D0CA', angle: 180 } },
  { id: 'storm', bg: '#1C1C1C', fg: '#E8E6E1', dark: true, gradient: { from: '#1C1C1C', to: '#2A2A30', angle: 160 } },
]

export const IMAGE_SUBJECTS = ['topography', 'watershed', 'strata', 'grid-erosion', 'root-system', 'threshold'] as const
export type ImageSubject = typeof IMAGE_SUBJECTS[number]

// ── √2 scale ──

const SCALE_FACTOR = Math.SQRT2
function scaleStep(base: number, step: number): number {
  return Math.round(base * Math.pow(SCALE_FACTOR, step))
}

// ── Seeded RNG ──

function seededRng(seed: string): () => number {
  let v = 2166136261
  for (let i = 0; i < seed.length; i++) { v ^= seed.charCodeAt(i); v = Math.imul(v, 16777619) }
  return () => { v += 0x6D2B79F5; let t = v; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// ── Color parsing ──

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function muted(fg: string, bg: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(fg)
  const [r2, g2, b2] = hexToRgb(bg)
  const mix = (a: number, b: number) => Math.round(a * t + b * (1 - t))
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`
}

// ── Bayer 4×4 dithering ──

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16)

// ── Image drawing functions ──

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number, rng: () => number) => void

const IMAGE_DRAW: Record<ImageSubject, DrawFn> = {
  topography(ctx, w, h, rng) {
    const layers = 8 + Math.floor(rng() * 6)
    const cx = w * (0.2 + rng() * 0.6), cy = h * (0.2 + rng() * 0.6)
    for (let i = layers; i > 0; i--) {
      const t = i / layers; ctx.beginPath()
      for (let p = 0; p <= 60; p++) {
        const a = (p / 60) * Math.PI * 2, bR = t * Math.min(w, h) * 0.45
        const n = bR * 0.3 * (Math.sin(a * 3 + rng() * 10) * 0.5 + Math.sin(a * 7 + rng() * 5) * 0.3 + Math.sin(a * 13 + rng() * 3) * 0.2)
        const x = cx + Math.cos(a) * (bR + n), y = cy + Math.sin(a) * (bR + n)
        p === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath(); ctx.fillStyle = `rgba(0,0,0,${0.04 + t * 0.12})`; ctx.fill()
    }
  },
  watershed(ctx, w, h, rng) {
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineCap = 'round'
    function br(x: number, y: number, a: number, d: number, lw: number) {
      if (d <= 0 || lw < 0.5) return
      const len = 20 + rng() * 40 * (d / 6), ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len
      ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke()
      const dr = (rng() - 0.5) * 0.6
      br(ex, ey, a + dr - 0.3, d - 1, lw * 0.7)
      if (rng() > 0.3) br(ex, ey, a + dr + 0.4, d - 1, lw * 0.6)
      if (rng() > 0.7) br(ex, ey, a + dr + 0.8, d - 1, lw * 0.4)
    }
    br(w * (0.3 + rng() * 0.4), -10, Math.PI / 2 + (rng() - 0.5) * 0.3, 8, 4)
  },
  strata(ctx, w, h, rng) {
    const n = 6 + Math.floor(rng() * 5)
    for (let i = 0; i < n; i++) {
      const by = (h / (n + 1)) * (i + 1); ctx.beginPath(); ctx.moveTo(0, by)
      for (let x = 0; x <= w; x += 4) ctx.lineTo(x, by + Math.sin(x * 0.01 + rng() * 20) * 15 + Math.sin(x * 0.03 + rng() * 10) * 8 + Math.sin(x * 0.07 + rng() * 5) * 4)
      ctx.lineTo(w, h + 10); ctx.lineTo(0, h + 10); ctx.closePath()
      ctx.fillStyle = `rgba(0,0,0,${0.02 + (i / n) * 0.08})`; ctx.fill()
    }
  },
  'grid-erosion'(ctx, w, h, rng) {
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1
    const sp = 16 + Math.floor(rng() * 12)
    for (let x = sp; x < w; x += sp) { ctx.beginPath(); for (let y = 0; y <= h; y += 3) { const d = Math.sin(y * 0.02 + x * 0.01) * (x / w) * 20 * rng(); y === 0 ? ctx.moveTo(x + d, y) : ctx.lineTo(x + d, y) } ctx.stroke() }
    for (let y = sp; y < h; y += sp) { ctx.beginPath(); for (let x = 0; x <= w; x += 3) { const d = Math.cos(x * 0.015 + y * 0.02) * (y / h) * 20 * rng(); x === 0 ? ctx.moveTo(x, y + d) : ctx.lineTo(x, y + d) } ctx.stroke() }
    for (let i = 0; i < 3 + Math.floor(rng() * 4); i++) { ctx.beginPath(); ctx.arc(rng() * w, rng() * h, 20 + rng() * 60, 0, Math.PI * 2); ctx.fillStyle = `rgba(0,0,0,${0.03 + rng() * 0.06})`; ctx.fill() }
  },
  'root-system'(ctx, w, h, rng) {
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineCap = 'round'
    function rt(x: number, y: number, a: number, d: number, lw: number) {
      if (d <= 0 || lw < 0.3) return
      const len = 12 + rng() * 30, c = (rng() - 0.5) * 1.2, ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len
      ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + Math.cos(a + c) * len * 0.5, y + Math.sin(a + c) * len * 0.5, ex, ey); ctx.stroke()
      rt(ex, ey, a + (rng() - 0.5) * 0.8, d - 1, lw * 0.75)
      if (rng() > 0.4) rt(ex, ey, a + (rng() - 0.3) * 1.2, d - 1, lw * 0.5)
    }
    for (let i = 0; i < 2 + Math.floor(rng() * 3); i++) rt(w * (0.15 + rng() * 0.7), -5, Math.PI / 2 + (rng() - 0.5) * 0.4, 7, 3)
  },
  threshold(ctx, w, h, rng) {
    const dw = w * (0.25 + rng() * 0.2), dh = h * (0.5 + rng() * 0.3), dx = w * (0.3 + rng() * 0.2), dy = h - dh - h * 0.08
    const gr = ctx.createRadialGradient(dx + dw / 2, dy + dh / 2, dw * 0.3, dx + dw / 2, dy + dh / 2, Math.max(w, h) * 0.6)
    gr.addColorStop(0, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(dx, dy, dw, dh)
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 2; ctx.strokeRect(dx - 4, dy - 4, dw + 8, dh + 8)
  },
}

// ── Dither an image canvas ──

function ditherCanvas(
  sourceCtx: CanvasRenderingContext2D,
  w: number, h: number,
  dark: boolean
): void {
  const imageData = sourceCtx.getImageData(0, 0, w, h)
  const data = imageData.data
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    const bit = gray < BAYER[(y % 4) * 4 + (x % 4)] * 255 ? 0 : 255
    if (dark) {
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255
      data[i + 3] = bit === 0 ? 140 : 0
    } else {
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0
      data[i + 3] = bit === 0 ? 140 : 0
    }
  }
  sourceCtx.putImageData(imageData, 0, 0)
}

// ── Text utilities ──

function splitBullets(text: string): string[] {
  return (text.includes('|') ? text.split('|') : text.split(/\n+/)).map(s => s.trim()).filter(Boolean)
}

function truncateWords(text: string, max: number): string {
  const words = text.split(/\s+/).filter(Boolean)
  return words.length <= max ? words.join(' ') : words.slice(0, max).join(' ') + '\u2026'
}

function drawSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number): void {
  let curX = x
  for (const char of text) {
    ctx.fillText(char, curX, y)
    curX += ctx.measureText(char).width + spacing
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, lineHeight: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? current + ' ' + word : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

// ── Main render ──

export function renderCard(input: CardInput, platform: PlatformSpec, seed: string): Buffer {
  const { width, height } = platform
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const g = input.ground
  const base = Math.round(width / 100) // base unit ≈ 1% of width

  // ── Background ──
  ctx.fillStyle = g.bg
  ctx.fillRect(0, 0, width, height)
  if (g.gradient) {
    const grad = ctx.createLinearGradient(0, 0, width * 0.3, height)
    grad.addColorStop(0, g.gradient.from)
    grad.addColorStop(1, g.gradient.to)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
  }

  // ── Dithered image layer ──
  const imgSubject = input.image || 'topography'
  const drawFn = IMAGE_DRAW[imgSubject as ImageSubject] || IMAGE_DRAW.topography
  const ditherSize = Math.min(width, height)
  const ditherCvs = createCanvas(ditherSize, ditherSize)
  const ditherCtx = ditherCvs.getContext('2d')
  ditherCtx.fillStyle = '#fff'
  ditherCtx.fillRect(0, 0, ditherSize, ditherSize)
  drawFn(ditherCtx, ditherSize, ditherSize, seededRng(seed + '|img'))
  ditherCanvas(ditherCtx, ditherSize, ditherSize, g.dark)

  // Place dither based on gravity — keep clear of content
  let dx: number, dy: number, dw: number, dh: number
  if (input.gravity === 'high') {
    dx = width * 0.4; dy = height * 0.45; dw = width * 0.6; dh = height * 0.55
  } else if (input.gravity === 'low') {
    dx = width * 0.35; dy = 0; dw = width * 0.65; dh = height * 0.55
  } else {
    dx = width * 0.5; dy = height * 0.05; dw = width * 0.5; dh = height * 0.9
  }

  ctx.globalAlpha = 0.4
  ctx.drawImage(ditherCvs, 0, 0, ditherSize, ditherSize, dx, dy, dw, dh)
  ctx.globalAlpha = 1

  // ── Margins (Renner: top 2, sides 3, bottom 6) ──
  const unit = base * 3
  let mTop: number, mBottom: number
  if (input.gravity === 'high') { mTop = unit * 2; mBottom = unit * 8 }
  else if (input.gravity === 'low') { mTop = unit * 6; mBottom = unit * 2 }
  else { mTop = unit * 3; mBottom = unit * 5 } // optical center
  const mSide = unit * 3

  const contentX = mSide
  const contentW = width * 0.55 // content never wider than ~55%
  let cursorY = mTop

  // ── Scale steps (at output resolution) ──
  const s = (step: number) => scaleStep(base * 1.2, step)

  // ── Eyebrow ──
  ctx.font = `500 ${s(0)}px "JetBrains Mono", monospace`
  ctx.fillStyle = muted(g.fg, g.bg, 0.55)
  drawSpaced(ctx, input.eyebrow.toUpperCase(), contentX, cursorY + s(0), s(0) * 0.14)
  cursorY += s(0) + s(2)

  // ── Figure ──
  ctx.fillStyle = g.fg

  if (input.figure === 'statement') {
    ctx.font = `400 ${s(5)}px "Alegreya", Georgia, serif`
    const lines = wrapText(ctx, input.headline, contentW, s(5) * 1.1)
    for (const line of lines) {
      ctx.fillText(line, contentX, cursorY + s(5))
      cursorY += s(5) * 1.1
    }
    // Support text
    cursorY += s(1)
    ctx.font = `400 ${s(1)}px Inter, sans-serif`
    ctx.fillStyle = muted(g.fg, g.bg, 0.7)
    const bodyLines = wrapText(ctx, truncateWords(splitBullets(input.body).slice(0, 2).join(' '), 22), contentW, s(1) * 1.6)
    for (const line of bodyLines) {
      ctx.fillText(line, contentX, cursorY + s(1))
      cursorY += s(1) * 1.6
    }
  } else if (input.figure === 'stat' && input.stat) {
    ctx.font = `400 ${s(7)}px "JetBrains Mono", monospace`
    ctx.fillText(input.stat.num, contentX, cursorY + s(7))
    cursorY += s(7) + s(-1)
    // Stat label
    ctx.font = `500 ${s(0)}px Inter, sans-serif`
    ctx.fillStyle = muted(g.fg, g.bg, 0.5)
    drawSpaced(ctx, input.stat.label.toUpperCase(), contentX, cursorY + s(0), s(0) * 0.1)
    cursorY += s(0) + s(1)
    // Block bar (Unicode)
    const barVal = parseInt(input.stat.num.replace(/\D/g, '')) % 100 || 65
    const filled = Math.round((barVal / 100) * 12)
    ctx.font = `400 ${s(0)}px "JetBrains Mono", monospace`
    ctx.fillStyle = muted(g.fg, g.bg, 0.5)
    ctx.fillText('\u2588'.repeat(filled) + '\u00B7'.repeat(12 - filled), contentX, cursorY + s(0))
    cursorY += s(2)
    // Context
    ctx.font = `400 ${s(1)}px Inter, sans-serif`
    ctx.fillStyle = muted(g.fg, g.bg, 0.7)
    const ctxLines = wrapText(ctx, input.stat.label, contentW, s(1) * 1.6)
    for (const line of ctxLines) {
      ctx.fillText(line, contentX, cursorY + s(1))
      cursorY += s(1) * 1.6
    }
  } else if (input.figure === 'passage') {
    // Quote mark
    ctx.font = `400 ${s(6)}px "Alegreya", Georgia, serif`
    ctx.fillStyle = '#FF9F00'
    ctx.fillText('\u201C', contentX, cursorY + s(5))
    cursorY += s(4)
    // Quote body
    ctx.font = `italic 400 ${s(3)}px "Alegreya", Georgia, serif`
    ctx.fillStyle = g.fg
    const quoteText = truncateWords(splitBullets(input.body)[0] || input.body, 24)
    const quoteLines = wrapText(ctx, quoteText, contentW, s(3) * 1.45)
    for (const line of quoteLines) {
      ctx.fillText(line, contentX, cursorY + s(3))
      cursorY += s(3) * 1.45
    }
  } else if (input.figure === 'index') {
    const items = splitBullets(input.body).slice(0, 4).map(b => truncateWords(b, 6))
    for (let i = 0; i < items.length; i++) {
      // Divider
      ctx.strokeStyle = i === 0 ? '#FF9F00' : muted(g.fg, g.bg, 0.12)
      ctx.lineWidth = i === 0 ? 2 : 1
      ctx.beginPath(); ctx.moveTo(contentX, cursorY); ctx.lineTo(contentX + contentW, cursorY); ctx.stroke()
      cursorY += s(1)
      // Item text
      ctx.font = `400 ${s(4)}px "Alegreya", Georgia, serif`
      ctx.fillStyle = g.fg
      ctx.fillText(items[i], contentX, cursorY + s(3))
      cursorY += s(4) * 1.2
    }
  }

  // ── Brand mark ──
  const markY = height - mBottom * 0.4
  if (input.logoPath && existsSync(input.logoPath)) {
    const img = new Image()
    img.src = readFileSync(input.logoPath)
    const logoH = s(1) * 1.4
    const logoW = (img.width / img.height) * logoH
    ctx.globalAlpha = 0.45
    ctx.drawImage(img, contentX, markY - logoH, logoW, logoH)
    ctx.globalAlpha = 1
  } else {
    ctx.font = `500 ${s(0)}px "JetBrains Mono", monospace`
    ctx.fillStyle = muted(g.fg, g.bg, 0.45)
    drawSpaced(ctx, input.brandName.toUpperCase(), contentX, markY, s(0) * 0.14)
  }

  return canvas.toBuffer('image/png')
}

// ── CLI entry point ──

export interface RenderCardOptions {
  figure: Figure
  gravity: Gravity
  ground: string
  platform: string
  eyebrow: string
  headline: string
  body: string
  statNum?: string
  statLabel?: string
  image?: string
  brandName?: string
  logoPath?: string
  seed?: string
  out: string
}

export function renderCardToFile(opts: RenderCardOptions): { path: string } {
  const ground = GROUNDS.find(g => g.id === opts.ground) || GROUNDS[0]
  const platform = PLATFORMS[opts.platform] || PLATFORMS.linkedin
  const seed = opts.seed || opts.ground + '|' + opts.figure + '|' + Date.now()

  const input: CardInput = {
    figure: opts.figure,
    gravity: opts.gravity,
    ground,
    eyebrow: opts.eyebrow,
    headline: opts.headline,
    body: opts.body,
    stat: opts.statNum ? { num: opts.statNum, label: opts.statLabel || '' } : undefined,
    image: opts.image,
    brandName: opts.brandName || 'GiveCare',
    logoPath: opts.logoPath,
  }

  const png = renderCard(input, platform, seed)
  ensureParentDir(opts.out)
  writeFileSync(opts.out, png)
  return { path: opts.out }
}
