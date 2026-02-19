/**
 * ImageLayer — renders the AI-generated content image into its designated zone.
 *
 * Imperative canvas implementation. The "layer" concept maps directly to a
 * canvas draw call that fills the imageZone rectangle.
 */

import type { CanvasRenderingContext2D } from 'canvas'
import { createCanvas, loadImage } from 'canvas'
import type { PixelZone } from '../types'

export interface ImageLayerOptions {
  ctx: CanvasRenderingContext2D
  zone: PixelZone
  contentImage?: Buffer
  /** Image dimming amount (0 = full brightness, 1 = invisible) */
  imageDim?: number
}

/**
 * Draw the content image into the image zone, cropped to fill (cover behavior).
 * No-op when contentImage is absent or zone is empty (type-only posts).
 */
export async function drawImageLayer(options: ImageLayerOptions): Promise<void> {
  const { ctx, zone, contentImage, imageDim } = options

  if (!contentImage || zone.width <= 0 || zone.height <= 0) return

  const img = await loadImage(contentImage)

  // Compute cover scaling: scale so the image fills the zone with no gaps
  const scaleX = zone.width / img.width
  const scaleY = zone.height / img.height
  const scale = Math.max(scaleX, scaleY)

  const drawWidth = img.width * scale
  const drawHeight = img.height * scale

  // Center the image within the zone
  const offsetX = zone.x + (zone.width - drawWidth) / 2
  const offsetY = zone.y + (zone.height - drawHeight) / 2

  // Clip to zone bounds, draw, restore clip
  ctx.save()
  ctx.beginPath()
  ctx.rect(zone.x, zone.y, zone.width, zone.height)
  ctx.clip()
  ctx.globalAlpha = Math.max(0.3, 1 - (imageDim ?? 0))
  ctx.drawImage(img as any, offsetX, offsetY, drawWidth, drawHeight)
  ctx.globalAlpha = 1.0
  ctx.restore()
}
