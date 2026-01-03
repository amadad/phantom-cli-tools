/**
 * Autonomous Content Generation API
 *
 * Single entry point: text → all platform images
 *
 * Usage:
 *   const images = await generate("Do you want me to tell you about my mom?");
 *   // Returns 5 images for all platforms
 *
 *   const single = await generateSingle("...", "instagram-feed");
 *   // Returns 1 image for specific platform
 */

import { analyze, type Analysis } from "./analyze";
import { computeTypography, type TypographySpec, type TypographyLine } from "./typography";
import { generateMarks, type MarkPosition, type ExclusionZone } from "./marks";
import {
  getAllPlatforms,
  getPlatform,
  adaptFontSize,
  type Platform,
  type PlatformSpec,
} from "./platform";

import satori from "satori";
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";

// Paths
const ALEGREYA_PATH = join(
  process.cwd(),
  "node_modules/@fontsource/alegreya/files/alegreya-latin-400-normal.woff"
);
const LOGO_PATH = join(process.cwd(), "..", "public", "gc-logo.svg");

// Colors (from GiveCare brand)
const COLORS = {
  cream: { r: 245, g: 237, b: 228 },
  brown: "#54340E",
};

// Load fonts once
function loadFonts() {
  return [
    {
      name: "Alegreya",
      data: readFileSync(ALEGREYA_PATH),
      weight: 400 as const,
      style: "normal" as const,
    },
  ];
}

/**
 * Generated image output
 */
export interface GeneratedImage {
  platform: Platform;
  buffer: Buffer;
  analysis: Analysis;
  width: number;
  height: number;
}

/**
 * Generate images for all platforms from text
 */
export async function generate(text: string): Promise<GeneratedImage[]> {
  const platforms = getAllPlatforms();
  const analysis = analyze(text);

  const results = await Promise.all(
    platforms.map((platform) => generateForPlatform(text, analysis, platform))
  );

  return results;
}

/**
 * Generate image for a single platform
 */
export async function generateSingle(
  text: string,
  platform: Platform
): Promise<GeneratedImage> {
  const spec = getPlatform(platform);
  const analysis = analyze(text);
  return generateForPlatform(text, analysis, spec);
}

/**
 * Core generation for a specific platform
 */
async function generateForPlatform(
  text: string,
  analysis: Analysis,
  spec: PlatformSpec
): Promise<GeneratedImage> {
  const { width, height, logoPosition } = spec;
  const fonts = loadFonts();

  // Compute typography for this platform size
  const typography = computeTypography(analysis, width);

  // Build exclusion zones for marks
  const exclusionZones: ExclusionZone[] = [];

  // Logo clearspace zone (very generous - account for glyph sizes)
  const logoWidth = 160;
  const logoHeight = 80;
  const logoClearspace = 80; // Large buffer for glyph overflow
  const margin = 60;

  if (logoPosition === "bottom") {
    // Logo at bottom-left with clearspace
    // Exclude first 3 columns and bottom 2 rows
    exclusionZones.push({
      left: 0,
      right: (margin + logoWidth + logoClearspace * 2) / width, // ~0.33
      top: (height - margin - logoHeight - logoClearspace * 2) / height,
      bottom: 1,
    });
  } else {
    // Logo at top-left with clearspace
    // Exclude first 3 columns and top 2 rows
    exclusionZones.push({
      left: 0,
      right: (margin + logoWidth + logoClearspace * 2) / width,
      top: 0,
      bottom: (margin + logoHeight + logoClearspace * 2) / height,
    });
  }

  // Generate marks that avoid exclusion zones
  const marks = generateMarks(analysis, exclusionZones, width, height);

  // Build layers
  const layers: Array<{ input: Buffer; top: number; left: number }> = [];

  // Layer 1: Marks (behind text)
  const marksLayout = buildMarksLayout(marks, width, height, spec);
  if (marksLayout) {
    const marksSvg = await satori(marksLayout, { width, height, fonts });
    const marksPng = await sharp(Buffer.from(marksSvg)).png().toBuffer();
    layers.push({ input: marksPng, top: 0, left: 0 });
  }

  // Layer 2: Typography (on top)
  const textLayout = buildTextLayout(typography, spec);
  const textSvg = await satori(textLayout, { width, height, fonts });
  const textPng = await sharp(Buffer.from(textSvg)).png().toBuffer();
  layers.push({ input: textPng, top: 0, left: 0 });

  // Composite on cream background
  let result = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { ...COLORS.cream, alpha: 1 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();

  // Add logo
  result = await addLogo(result, spec);

  return {
    platform: spec.name,
    buffer: result,
    analysis,
    width,
    height,
  };
}

/**
 * Build Satori layout for marks
 */
function buildMarksLayout(
  marks: MarkPosition[],
  width: number,
  height: number,
  spec: PlatformSpec
): any | null {
  if (marks.length === 0) return null;

  const margin = 60;
  const cellW = (width - margin * 2) / 12;
  const cellH = (height - margin * 2) / 12;

  const elements = marks.map((mark) => ({
    type: "span",
    props: {
      style: {
        position: "absolute",
        left: margin + mark.col * cellW,
        top: margin + mark.row * cellH,
        fontSize: 24 * mark.scale,
        fontFamily: "Alegreya",
        color: COLORS.brown,
        opacity: mark.opacity,
      },
      children: mark.glyph,
    },
  }));

  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        backgroundColor: "transparent",
      },
      children: elements,
    },
  };
}

/**
 * Build Satori layout for typography
 */
function buildTextLayout(typography: TypographySpec, spec: PlatformSpec): any {
  const { width, height } = spec;
  const margin = 60;

  // Vertical positioning
  const elements: any[] = [];

  // Add top spacer for vertical positioning
  if (typography.vertical === "center" || typography.vertical === "bottom") {
    elements.push({
      type: "div",
      props: { style: { flex: typography.vertical === "center" ? 1 : 2 } },
    });
  }

  // Text lines
  for (const line of typography.lines) {
    const fontSize = adaptFontSize(line.fontSize, spec);

    elements.push({
      type: "div",
      props: {
        style: {
          display: "flex",
          width: "100%",
          justifyContent: "flex-start",
        },
        children: {
          type: "p",
          props: {
            style: {
              fontSize,
              fontFamily: "Alegreya",
              fontWeight: line.fontWeight,
              color: COLORS.brown,
              opacity: line.opacity,
              lineHeight: fontSize > 80 ? 0.95 : 1.2,
              letterSpacing: line.letterSpacing,
              margin: 0,
            },
            children: line.text,
          },
        },
      },
    });
  }

  // Add bottom spacer
  if (typography.vertical === "center" || typography.vertical === "top") {
    elements.push({
      type: "div",
      props: { style: { flex: 1 } },
    });
  }

  // Logo spacer at bottom
  elements.push({
    type: "div",
    props: { style: { height: 100 } },
  });

  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "transparent",
        padding: margin,
      },
      children: elements,
    },
  };
}

/**
 * Add logo to image
 */
async function addLogo(image: Buffer, spec: PlatformSpec): Promise<Buffer> {
  const { width, height, logoPosition } = spec;
  const margin = 60;

  try {
    const logoSvg = readFileSync(LOGO_PATH);
    const logoWidth = 160;

    const logoPng = await sharp(logoSvg).resize({ width: logoWidth }).png().toBuffer();
    const logoMeta = await sharp(logoPng).metadata();
    const logoHeight = logoMeta.height || 80;

    const logoLeft = margin;
    const logoTop =
      logoPosition === "top" ? margin : height - margin - logoHeight;

    return sharp(image)
      .composite([{ input: logoPng, top: logoTop, left: logoLeft }])
      .png()
      .toBuffer();
  } catch {
    // Logo not found, return without
    return image;
  }
}

/**
 * Convenience: Generate and return as object with platform names as keys
 */
export async function generateAll(
  text: string
): Promise<Record<Platform, Buffer>> {
  const images = await generate(text);
  return Object.fromEntries(images.map((img) => [img.platform, img.buffer])) as Record<
    Platform,
    Buffer
  >;
}
