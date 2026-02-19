/**
 * Shared types for the layered composition system.
 * Renderer-agnostic: used by BrandFrame, layers, and render.ts.
 */

import type { BrandVisual } from '../../core/visual'
import type { TextSize } from '../layouts'

/** Zone in absolute pixels */
export interface PixelZone {
  x: number
  y: number
  width: number
  height: number
}

/** All props passed into BrandFrame (and its layers) */
export interface BrandFrameProps {
  width: number
  height: number
  visual: BrandVisual
  /** Named layout — determines zone geometry */
  layoutName: string
  /** Background type from visual config */
  background: 'light' | 'dark' | 'warm'
  /** Text size category */
  textSize: TextSize
  /** Background palette index for color rotation */
  bgColorIndex?: number
  /** Image dimming amount (0 = full brightness, 1 = invisible) */
  imageDim?: number
  /** Category eyebrow text above headline */
  category?: string
  /** Body copy / subtext below headline */
  subtext?: string
  /** Pixel zones from named layout */
  imageZone: PixelZone
  textZone: PixelZone
  logoZone: PixelZone
  /** Headline text */
  headline: string
  /** AI-generated content image as Buffer (undefined for type-only posts) */
  contentImage?: Buffer
  /** Optional logo path */
  logoPath?: string
}

// Re-export for convenience
export type { BrandVisual }
