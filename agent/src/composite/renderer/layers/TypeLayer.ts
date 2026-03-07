/**
 * TypeLayer — renders headline (and optional caption) text.
 *
 * Font size is selected from BrandVisual.typography.headline.sizes
 * based on the textSize category from the named layout.
 *
 * Text wrapping is handled manually (canvas has no built-in wrapping).
 */

import type { CanvasRenderingContext2D } from 'canvas'
import type { BrandVisual, TypeGravity, VisualProfile } from '../../../core/visual'
import type { PixelZone } from '../types'
import type { TextSize } from '../../layouts'

export interface TypeLayerOptions {
  ctx: CanvasRenderingContext2D
  height: number
  visual: BrandVisual
  designProfile?: VisualProfile
  textZone: PixelZone
  textAlign: 'left' | 'center' | 'right'
  textSize: TextSize
  background: 'light' | 'dark' | 'warm'
  headline: string
  caption?: string
  /** Category eyebrow text above headline */
  category?: string
  /** Body copy / subtext below headline */
  subtext?: string
  /** Vertical text position within the text zone */
  typeGravity?: TypeGravity
}

/** Resolve the text color from visual config and background type */
function resolveTextColor(v: BrandVisual, background: 'light' | 'dark' | 'warm'): string {
  if (background === 'dark') {
    return v.palette.light ?? v.palette.background
  }
  return v.palette.primary
}

/**
 * Compute headline font size from visual config.
 * Maps textSize category to the named sizes in visual.typography.headline.sizes.
 */
function computeFontSize(v: BrandVisual, textSize: string): number {
  const sizes = v.typography.headline.sizes
  switch (textSize) {
    case 'display': return sizes.display
    case 'large':
    case 'lg': return sizes.lg
    case 'medium':
    case 'md': return sizes.md
    case 'small':
    case 'sm': return sizes.sm
    default: return sizes.md
  }
}

function pickSize(layoutSize: TextSize, override: string | undefined): TextSize {
  const candidate = (override ?? '').toLowerCase().trim()
  if (!candidate) return layoutSize
  if (candidate.includes('display') || candidate.includes('xl')) return 'display'
  if (candidate.includes('large') || candidate === 'lg' || candidate === 'l') return 'lg'
  if (candidate === 'sm-md' || candidate === 'md-sm') return 'md'
  if (candidate.includes('medium') || candidate === 'md' || candidate === 'm') return 'md'
  if (candidate.includes('small') || candidate === 'sm' || candidate === 's') return 'sm'
  return layoutSize
}

/**
 * Wrap text into lines that fit within maxWidth.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    const { width } = ctx.measureText(test)
    if (width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Shrink font size until wrapped text fits within the available height.
 * Steps down by 15% each iteration; floors at sizes.sm or 20px.
 */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  startSize: number,
  minSize: number,
  fontWeight: string | number,
  fontFamily: string,
  lineHeightRatio: number,
  maxWidth: number,
  maxHeight: number,
  shrinkFactor: number,
): number {
  let size = startSize
  while (size > minSize) {
    ctx.font = `${fontWeight} ${size}px "${fontFamily}", serif`
    const lines = wrapText(ctx, text, maxWidth)
    const totalHeight = lines.length * size * lineHeightRatio
    if (totalHeight <= maxHeight) return size
    size = Math.round(size * shrinkFactor)
  }
  return minSize
}

export function drawTypeLayer(options: TypeLayerOptions): void {
  const {
    ctx, height, visual, designProfile, textZone, textAlign, textSize, background, headline, caption,
    category, subtext, typeGravity,
  } = options

  const rc = visual.renderer
  const hl = visual.typography.headline
  const fontFamily = hl.font
  const fontWeight = designProfile?.typeWeight ?? hl.weight
  const textTransform = hl.transform
  const resolvedTextSize = pickSize(textSize, designProfile?.typeSize)
  const startFontSize = computeFontSize(visual, resolvedTextSize)
  const minFontSize = Math.max(hl.sizes.sm ?? rc.type.minFontSize, rc.type.minFontSize)
  const textColor = designProfile?.text ?? resolveTextColor(visual, background)

  const displayHeadline = textTransform === 'uppercase' ? headline.toUpperCase() : headline

  ctx.save()

  // Clip to text zone
  ctx.beginPath()
  ctx.rect(textZone.x, textZone.y, textZone.width, textZone.height)
  ctx.clip()

  const pad = Math.max(8, Math.round(textZone.width * rc.type.zonePadding))
  const wrapWidth = textZone.width - pad * 2

  // Reserve space for category eyebrow if present
  let eyebrowHeight = 0
  if (category) {
    const catSize = Math.round(startFontSize * rc.type.eyebrowRatio)
    eyebrowHeight = catSize + catSize * rc.type.eyebrowMargin
  }

  // Tighten leading for all-caps display type — no descenders, so less line gap needed
  const isAllCaps = displayHeadline === displayHeadline.toUpperCase() && /[A-Z]/.test(displayHeadline)
  const baseLineHeight = isAllCaps && startFontSize >= (hl.sizes.lg ?? 80)
    ? hl.lineHeight * rc.type.capsLineHeightTighten
    : hl.lineHeight

  const availableHeight = textZone.height - pad * 2 - eyebrowHeight
  const fontSize = fitFontSize(
    ctx, displayHeadline, startFontSize, minFontSize,
    fontWeight, fontFamily, baseLineHeight, wrapWidth, availableHeight,
    rc.type.fitShrinkFactor,
  )
  const lineHeight = fontSize * baseLineHeight

  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", serif`
  ctx.fillStyle = textColor
  ctx.textBaseline = 'top'

  const canvasTextAlign = textAlign === 'center' ? 'center' : textAlign === 'right' ? 'right' : 'left'
  ctx.textAlign = canvasTextAlign

  const lines = wrapText(ctx, displayHeadline, wrapWidth)
  const totalTextHeight = lines.length * lineHeight

  let textX: number
  if (textAlign === 'center') textX = textZone.x + textZone.width / 2
  else if (textAlign === 'right') textX = textZone.x + textZone.width - pad
  else textX = textZone.x + pad

  // Resolve vertical gravity: profile > prop > default 'top'
  const gravity = designProfile?.typeGravity ?? typeGravity ?? 'top'

  // Estimate subtext reserve for bottom gravity
  const subtextReserve = subtext ? Math.round(fontSize * rc.type.subtextRatio) * rc.type.subtextReserveMultiplier + pad : 0

  let y: number
  if (gravity === 'center') {
    y = textZone.y + (textZone.height - eyebrowHeight - totalTextHeight) / 2
  } else if (gravity === 'bottom') {
    y = textZone.y + textZone.height - pad - totalTextHeight - subtextReserve
  } else {
    y = textZone.y + pad
  }

  // Category eyebrow
  if (category) {
    const catSize = Math.round(fontSize * rc.type.eyebrowRatio)
    const accentColor = designProfile?.accent
      ? (Array.isArray(designProfile.accent) ? designProfile.accent[0] : designProfile.accent)
      : visual.palette.accent
    const catColor = typeof accentColor === 'string' ? accentColor : visual.palette.accent
    ctx.font = `700 ${catSize}px "system-ui", sans-serif`
    ctx.fillStyle = catColor
    ctx.fillText(textTransform === 'uppercase' ? category.toUpperCase() : category, textX, y)
    y += catSize + catSize * rc.type.eyebrowMargin
    ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", serif`
    ctx.fillStyle = textColor
  }

  for (const line of lines) {
    if (y + lineHeight > textZone.y + textZone.height) break
    ctx.fillText(line, textX, y)
    y += lineHeight
  }

  // Optional caption
  if (caption) {
    const captionSize = Math.round(fontSize * rc.type.captionRatio)
    const captionColor = visual.palette.secondary ?? visual.palette.primary
    ctx.font = `400 ${captionSize}px "${fontFamily}", serif`
    ctx.fillStyle = captionColor
    y += pad / 2
    ctx.fillText(caption, textX, y)
  }

  // Optional subtext
  if (subtext && y + Math.round(fontSize * rc.type.subtextRatio) < textZone.y + textZone.height) {
    y += pad
    const subSize = Math.round(fontSize * rc.type.subtextRatio)
    const subColor = visual.palette.secondary ?? visual.palette.primary
    ctx.font = `400 ${subSize}px "${fontFamily}", serif`
    ctx.fillStyle = subColor
    const subLines = wrapText(ctx, subtext, textZone.width - pad * 2)
    for (const line of subLines) {
      if (y + subSize > textZone.y + textZone.height) break
      ctx.fillText(line, textX, y)
      y += subSize * rc.type.subtextLineSpacing
    }
  }

  ctx.restore()
}
