/**
 * Typography Intelligence
 *
 * Auto-determines:
 * - Font sizes based on content length and mood
 * - Line breaks for rhythm and emphasis
 * - Vertical positioning
 */

import type { Analysis, LineBreak, Mood, HookType } from "./analyze";

export type Sizing = "impact" | "balanced" | "intimate";
export type Vertical = "top" | "center" | "bottom" | "spread";

export interface TypographySpec {
  lines: TypographyLine[];
  sizing: Sizing;
  vertical: Vertical;
}

export interface TypographyLine {
  text: string;
  fontSize: number;
  fontWeight: number;
  opacity: number;
  letterSpacing: number;
}

// Base font sizes per sizing mode (at 1080px width)
const BASE_SIZES: Record<Sizing, { display: number; headline: number; body: number; caption: number }> = {
  impact: { display: 180, headline: 96, body: 48, caption: 32 },
  balanced: { display: 120, headline: 72, body: 40, caption: 28 },
  intimate: { display: 96, headline: 64, body: 36, caption: 24 },
};

/**
 * Determine sizing mode from content analysis
 */
export function inferSizing(analysis: Analysis): Sizing {
  const { type, mood, lines } = analysis;

  // Statistics and bold content = impact
  if (type === "statistic" || mood === "bold") {
    return "impact";
  }

  // Questions and intimate content = intimate
  if (type === "question" && mood === "intimate") {
    return "intimate";
  }

  // Short, punchy content = impact
  const totalWords = lines.reduce((sum, l) => sum + l.text.split(/\s+/).length, 0);
  if (totalWords <= 6) {
    return "impact";
  }

  // Long content = intimate (more reading)
  if (totalWords > 15) {
    return "intimate";
  }

  return "balanced";
}

/**
 * Determine vertical position from content
 */
export function inferVertical(analysis: Analysis): Vertical {
  const { type, lines, mood } = analysis;

  // Multiple lines with different weights = spread
  const hasVariedWeights = lines.some(l => l.weight > 1.2);
  if (lines.length >= 3 && hasVariedWeights) {
    return "spread";
  }

  // Stories and testimonials often center
  if (type === "story") {
    return "center";
  }

  // Statistics with context above = bottom
  if (type === "statistic" && lines.length > 1) {
    return "center";
  }

  // Questions pull attention up
  if (type === "question") {
    return "center";
  }

  return "center"; // Safe default
}

/**
 * Convert LineBreak to full typography spec with font sizes
 */
export function computeTypography(
  analysis: Analysis,
  width: number = 1080
): TypographySpec {
  const sizing = inferSizing(analysis);
  const vertical = inferVertical(analysis);
  const scale = width / 1080; // Scale for different canvas sizes

  const sizes = BASE_SIZES[sizing];

  const lines: TypographyLine[] = analysis.lines.map((line, i) => {
    // Determine role based on weight and position
    const isEmphasis = line.isEmphasis;
    const isFirst = i === 0;
    const isLast = i === analysis.lines.length - 1;
    const hasNumber = /\d/.test(line.text);

    // Choose font size based on role
    let fontSize: number;
    if (hasNumber && analysis.type === "statistic") {
      fontSize = sizes.display; // Numbers get display size
    } else if (isEmphasis && (isFirst || isLast)) {
      fontSize = sizes.headline;
    } else if (line.weight >= 1.3) {
      fontSize = sizes.headline;
    } else if (line.weight >= 1.1) {
      fontSize = sizes.body;
    } else {
      fontSize = sizes.caption;
    }

    // Apply scale and weight adjustments
    fontSize = Math.round(fontSize * scale * line.weight);

    // Determine font weight
    let fontWeight = 400; // Regular
    if (isEmphasis || hasNumber) {
      fontWeight = 700; // Bold
    } else if (line.weight < 0.9) {
      fontWeight = 300; // Light
    }

    // Opacity based on emphasis
    let opacity = isEmphasis ? 1 : 0.85;
    if (analysis.mood === "calm") {
      opacity *= 0.9;
    }

    // Letter spacing (tighter for large, looser for small)
    const letterSpacing = fontSize > 80 ? -0.02 : fontSize < 40 ? 0.02 : 0;

    return {
      text: line.text,
      fontSize,
      fontWeight,
      opacity,
      letterSpacing,
    };
  });

  return { lines, sizing, vertical };
}

/**
 * Calculate total height needed for typography
 */
export function calculateTextHeight(spec: TypographySpec): number {
  return spec.lines.reduce((sum, line) => {
    const lineHeight = line.fontSize * 1.2; // Approximate line height
    return sum + lineHeight;
  }, 0);
}

/**
 * Get vertical offset for positioning text block
 */
export function getVerticalOffset(
  spec: TypographySpec,
  canvasHeight: number,
  textHeight: number
): number {
  const padding = canvasHeight * 0.1; // 10% padding

  switch (spec.vertical) {
    case "top":
      return padding;
    case "bottom":
      return canvasHeight - textHeight - padding;
    case "spread":
      // Spread distributes lines, handled differently
      return padding;
    case "center":
    default:
      return (canvasHeight - textHeight) / 2;
  }
}
