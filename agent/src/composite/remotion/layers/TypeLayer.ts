/**
 * TypeLayer — renders headline (and optional caption) text.
 *
 * Font family and size are derived entirely from brand tokens:
 *   font    = tokens['typography.headline.font']
 *   weight  = tokens['typography.headline.weight']
 *   size    = tokens['typography.headline.scaleFactorLarge|Medium|Small'] * height
 *
 * Text wrapping is handled manually (canvas has no built-in wrapping).
 */

import type { CanvasRenderingContext2D } from 'canvas'
import type { BrandTokens, PixelZone } from '../types'

export interface TypeLayerOptions {
  ctx: CanvasRenderingContext2D
  height: number
  tokens: BrandTokens
  textZone: PixelZone
  textAlign: 'left' | 'center' | 'right'
  textSize: 'large' | 'medium' | 'small'
  background: 'light' | 'dark' | 'warm'
  headline: string
  caption?: string
}

/** Resolve the text color from tokens and background type */
function resolveTextColor(tokens: BrandTokens, background: 'light' | 'dark' | 'warm'): string {
  if (background === 'dark') {
    return tokens['color.light'] ?? tokens['color.background'] ?? '#F7F7F2'
  }
  return tokens['color.primary'] ?? '#1E1B16'
}

/** Resolve font size scale factor key from text size */
function scaleKey(textSize: 'large' | 'medium' | 'small'): string {
  if (textSize === 'large')  return 'typography.headline.scaleFactorLarge'
  if (textSize === 'medium') return 'typography.headline.scaleFactorMedium'
  return 'typography.headline.scaleFactorSmall'
}

/**
 * Wrap text into lines that fit within maxWidth.
 * Returns array of lines.
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
    ctx, height, tokens, textZone, textAlign, textSize, background, headline, caption,
  } = options

  const fontFamily = tokens['typography.headline.font'] ?? 'sans-serif'
  const fontWeight = tokens['typography.headline.weight'] ?? 400
  const scale = (tokens[scaleKey(textSize)] as number) ?? 0.04
  const fontSize = Math.round(height * scale)
  const lineHeight = fontSize * 1.15
  const textColor = resolveTextColor(tokens, background)

  ctx.save()

  // Clip to text zone to prevent overflow
  ctx.beginPath()
  ctx.rect(textZone.x, textZone.y, textZone.width, textZone.height)
  ctx.clip()

  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", serif`
  ctx.fillStyle = textColor
  ctx.textBaseline = 'top'

  const canvasTextAlign = textAlign === 'center' ? 'center' : textAlign === 'right' ? 'right' : 'left'
  ctx.textAlign = canvasTextAlign

  const lines = wrapText(ctx, headline, textZone.width - 16)

  // X position depends on alignment
  let textX: number
  if (textAlign === 'center') textX = textZone.x + textZone.width / 2
  else if (textAlign === 'right') textX = textZone.x + textZone.width - 8
  else textX = textZone.x + 8

  // Vertically start from top of zone with small padding
  let y = textZone.y + 8

  for (const line of lines) {
    if (y + lineHeight > textZone.y + textZone.height) break // don't overflow
    ctx.fillText(line, textX, y)
    y += lineHeight
  }

  // Optional caption — smaller, secondary color
  if (caption) {
    const captionSize = Math.round(fontSize * 0.65)
    const captionColor = tokens['color.secondary'] ?? tokens['color.primary'] ?? '#3D3929'
    ctx.font = `400 ${captionSize}px "${fontFamily}", serif`
    ctx.fillStyle = captionColor
    y += 4
    ctx.fillText(caption, textX, y)
  }

  ctx.restore()
}
