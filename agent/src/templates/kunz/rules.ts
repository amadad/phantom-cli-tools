/**
 * Mark Generation Rules
 *
 * Maps hook types + mood to mark patterns.
 * Each rule defines which glyphs, where, and how dense.
 */

import type { HookType, Mood } from "./analyze";

// Semantic mark vocabulary (from Kunz system)
export type TypographicMark =
  | "*"      // asterisk — footnote, invisible labor
  | "†"      // dagger — deeper invisible
  | "+"      // plus — positive feedback
  | "×"      // multiply — compounding
  | ":"      // colon — ratio
  | "/"      // slash — fraction
  | "~"      // tilde — approximate
  | "—"      // em dash — pause
  | "|"      // pipe — timeline
  | "%"      // percent — measurement
  | "#"      // hash — data structure
  | "."      // period — data point
  | "·"      // middle dot — softer
  | "○"      // empty circle — potential
  | "●"      // filled circle — complete
  | "[" | "]" | "(" | ")" | ">" | "<";

// Where marks can be placed
export type Placement =
  | "frame"           // Around edges
  | "scatter"         // Random across canvas
  | "flow-down"       // Top to bottom flow
  | "flow-up"         // Bottom to top flow
  | "cluster"         // Grouped in area
  | "line"            // Single line
  | "corner-tl"       // Top-left corner
  | "corner-br"       // Bottom-right corner
  | "center"          // Central area
  | "margin-left"     // Left margin
  | "margin-right";   // Right margin

// Density levels
export type Density = "sparse" | "light" | "medium" | "heavy" | "dense";

// Single mark rule
export interface MarkRule {
  glyph: TypographicMark | TypographicMark[];
  placement: Placement;
  density: Density;
  scale?: "small" | "medium" | "large";
  opacity?: number;
}

// Rules for each hook type — DIAL UP for texture presence
const HOOK_RULES: Record<HookType, MarkRule[]> = {
  // Questions: Open circles (unfilled potential), brackets frame the thought
  question: [
    { glyph: "○", placement: "scatter", density: "heavy", scale: "medium" },
    { glyph: "[", placement: "margin-left", density: "medium", scale: "large" },
    { glyph: "]", placement: "margin-right", density: "medium", scale: "large" },
    { glyph: "·", placement: "flow-down", density: "heavy", scale: "small" },
  ],

  // Statistics: Dense data points flowing toward the number
  statistic: [
    { glyph: "·", placement: "flow-down", density: "dense", scale: "small" },
    { glyph: "·", placement: "scatter", density: "heavy", scale: "small" },
    { glyph: "%", placement: "corner-br", density: "medium", scale: "large" },
    { glyph: "/", placement: "scatter", density: "heavy", scale: "medium" },
  ],

  // Stories: Quotation marks, em dashes for pauses
  story: [
    { glyph: "—", placement: "scatter", density: "heavy", scale: "medium" },
    { glyph: "·", placement: "flow-up", density: "heavy", scale: "small" },
    { glyph: ["(", ")"], placement: "frame", density: "medium", scale: "large" },
    { glyph: "~", placement: "scatter", density: "medium", scale: "small" },
  ],

  // Transformation: Asterisks (invisible) → filled circles (visible)
  transformation: [
    { glyph: "*", placement: "flow-up", density: "heavy", scale: "medium" },
    { glyph: "*", placement: "scatter", density: "heavy", scale: "small" },
    { glyph: "●", placement: "cluster", density: "medium", scale: "large" },
    { glyph: ">", placement: "center", density: "light", scale: "large" },
  ],

  // Affirmation: Plus signs, filled circles, positive symbols
  affirmation: [
    { glyph: "+", placement: "scatter", density: "heavy", scale: "medium" },
    { glyph: "●", placement: "scatter", density: "medium", scale: "small" },
    { glyph: "~", placement: "margin-right", density: "medium", scale: "large" },
    { glyph: "·", placement: "flow-down", density: "heavy", scale: "small" },
  ],
};

// Mood modifiers — subtle adjustments, don't kill density
const MOOD_MODIFIERS: Record<Mood, Partial<MarkRule>> = {
  intimate: { opacity: 0.35 },          // Keep density, just softer
  bold: { scale: "large", opacity: 0.6 },
  urgent: { scale: "medium", opacity: 0.5 },
  calm: { opacity: 0.4 },               // Keep density, just softer
};

/**
 * Get mark rules for a hook type + mood combination
 */
export function getRules(type: HookType, mood: Mood): MarkRule[] {
  const baseRules = HOOK_RULES[type];
  const modifier = MOOD_MODIFIERS[mood];

  // Apply mood modifiers to base rules
  return baseRules.map(rule => ({
    ...rule,
    density: modifier.density || rule.density,
    scale: modifier.scale || rule.scale,
    opacity: modifier.opacity ?? rule.opacity ?? 0.5,
  }));
}

/**
 * Density to count mapping (for a 12x12 grid = 144 cells)
 * DIALED UP for visible texture
 */
export function densityToCount(density: Density, gridSize: number = 144): number {
  const ratios: Record<Density, number> = {
    sparse: 0.12,   // ~17 marks
    light: 0.25,    // ~36 marks
    medium: 0.40,   // ~58 marks
    heavy: 0.55,    // ~80 marks
    dense: 0.75,    // ~108 marks
  };
  return Math.floor(gridSize * ratios[density]);
}

/**
 * Get all available glyphs for a rule (handles arrays)
 */
export function getGlyphs(rule: MarkRule): TypographicMark[] {
  return Array.isArray(rule.glyph) ? rule.glyph : [rule.glyph];
}
