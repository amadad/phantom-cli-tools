/**
 * Autonomous Kunz Design System
 *
 * Content-first generation: text → all platform images
 *
 * Usage:
 *   import { generate, generateSingle } from "./src/templates/kunz";
 *
 *   // Generate all 5 platforms
 *   const images = await generate("Do you want me to tell you about my mom?");
 *
 *   // Generate single platform
 *   const image = await generateSingle("...", "instagram-feed");
 */

// Main API
export { generate, generateSingle, generateAll, type GeneratedImage } from "./generate";

// Analysis (for debugging/inspection)
export {
  analyze,
  detectType,
  detectMood,
  findEmphasis,
  findBreakPoints,
  type Analysis,
  type HookType,
  type Mood,
  type LineBreak,
} from "./analyze";

// Rules (for customization)
export {
  getRules,
  densityToCount,
  type MarkRule,
  type Placement,
  type Density,
  type TypographicMark,
} from "./rules";

// Typography (for inspection)
export {
  computeTypography,
  inferSizing,
  inferVertical,
  type TypographySpec,
  type TypographyLine,
  type Sizing,
  type Vertical,
} from "./typography";

// Marks (for inspection)
export { generateMarks, type MarkPosition, type ExclusionZone } from "./marks";

// Platforms (for customization)
export {
  getPlatform,
  getAllPlatforms,
  getTextBounds,
  ALL_PLATFORMS,
  SOCIAL_PRIORITY,
  type Platform,
  type PlatformSpec,
  type PlatformRatio,
} from "./platform";
