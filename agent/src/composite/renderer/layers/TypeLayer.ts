/**
 * TypeLayer — renders headline (and optional caption) text.
 *
 * Font size is selected from BrandVisual.typography.headline.sizes
 * based on the textSize category from the named layout.
 *
 * Text wrapping is handled manually (canvas has no built-in wrapping).
 */

import type { CanvasRenderingContext2D } from 'canvas'
import type { BrandVisual } from '../../../core/visual'
import type { PixelZone } from '../types'
import type { TextSize } from '../../layouts'

export interface TypeLayerOptions {
  ctx: CanvasRenderingContext2D
  height: number
  visual: BrandVisual
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

export function drawTypeLayer(options: TypeLayerOptions): void {
  const {
    ctx, height, visual, textZone, textAlign, textSize, background, headline, caption,
    category, subtext,
  } = options

  const hl = visual.typography.headline
  const fontFamily = hl.font
  const fontWeight = hl.weight
  const textTransform = hl.transform
  const fontSize = computeFontSize(visual, textSize)
  const lineHeight = fontSize * hl.lineHeight
  const textColor = resolveTextColor(visual, background)

  const displayHeadline = textTransform === 'uppercase' ? headline.toUpperCase() : headline

  ctx.save()

  // Clip to text zone
  ctx.beginPath()
  ctx.rect(textZone.x, textZone.y, textZone.width, textZone.height)
  ctx.clip()

  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", serif`
  ctx.fillStyle = textColor
  ctx.textBaseline = 'top'

  const canvasTextAlign = textAlign === 'center' ? 'center' : textAlign === 'right' ? 'right' : 'left'
  ctx.textAlign = canvasTextAlign

  const pad = Math.max(8, Math.round(textZone.width * 0.04))
  const lines = wrapText(ctx, displayHeadline, textZone.width - pad * 2)

  let textX: number
  if (textAlign === 'center') textX = textZone.x + textZone.width / 2
  else if (textAlign === 'right') textX = textZone.x + textZone.width - pad
  else textX = textZone.x + pad

  let y = textZone.y + pad

  // Category eyebrow
  if (category) {
    const catSize = Math.round(fontSize * 0.38)
    const catColor = visual.palette.accent
    ctx.font = `700 ${catSize}px "system-ui", sans-serif`
    ctx.fillStyle = catColor
    ctx.fillText(category.toUpperCase(), textX, y)
    y += catSize + catSize * 0.8
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
    const captionSize = Math.round(fontSize * 0.55)
    const captionColor = visual.palette.secondary ?? visual.palette.primary
    ctx.font = `400 ${captionSize}px "${fontFamily}", serif`
    ctx.fillStyle = captionColor
    y += pad / 2
    ctx.fillText(caption, textX, y)
  }

  // Optional subtext
  if (subtext && y + Math.round(fontSize * 0.4) < textZone.y + textZone.height) {
    y += pad
    const subSize = Math.round(fontSize * 0.4)
    const subColor = visual.palette.secondary ?? visual.palette.primary
    ctx.font = `400 ${subSize}px "${fontFamily}", serif`
    ctx.fillStyle = subColor
    const subLines = wrapText(ctx, subtext, textZone.width - pad * 2)
    for (const line of subLines) {
      if (y + subSize > textZone.y + textZone.height) break
      ctx.fillText(line, textX, y)
      y += subSize * 1.4
    }
  }

  ctx.restore()
}
