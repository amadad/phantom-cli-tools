/**
 * Platform Adapter
 *
 * Handles platform-specific configurations:
 * - Aspect ratios and dimensions
 * - Logo placement
 * - Typography adjustments
 * - Safe zones (for UI overlays)
 */

export type PlatformRatio = "1:1" | "4:5" | "9:16" | "16:9" | "1.91:1";
export type Platform = "instagram-feed" | "instagram-portrait" | "stories" | "twitter" | "linkedin";

export interface PlatformSpec {
  name: Platform;
  ratio: PlatformRatio;
  width: number;
  height: number;
  logoPosition: "top" | "bottom";
  safeZone: { top: number; bottom: number; left: number; right: number };
  fontScale: number;       // Relative to 1080px base
  markDensityScale: number; // Adjust marks for aspect
}

// All platform configurations
const PLATFORMS: Record<Platform, PlatformSpec> = {
  "instagram-feed": {
    name: "instagram-feed",
    ratio: "1:1",
    width: 1080,
    height: 1080,
    logoPosition: "bottom",
    safeZone: { top: 0.05, bottom: 0.08, left: 0.05, right: 0.05 },
    fontScale: 1.0,
    markDensityScale: 1.0,
  },

  "instagram-portrait": {
    name: "instagram-portrait",
    ratio: "4:5",
    width: 1080,
    height: 1350,
    logoPosition: "bottom",
    safeZone: { top: 0.04, bottom: 0.06, left: 0.05, right: 0.05 },
    fontScale: 1.0,
    markDensityScale: 1.2, // Taller canvas = more marks
  },

  "stories": {
    name: "stories",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    logoPosition: "bottom",
    // Stories have UI overlays at top and bottom
    safeZone: { top: 0.12, bottom: 0.15, left: 0.05, right: 0.05 },
    fontScale: 1.1, // Slightly larger for vertical viewing
    markDensityScale: 1.5, // Much taller
  },

  "twitter": {
    name: "twitter",
    ratio: "16:9",
    width: 1200,
    height: 675,
    logoPosition: "bottom",
    safeZone: { top: 0.05, bottom: 0.08, left: 0.05, right: 0.05 },
    fontScale: 0.9, // Slightly smaller for wide format
    markDensityScale: 0.7, // Less tall
  },

  "linkedin": {
    name: "linkedin",
    ratio: "1.91:1",
    width: 1200,
    height: 628,
    logoPosition: "top", // LinkedIn often has logo top
    safeZone: { top: 0.08, bottom: 0.05, left: 0.05, right: 0.05 },
    fontScale: 0.85, // Professional, not too large
    markDensityScale: 0.65, // Short and wide
  },
};

// Platform groupings for batch generation
export const ALL_PLATFORMS: Platform[] = [
  "instagram-feed",
  "instagram-portrait",
  "stories",
  "twitter",
  "linkedin",
];

export const SOCIAL_PRIORITY: Platform[] = [
  "instagram-feed",  // Most common
  "stories",         // High engagement
  "twitter",         // Quick shares
];

/**
 * Get platform spec by name
 */
export function getPlatform(name: Platform): PlatformSpec {
  return PLATFORMS[name];
}

/**
 * Get platform spec by ratio
 */
export function getPlatformByRatio(ratio: PlatformRatio): PlatformSpec | undefined {
  return Object.values(PLATFORMS).find(p => p.ratio === ratio);
}

/**
 * Get all platform specs
 */
export function getAllPlatforms(): PlatformSpec[] {
  return ALL_PLATFORMS.map(name => PLATFORMS[name]);
}

/**
 * Calculate typography bounds respecting safe zones
 */
export function getTextBounds(spec: PlatformSpec): {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
} {
  const { safeZone, width, height } = spec;

  return {
    top: safeZone.top,
    bottom: 1 - safeZone.bottom,
    left: safeZone.left,
    right: 1 - safeZone.right,
    width: width * (1 - safeZone.left - safeZone.right),
    height: height * (1 - safeZone.top - safeZone.bottom),
  };
}

/**
 * Get logo position in pixels
 */
export function getLogoPosition(spec: PlatformSpec): { x: number; y: number } {
  const { width, height, logoPosition, safeZone } = spec;

  if (logoPosition === "top") {
    return {
      x: width - safeZone.right * width - 40, // Right-aligned with padding
      y: safeZone.top * height + 20,
    };
  }

  // Bottom position
  return {
    x: width - safeZone.right * width - 40,
    y: height - safeZone.bottom * height - 20,
  };
}

/**
 * Adapt font size for platform
 */
export function adaptFontSize(baseFontSize: number, spec: PlatformSpec): number {
  return Math.round(baseFontSize * spec.fontScale);
}

/**
 * Adapt mark count for platform
 */
export function adaptMarkCount(baseCount: number, spec: PlatformSpec): number {
  return Math.round(baseCount * spec.markDensityScale);
}
