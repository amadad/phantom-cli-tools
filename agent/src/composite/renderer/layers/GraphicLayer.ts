/**
 * GraphicLayer — brand-consistent graphic framing elements.
 *
 * Renders structural/visual elements from BrandVisual:
 *   - Background fill (from palette)
 *   - Gradient overlay (accent color at low opacity, over image zone)
 *   - Text zone backing strip
 *
 * Logo is drawn separately via drawLogo() — called AFTER ImageLayer
 * so it always renders on top of the content image.
 */

import { loadImage, type CanvasRenderingContext2D } from 'canvas'
import { readFileSync, existsSync } from 'fs'
import type { BrandVisual } from '../../../core/visual'
import type { PixelZone } from '../types'
import { buildPalette } from '../../layouts'

export interface GraphicLayerOptions {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  visual: BrandVisual
  background: 'light' | 'dark' | 'warm'
  imageZone: PixelZone
  textZone: PixelZone
  /** Background palette index for color rotation */
  bgColorIndex?: number
}

export interface LogoOptions {
  ctx: CanvasRenderingContext2D
  width: number
  visual: BrandVisual
  logoZone: PixelZone
  textZone: PixelZone
  logoPath?: string
  layoutName: string
}

/** Parse hex color to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return [r, g, b]
}

/** Resolve background fill color from visual config */
function resolveBackground(v: BrandVisual, bg: 'light' | 'dark' | 'warm'): string {
  if (bg === 'dark') return v.palette.primary
  if (bg === 'warm') return v.palette.warm ?? v.palette.background
  return v.palette.background
}

export async function drawGraphicLayer(options: GraphicLayerOptions): Promise<void> {
  const {
    ctx, width, height, visual, background,
    imageZone, textZone,
    bgColorIndex,
  } = options

  const palette = buildPalette(visual)
  const bgColor = bgColorIndex !== undefined
    ? palette[bgColorIndex % palette.length]
    : resolveBackground(visual, background)
  const accentColor = visual.palette.accent
  const dark = background === 'dark'

  // ── 1. Background fill ──────────────────────────────────────────────────────
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, width, height)

  // ── 2. Gradient overlay on image zone (accent → transparent) ────────────────
  const [ar, ag, ab] = hexToRgb(accentColor)
  const grad = ctx.createLinearGradient(
    imageZone.x, imageZone.y + imageZone.height * 0.6,
    imageZone.x, imageZone.y + imageZone.height
  )
  grad.addColorStop(0, `rgba(${ar},${ag},${ab},0)`)
  grad.addColorStop(1, `rgba(${ar},${ag},${ab},0.15)`)
  ctx.fillStyle = grad
  ctx.fillRect(imageZone.x, imageZone.y, imageZone.width, imageZone.height)

  // ── 3. Text zone background (dark mode only — subtle darkening) ────────────
  if (dark) {
    ctx.fillStyle = `rgba(0,0,0,0.15)`
    ctx.fillRect(textZone.x, textZone.y, textZone.width, textZone.height)
  }
}

/**
 * Draw the logo on top of all other layers.
 * For split layouts, centers within the text column. Otherwise centers on canvas.
 */
export async function drawLogo(options: LogoOptions): Promise<void> {
  const { ctx, width, visual, logoZone, textZone, logoPath, layoutName } = options

  if (!logoPath || !existsSync(logoPath)) return

  try {
    const render = async (img: any) => {
      const scale = Math.min(logoZone.width / img.width, logoZone.height / img.height)
      const dw = img.width * scale
      const dh = img.height * scale

      // For split layouts: center logo within text column
      // For others: center on full canvas (if center-aligned) or use logoZone.x
      let dx: number
      if (layoutName === 'split') {
        dx = textZone.x + (textZone.width - dw) / 2
      } else if (visual.alignment === 'center') {
        dx = (width - dw) / 2
      } else {
        dx = logoZone.x
      }
      const dy = logoZone.y + (logoZone.height - dh) / 2

      ctx.drawImage(img as any, dx, dy, dw, dh)
    }

    if (logoPath.endsWith('.svg')) {
      const svgContent = readFileSync(logoPath, 'utf-8')
      const dataUri = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`
      await render(await loadImage(dataUri))
    } else {
      await render(await loadImage(logoPath))
    }
  } catch (err: any) {
    console.warn(`[GraphicLayer] Logo draw failed: ${err.message}`)
  }
}
