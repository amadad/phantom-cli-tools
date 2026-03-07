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
import type { BrandVisual, VisualProfile } from '../../../core/visual'
import type { PixelZone } from '../types'
import { buildPalette } from '../../layouts'

export interface GraphicLayerOptions {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  visual: BrandVisual
  designProfile?: VisualProfile
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
  background: 'light' | 'dark' | 'warm'
}

/** Parse hex color to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.trim()
  if (!/^#?[0-9a-fA-F]{6}$/.test(normalized)) {
    return [0, 0, 0]
  }

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

function resolveChannels(raw: string | number | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(1, Math.min(4, Math.round(raw)))
  }

  if (typeof raw === 'string') {
    if (raw === 'full') return 4
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(4, Math.round(parsed)))
    }
  }

  return 2
}

function accentFromProfile(accent: string | string[], fallback: string): string {
  if (Array.isArray(accent)) {
    return accent[0] ?? fallback
  }
  return accent
}

/**
 * Draw layered graphics.
 */
export async function drawGraphicLayer(options: GraphicLayerOptions): Promise<void> {
  const {
    ctx,
    width,
    height,
    visual,
    background,
    designProfile,
    imageZone,
    textZone,
    bgColorIndex,
  } = options

  const rc = visual.renderer
  const palette = buildPalette(visual)
  const channelCount = resolveChannels(designProfile?.graphicChannels)
  const accentColor = accentFromProfile(designProfile?.accent ?? visual.palette.accent, rc.graphic.fallbackAccent)
  const [ar, ag, ab] = hexToRgb(accentColor)
  const dark = background === 'dark'

  const bgColor = designProfile?.field
    ? designProfile.field
    : bgColorIndex !== undefined
      ? palette[bgColorIndex % palette.length]
      : resolveBackground(visual, background)

  // ── 1. Background fill ──────────────────────────────────────────────────────
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, width, height)

  // ── 2. Gradient overlay on image zone (accent → transparent) ────────────────
  const alpha = rc.graphic.gradientAlphaBase + Math.max(0, channelCount - 1) * rc.graphic.gradientAlphaStep
  const grad = ctx.createLinearGradient(
    imageZone.x,
    imageZone.y + imageZone.height * 0.6,
    imageZone.x,
    imageZone.y + imageZone.height
  )
  grad.addColorStop(0, `rgba(${ar},${ag},${ab},0)`) 
  grad.addColorStop(1, `rgba(${ar},${ag},${ab},${alpha})`)
  ctx.fillStyle = grad
  ctx.fillRect(imageZone.x, imageZone.y, imageZone.width, imageZone.height)

  // ── 3. Text zone background (dark mode only — subtle darkening) ────────────
  if (dark) {
    ctx.fillStyle = `rgba(0,0,0,${rc.graphic.darkTextBacking})`
    ctx.fillRect(textZone.x, textZone.y, textZone.width, textZone.height)
  }
}

/** Replace fill color attributes in an SVG string */
function recolorSvg(svg: string, targetColor: string): string {
  return svg.replace(/fill="(#[0-9a-fA-F]{3,8})"/g, `fill="${targetColor}"`)
}

/**
 * Draw the logo on top of all other layers.
 * For split layouts, centers within the text column. Otherwise centers on canvas.
 * SVG logos are recolored using colorOnLight/colorOnDark from brand config.
 */
export async function drawLogo(options: LogoOptions): Promise<void> {
  const { ctx, width, visual, logoZone, textZone, logoPath, layoutName, background } = options

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
      let svgContent = readFileSync(logoPath, 'utf-8')
      const targetColor = background === 'dark'
        ? visual.logo.colorOnDark
        : visual.logo.colorOnLight
      if (targetColor) {
        svgContent = recolorSvg(svgContent, targetColor)
      }
      const dataUri = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`
      await render(await loadImage(dataUri))
    } else {
      await render(await loadImage(logoPath))
    }
  } catch (err: any) {
    console.warn(`[GraphicLayer] Logo draw failed: ${err.message}`)
  }
}
