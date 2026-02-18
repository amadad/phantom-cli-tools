/**
 * Shared types for the layered composition system.
 * Renderer-agnostic: used by BrandFrame, layers, and render.ts.
 */

/** Flat token map as produced by tokens/build.js */
export interface BrandTokens {
  'color.background': string
  'color.primary': string
  'color.accent': string
  'color.secondary': string
  'color.warm'?: string
  'color.dark'?: string
  'color.light'?: string
  'typography.headline.font': string
  'typography.headline.weight': number
  'typography.headline.scaleFactorLarge': number
  'typography.headline.scaleFactorMedium': number
  'typography.headline.scaleFactorSmall': number
  'logo.colorOnLight': string
  'logo.colorOnDark': string
  [key: string]: string | number | undefined
}

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
  tokens: BrandTokens
  /** Template name — determines layout strategy */
  template: string
  /** Background type from template config */
  background: 'light' | 'dark' | 'warm'
  /** Text size category */
  textSize: 'large' | 'medium' | 'small'
  /** Pixel zones derived from template variant */
  imageZone: PixelZone
  textZone: PixelZone
  logoZone: PixelZone
  /** Headline text */
  headline: string
  /** AI-generated content image as Buffer */
  contentImage: Buffer
  /** Optional logo path */
  logoPath?: string
}
