/**
 * RendererConfig — single source of truth for all compositor design constants.
 *
 * Every numeric literal previously hardcoded in layouts.ts, TypeLayer.ts,
 * and GraphicLayer.ts now lives here as a named, overridable field.
 *
 * Brands override via `visual.renderer:` in their YAML.
 * Missing fields fall back to RENDERER_DEFAULTS (current behavior).
 */

import type { Density } from '../../core/visual'

// ── Layout proportions (per named layout) ──────────────────────────────────

export interface LayoutProportions {
  /** Fraction of available height for image (split vertical, card) */
  imageHeight?: number
  /** Fraction of available width for image (split horizontal) */
  imageWidth?: number
  /** Fraction of available height for text zone */
  textHeight?: number
  /** Fraction of canvas width for text zone */
  textWidth?: number
  /** Vertical offset ratio for non-center alignment */
  textYOffset?: number
  /** Vertical center position ratio */
  centerY?: number
  /** Asymmetric alignment Y offset */
  asymmetricYOffset?: number
  /** Left-alignment X nudge */
  leftXOffset?: number
  /** Asymmetric Y position ratio */
  asymmetricY?: number
  /** Left-alignment Y position ratio */
  leftY?: number
  /** Padding multiplier between image and text */
  textGap?: number
  /** Default dimming for this layout (0 = full brightness, 1 = invisible) */
  imageDim?: number
  /** Aspect ratio breakpoint for vertical/horizontal switch (split only) */
  verticalThreshold?: number
}

// ── Full renderer config ───────────────────────────────────────────────────

export interface RendererConfig {
  /** Margin ratios per density level (fraction of min canvas dimension) */
  margins: Record<Density, number>
  /** Logo sizing ratios (fractions of canvas width/height) */
  logo: { width: number; height: number; padding: number }
  /** Per-layout proportion overrides */
  layouts: Partial<Record<string, LayoutProportions>>
  /** Typography rendering constants */
  type: {
    /** Eyebrow font size as fraction of headline size */
    eyebrowRatio: number
    /** Eyebrow bottom margin as fraction of eyebrow size */
    eyebrowMargin: number
    /** Caption font size as fraction of headline size */
    captionRatio: number
    /** Subtext font size as fraction of headline size */
    subtextRatio: number
    /** Line height tightening multiplier for all-caps display text */
    capsLineHeightTighten: number
    /** Text zone inner padding as fraction of zone width */
    zonePadding: number
    /** Font size step-down multiplier when fitting text */
    fitShrinkFactor: number
    /** Minimum font size floor (px) */
    minFontSize: number
    /** Subtext line spacing multiplier */
    subtextLineSpacing: number
    /** Subtext vertical reserve multiplier for bottom gravity */
    subtextReserveMultiplier: number
  }
  /** Graphic layer constants */
  graphic: {
    /** Base gradient alpha (before channel scaling) */
    gradientAlphaBase: number
    /** Alpha increment per additional graphic channel */
    gradientAlphaStep: number
    /** Dark-mode text zone backing opacity */
    darkTextBacking: number
    /** Fallback dark color for palette (dark bg missing dark token) */
    fallbackDark: string
    /** Fallback accent color for dark palette / empty accent arrays */
    fallbackAccent: string
  }
}

// ── Defaults (match current hardcoded behavior exactly) ────────────────────

export const RENDERER_DEFAULTS: RendererConfig = {
  margins: { relaxed: 0.08, moderate: 0.05, tight: 0.025 },

  logo: { width: 0.12, height: 0.06, padding: 0.02 },

  layouts: {
    split: {
      imageHeight: 0.55,
      imageWidth: 0.5,
      textHeight: 0.6,
      textYOffset: 0.15,
      verticalThreshold: 0.85,
    },
    overlay: {
      textWidth: 0.7,
      textHeight: 0.45,
      centerY: 0.45,
      asymmetricYOffset: 0.06,
      leftXOffset: 0.04,
    },
    'type-only': {
      textHeight: 0.65,
      centerY: 0.4,
      asymmetricY: 0.15,
      leftY: 0.1,
    },
    card: {
      imageHeight: 0.65,
      textGap: 0.5,
    },
    'full-bleed': {
      textYOffset: 0.08,
      textWidth: 0.5,
      textHeight: 0.06,
      imageDim: 0.15,
    },
  },

  type: {
    eyebrowRatio: 0.38,
    eyebrowMargin: 0.8,
    captionRatio: 0.55,
    subtextRatio: 0.4,
    capsLineHeightTighten: 0.85,
    zonePadding: 0.04,
    fitShrinkFactor: 0.85,
    minFontSize: 20,
    subtextLineSpacing: 1.4,
    subtextReserveMultiplier: 2.4,
  },

  graphic: {
    gradientAlphaBase: 0.06,
    gradientAlphaStep: 0.04,
    darkTextBacking: 0.15,
    fallbackDark: '#2A2520',
    fallbackAccent: '#1a1a2e',
  },
}
