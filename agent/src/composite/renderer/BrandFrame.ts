/**
 * BrandFrame — composes all layers onto a canvas.
 *
 * Layer order (back to front):
 *   1. GraphicLayer  — background, gradient overlays, accent shapes
 *   2. ImageLayer    — AI-generated content image
 *   3. Logo          — always on top of image
 *   4. TypeLayer     — headline text (always on top for legibility)
 *
 * Receives BrandVisual and injects it into each layer.
 * No hardcoded visual values — everything comes from the visual config.
 */

import { createCanvas } from 'canvas'
import type { BrandFrameProps } from './types'
import { drawGraphicLayer, drawLogo } from './layers/GraphicLayer'
import { drawImageLayer } from './layers/ImageLayer'
import { drawTypeLayer } from './layers/TypeLayer'

export async function renderBrandFrame(props: BrandFrameProps): Promise<Buffer> {
  const {
    width, height, visual, layoutName, background, textSize,
    bgColorIndex, imageDim,
    category, subtext,
    imageZone, textZone, logoZone,
    headline, contentImage, logoPath,
  } = props

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // ── Layer 1: Graphic (background + overlays) ────────────────────────────────
  await drawGraphicLayer({
    ctx,
    width,
    height,
    visual,
    background,
    imageZone,
    textZone,
    bgColorIndex,
  })

  // ── Layer 2: Image (AI-generated content) ───────────────────────────────────
  if (contentImage && imageZone.width > 0 && imageZone.height > 0) {
    await drawImageLayer({
      ctx,
      zone: imageZone,
      contentImage,
      imageDim,
    })
  }

  // ── Layer 3: Logo (on top of image, below text) ─────────────────────────────
  await drawLogo({
    ctx,
    width,
    visual,
    logoZone,
    textZone,
    logoPath,
    layoutName,
  })

  // ── Layer 4: Type (headline text — always on top) ───────────────────────────
  const alignment = visual.alignment
  const textAlign: 'left' | 'center' | 'right' =
    alignment === 'asymmetric' ? 'left' : alignment === 'center' ? 'center' : 'left'

  drawTypeLayer({
    ctx,
    height,
    visual,
    textZone,
    textAlign,
    textSize,
    background,
    headline,
    category,
    subtext,
  })

  return canvas.toBuffer('image/png')
}
