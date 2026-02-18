/**
 * BrandFrame — composes all three layers onto a canvas.
 *
 * Layer order (back to front):
 *   1. GraphicLayer  — background, gradient overlays, accent shapes, logo
 *   2. ImageLayer    — AI-generated content image
 *   3. TypeLayer     — headline text (always on top for legibility)
 *
 * Receives brand tokens and injects them into each layer.
 * No hardcoded visual values here — everything comes from tokens.
 */

import { createCanvas } from 'canvas'
import type { BrandFrameProps } from './types'
import { drawGraphicLayer } from './layers/GraphicLayer'
import { drawImageLayer } from './layers/ImageLayer'
import { drawTypeLayer } from './layers/TypeLayer'

export async function renderBrandFrame(props: BrandFrameProps): Promise<Buffer> {
  const {
    width, height, tokens, template, background, textSize,
    imageZone, textZone, logoZone,
    headline, contentImage, logoPath,
  } = props

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // ── Layer 1: Graphic (background + overlays + shapes + logo) ────────────────
  // Renders first so image and text sit above it
  await drawGraphicLayer({
    ctx,
    width,
    height,
    tokens,
    template,
    background,
    imageZone,
    textZone,
    logoZone,
    logoPath,
  })

  // ── Layer 2: Image (AI-generated content) ───────────────────────────────────
  await drawImageLayer({
    ctx,
    zone: imageZone,
    contentImage,
  })

  // ── Layer 3: Type (headline text) ───────────────────────────────────────────
  // Rendered last — always on top, maximum legibility
  // textAlign defaults to 'left'; could be extended from template config
  drawTypeLayer({
    ctx,
    height,
    tokens,
    textZone,
    textAlign: 'left',
    textSize,
    background,
    headline,
  })

  return canvas.toBuffer('image/png')
}
