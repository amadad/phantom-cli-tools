/**
 * Satori-based typography templates for GiveCare
 * Uses exact brand fonts: Alegreya (serif), Gabarito (display)
 * Object syntax (no JSX/React required)
 */

import satori from "satori";
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";

// Font paths - using @fontsource packages (valid .woff files)
const ALEGREYA_PATH = join(process.cwd(), "node_modules/@fontsource/alegreya/files/alegreya-latin-400-normal.woff");
const GABARITO_PATH = join(process.cwd(), "node_modules/@fontsource/gabarito/files/gabarito-latin-500-normal.woff");
const LOGO_PATH = join(process.cwd(), "..", "public", "gc-logo.svg");

// Brand colors
export const COLORS = {
  cream: "#F5EDE4",
  brown: "#54340E",
  orange: "#FF9F1C",
};

// Typography constraints
const TYPOGRAPHY = {
  // Minimum point sizes for readability
  minHeadline: 40,
  minTagline: 20,
  // Headline:tagline ratio (2:1)
  ratio: 2,
};

// Template variants
export type LogoPosition = "top" | "bottom";
export type TemplateType = "typography" | "quote" | "stat" | "cta";  // extensible

// Aspect ratio configs by platform
export const ASPECT_RATIOS = {
  // Square - Instagram feed, Facebook feed
  "1:1": { width: 1080, height: 1080 },
  // Portrait - Instagram feed (mobile-optimized), LinkedIn mobile
  "4:5": { width: 1080, height: 1350 },
  // Landscape - Twitter/X
  "16:9": { width: 1200, height: 675 },
  // LinkedIn landscape (link preview, sponsored)
  "1.91:1": { width: 1200, height: 628 },
  // Vertical - YouTube Shorts, Stories, Reels, TikTok
  "9:16": { width: 1080, height: 1920 },
} as const;

// Platform to aspect ratio mapping
export const PLATFORM_RATIOS = {
  instagram_feed: "1:1" as const,
  instagram_story: "9:16" as const,
  instagram_reel: "9:16" as const,
  facebook_feed: "1:1" as const,
  facebook_story: "9:16" as const,
  twitter: "16:9" as const,
  linkedin: "1.91:1" as const,
  linkedin_mobile: "4:5" as const,
  youtube_short: "9:16" as const,
  tiktok: "9:16" as const,
};

export type AspectRatio = keyof typeof ASPECT_RATIOS;

// Load fonts from @fontsource packages
function loadFonts() {
  const alegreya = readFileSync(ALEGREYA_PATH);
  const gabarito = readFileSync(GABARITO_PATH);

  return [
    { name: "Alegreya", data: alegreya, weight: 400 as const, style: "normal" as const },
    { name: "Gabarito", data: gabarito, weight: 500 as const, style: "normal" as const },
  ];
}

// Calculate typography sizes with 2:1 ratio and minimum constraints
function calculateTypography(aspectRatio: AspectRatio): {
  headlineSize: number;
  taglineSize: number;
  logoHeight: number;
  padding: string;
} {
  // Base headline size by aspect ratio
  let baseHeadline: number;
  let logoHeight: number;
  let padding: string;

  if (aspectRatio === "9:16") {
    baseHeadline = 72;
    logoHeight = 100;
    padding = "100px 60px 80px 60px";
  } else if (aspectRatio === "4:5") {
    baseHeadline = 64;
    logoHeight = 90;
    padding = "80px 60px 60px 60px";
  } else if (aspectRatio === "16:9") {
    baseHeadline = 56;
    logoHeight = 70;
    padding = "60px 80px 50px 80px";
  } else if (aspectRatio === "1.91:1") {
    baseHeadline = 52;
    logoHeight = 65;
    padding = "55px 80px 45px 80px";
  } else {
    // 1:1
    baseHeadline = 64;
    logoHeight = 80;
    padding = "100px 60px 80px 60px";
  }

  // Enforce minimum sizes
  const headlineSize = Math.max(baseHeadline, TYPOGRAPHY.minHeadline);
  // Apply 2:1 ratio, enforce minimum
  const taglineSize = Math.max(headlineSize / TYPOGRAPHY.ratio, TYPOGRAPHY.minTagline);

  return { headlineSize, taglineSize, logoHeight, padding };
}

// Build typography layout as Satori object (no JSX)
function buildTypographyLayout(
  headline: string,
  tagline: string | undefined,
  aspectRatio: AspectRatio,
  logoPosition: LogoPosition = "top"
) {
  const { headlineSize, taglineSize, logoHeight, padding } = calculateTypography(aspectRatio);

  // Reusable elements
  const logoPlaceholder = {
    type: "div",
    props: {
      style: { height: logoHeight },
    },
  };

  const headlineElement = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        textAlign: "center",
        padding: "0 20px",
      },
      children: {
        type: "p",
        props: {
          style: {
            fontSize: headlineSize,
            fontFamily: "Alegreya",
            color: COLORS.brown,
            lineHeight: 1.3,
            margin: 0,
            textAlign: "center",
          },
          children: headline,
        },
      },
    },
  };

  const taglineElement = tagline ? {
    type: "p",
    props: {
      style: {
        fontSize: taglineSize,
        fontFamily: "Alegreya",
        color: COLORS.brown,
        margin: 0,
      },
      children: tagline,
    },
  } : null;

  // Arrange elements based on logo position
  const children: any[] = logoPosition === "top"
    ? [logoPlaceholder, headlineElement, taglineElement].filter(Boolean)
    : [taglineElement, headlineElement, logoPlaceholder].filter(Boolean);

  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: COLORS.cream,
        padding,
      },
      children,
    },
  };
}

// Logo config by aspect ratio
function getLogoConfig(aspectRatio: AspectRatio, logoPosition: LogoPosition, height: number): {
  width: number;
  top: number;
} {
  let logoWidth: number;
  let logoMargin: number;  // distance from edge

  if (aspectRatio === "9:16") {
    logoWidth = 200;
    logoMargin = 100;
  } else if (aspectRatio === "4:5") {
    logoWidth = 180;
    logoMargin = 80;
  } else if (aspectRatio === "16:9") {
    logoWidth = 160;
    logoMargin = 60;
  } else if (aspectRatio === "1.91:1") {
    logoWidth = 150;
    logoMargin = 55;
  } else {
    // 1:1
    logoWidth = 180;
    logoMargin = 100;
  }

  // Calculate top position based on logo position
  const logoHeight = Math.round(logoWidth * 0.5);  // approximate logo aspect ratio
  const top = logoPosition === "top"
    ? logoMargin
    : height - logoMargin - logoHeight;

  return { width: logoWidth, top };
}

/**
 * Generate typography image with exact fonts and logo
 */
export async function generateTypographyImage(
  headline: string,
  options: {
    tagline?: string;
    aspectRatio?: AspectRatio;
    logoPosition?: LogoPosition;
  } = {}
): Promise<Buffer> {
  const {
    tagline = "Wellness for caregivers.",
    aspectRatio = "1:1",
    logoPosition = "top"
  } = options;
  const { width, height } = ASPECT_RATIOS[aspectRatio];

  const fonts = loadFonts();
  const layout = buildTypographyLayout(headline, tagline, aspectRatio, logoPosition);

  // Generate SVG with Satori
  const svg = await satori(layout, { width, height, fonts });

  // Convert SVG to PNG
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  // Composite exact logo
  const logoSvg = readFileSync(LOGO_PATH);
  const logoConfig = getLogoConfig(aspectRatio, logoPosition, height);

  const logoPng = await sharp(logoSvg)
    .resize({ width: logoConfig.width })
    .png()
    .toBuffer();

  const logoLeft = Math.round((width - logoConfig.width) / 2);

  const finalBuffer = await sharp(pngBuffer)
    .composite([
      {
        input: logoPng,
        top: logoConfig.top,
        left: logoLeft,
      },
    ])
    .png()
    .toBuffer();

  return finalBuffer;
}
