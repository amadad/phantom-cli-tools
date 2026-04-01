/**
 * Card renderer — proportional typographic system.
 *
 * Three decisions: figure, gravity, ground → PNG.
 * Sizes from √2 modular scale. Margins from Renner ratios (2:3:4:6).
 */

import { createCanvas, registerFont, Image, type CanvasRenderingContext2D } from 'canvas'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { ensureParentDir } from '../core/paths'
import { ditherCanvas, drawSubject, IMAGE_SUBJECTS, type ImageSubject } from './dither'

// ── Bundled font registration ──

const fontsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../fonts')

for (const [file, family, weight, style] of [
  ['Alegreya-Regular.ttf', 'Alegreya', '400', undefined],
  ['Alegreya-Bold.ttf', 'Alegreya', '700', undefined],
  ['Alegreya-Italic.ttf', 'Alegreya', '400', 'italic'],
  ['Inter-Regular.ttf', 'Inter', '400', undefined],
  ['Inter-Bold.ttf', 'Inter', '700', undefined],
  ['JetBrainsMono-Regular.ttf', 'JetBrains Mono', '400', undefined],
  ['JetBrainsMono-Medium.ttf', 'JetBrains Mono', '500', undefined],
] as const) {
  const p = join(fontsDir, file)
  if (existsSync(p)) registerFont(p, { family, weight, style })
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
  image?: string
  brandName: string
  logoPath?: string
}

export interface PlatformSpec { width: number; height: number; label: string }

export const PLATFORMS: Record<string, PlatformSpec> = {
  linkedin:  { width: 1200, height: 1200, label: 'LinkedIn 1:1' },
  twitter:   { width: 1600, height: 900,  label: 'Twitter 16:9' },
  instagram: { width: 1080, height: 1350, label: 'Instagram 4:5' },
  story:     { width: 1080, height: 1920, label: 'Story 9:16' },
}

export const FIGURES: Figure[] = ['statement', 'stat', 'passage', 'index']
export const GRAVITIES: Gravity[] = ['high', 'center', 'low']
export { IMAGE_SUBJECTS }

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

// ── Typography map ──

const TYPE: Record<string, { family: string; weight: number; style?: string }> = {
  eyebrow:  { family: '"JetBrains Mono", monospace', weight: 500 },
  headline: { family: '"Alegreya", Georgia, serif', weight: 400 },
  body:     { family: 'Inter, sans-serif', weight: 400 },
  stat:     { family: '"JetBrains Mono", monospace', weight: 400 },
  label:    { family: 'Inter, sans-serif', weight: 500 },
  quote:    { family: '"Alegreya", Georgia, serif', weight: 400, style: 'italic' },
  brand:    { family: '"JetBrains Mono", monospace', weight: 500 },
}

function font(role: string, sizePx: number): string {
  const t = TYPE[role]
  return `${t.style || ''} ${t.weight} ${sizePx}px ${t.family}`.trimStart()
}

// ── Primitives ──

const SCALE = Math.SQRT2

function scale(base: number, step: number): number {
  return Math.round(base * Math.pow(SCALE, step))
}

function seededRng(seed: string): () => number {
  let v = 2166136261
  for (let i = 0; i < seed.length; i++) { v ^= seed.charCodeAt(i); v = Math.imul(v, 16777619) }
  return () => { v += 0x6D2B79F5; let t = v; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

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

function splitBullets(text: string): string[] {
  return (text.includes('|') ? text.split('|') : text.split(/\n+/)).map(s => s.trim()).filter(Boolean)
}

function truncate(text: string, max: number): string {
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

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

// ── Layout system ──
// Renner margin ratios: top:side:side:bottom = 2:3:3:6 (base).
// Gravity shifts content within those ratios.
// Content and image boxes are non-overlapping halves.

interface Layout {
  mTop: number
  mBottom: number
  mSide: number
  contentW: number       // text column width
  imgX: number           // dither image x
  imgY: number           // dither image y
  imgW: number           // dither image width
  imgH: number           // dither image height
}

function computeLayout(width: number, height: number, gravity: Gravity, unit: number): Layout {
  const mSide = unit * 3
  const contentW = width * 0.52 - mSide  // text fills left ~52% minus margins

  // Image occupies the right ~48%, non-overlapping with content
  const imgX = width * 0.52

  // Gravity shifts content vertically; image mirrors
  let mTop: number, mBottom: number, imgY: number, imgH: number
  if (gravity === 'high') {
    mTop = unit * 2; mBottom = unit * 6
    imgY = height * 0.4; imgH = height * 0.6
  } else if (gravity === 'low') {
    mTop = unit * 6; mBottom = unit * 2
    imgY = 0; imgH = height * 0.6
  } else {
    mTop = unit * 3; mBottom = unit * 4
    imgY = height * 0.05; imgH = height * 0.9
  }

  return { mTop, mBottom, mSide, contentW, imgX, imgY, imgW: width - imgX, imgH }
}

// ── Main render ──

export function renderCard(input: CardInput, platform: PlatformSpec, seed: string): Buffer {
  const { width, height } = platform
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const g = input.ground
  const base = Math.round(width / 100)
  const s = (step: number) => scale(base * 1.2, step)
  const layout = computeLayout(width, height, input.gravity, base * 3)

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

  // ── Dithered image (right side, never overlaps text) ──
  const ditherSize = Math.min(width, height)
  const ditherCvs = createCanvas(ditherSize, ditherSize)
  const ditherCtx = ditherCvs.getContext('2d')
  ditherCtx.fillStyle = '#fff'
  ditherCtx.fillRect(0, 0, ditherSize, ditherSize)
  drawSubject(input.image || 'topography')(ditherCtx, ditherSize, ditherSize, seededRng(seed + '|img'))
  ditherCanvas(ditherCtx, ditherSize, ditherSize, g.dark)

  ctx.globalAlpha = 0.4
  ctx.drawImage(ditherCvs, 0, 0, ditherSize, ditherSize, layout.imgX, layout.imgY, layout.imgW, layout.imgH)
  ctx.globalAlpha = 1

  // ── Text cursor ──
  let cursorY = layout.mTop

  // ── Eyebrow ──
  ctx.font = font('eyebrow', s(0))
  ctx.fillStyle = muted(g.fg, g.bg, 0.55)
  drawSpaced(ctx, input.eyebrow.toUpperCase(), layout.mSide, cursorY + s(0), s(0) * 0.14)
  cursorY += s(0) + s(2)

  // ── Figure ──
  ctx.fillStyle = g.fg

  if (input.figure === 'statement') {
    ctx.font = font('headline', s(5))
    for (const line of wrapText(ctx, input.headline, layout.contentW)) {
      ctx.fillText(line, layout.mSide, cursorY + s(5))
      cursorY += s(5) * 1.1
    }
    cursorY += s(1)
    ctx.font = font('body', s(1))
    ctx.fillStyle = muted(g.fg, g.bg, 0.7)
    for (const line of wrapText(ctx, truncate(splitBullets(input.body).slice(0, 2).join(' '), 22), layout.contentW)) {
      ctx.fillText(line, layout.mSide, cursorY + s(1))
      cursorY += s(1) * 1.6
    }
  } else if (input.figure === 'stat' && input.stat) {
    ctx.font = font('stat', s(7))
    ctx.fillText(input.stat.num, layout.mSide, cursorY + s(7))
    cursorY += s(7) + s(-1)
    ctx.font = font('label', s(0))
    ctx.fillStyle = muted(g.fg, g.bg, 0.5)
    drawSpaced(ctx, input.stat.label.toUpperCase(), layout.mSide, cursorY + s(0), s(0) * 0.1)
    cursorY += s(0) + s(2)
    ctx.font = font('body', s(1))
    ctx.fillStyle = muted(g.fg, g.bg, 0.7)
    for (const line of wrapText(ctx, input.body, layout.contentW)) {
      ctx.fillText(line, layout.mSide, cursorY + s(1))
      cursorY += s(1) * 1.6
    }
  } else if (input.figure === 'passage') {
    ctx.font = font('headline', s(6))
    ctx.fillStyle = '#FF9F00'
    ctx.fillText('\u201C', layout.mSide, cursorY + s(5))
    cursorY += s(4)
    ctx.font = font('quote', s(3))
    ctx.fillStyle = g.fg
    for (const line of wrapText(ctx, truncate(splitBullets(input.body)[0] || input.body, 24), layout.contentW)) {
      ctx.fillText(line, layout.mSide, cursorY + s(3))
      cursorY += s(3) * 1.45
    }
  } else if (input.figure === 'index') {
    const items = splitBullets(input.body).slice(0, 4).map(b => truncate(b, 6))
    for (let i = 0; i < items.length; i++) {
      ctx.strokeStyle = i === 0 ? '#FF9F00' : muted(g.fg, g.bg, 0.12)
      ctx.lineWidth = i === 0 ? 2 : 1
      ctx.beginPath(); ctx.moveTo(layout.mSide, cursorY); ctx.lineTo(layout.mSide + layout.contentW, cursorY); ctx.stroke()
      cursorY += s(1)
      ctx.font = font('headline', s(4))
      ctx.fillStyle = g.fg
      ctx.fillText(items[i], layout.mSide, cursorY + s(3))
      cursorY += s(4) * 1.2
    }
  }

  // ── Brand mark ──
  const markY = height - layout.mBottom * 0.5
  if (input.logoPath && existsSync(input.logoPath)) {
    const img = new Image()
    img.src = readFileSync(input.logoPath)
    const logoH = s(1) * 1.4
    const logoW = (img.width / img.height) * logoH
    ctx.globalAlpha = 0.45
    ctx.drawImage(img, layout.mSide, markY - logoH, logoW, logoH)
    ctx.globalAlpha = 1
  } else {
    ctx.font = font('brand', s(0))
    ctx.fillStyle = muted(g.fg, g.bg, 0.45)
    drawSpaced(ctx, input.brandName.toUpperCase(), layout.mSide, markY, s(0) * 0.14)
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
