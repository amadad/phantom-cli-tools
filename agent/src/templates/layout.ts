/**
 * Composable layout system for GiveCare
 * LLM selects from slots rather than rigid templates
 */

import satori from "satori";
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";

// Font paths
const ALEGREYA_PATH = join(process.cwd(), "node_modules/@fontsource/alegreya/files/alegreya-latin-400-normal.woff");
const GABARITO_PATH = join(process.cwd(), "node_modules/@fontsource/gabarito/files/gabarito-latin-500-normal.woff");
const LOGO_PATH = join(process.cwd(), "..", "public", "gc-logo.svg");

// Brand constants
export const COLORS = {
  cream: "#F5EDE4",
  brown: "#54340E",
  orange: "#FF9F1C",
};

// Typography: 2:1 ratio, enforced minimums
const TYPE = {
  large: 64,
  medium: 32,
  small: 24,
  min: 20,
};

// Aspect ratios
export const RATIOS = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "16:9": { width: 1200, height: 675 },
  "1.91:1": { width: 1200, height: 628 },
  "9:16": { width: 1080, height: 1920 },
} as const;

export type Ratio = keyof typeof RATIOS;

/**
 * Layout config - what the LLM specifies
 */
export interface LayoutConfig {
  // Logo placement
  logo: "top" | "bottom" | "none";

  // Primary text (required)
  primary: string;

  // Secondary text (optional)
  secondary?: string;

  // Which text gets emphasis (larger size)
  emphasis?: "primary" | "secondary";

  // Aspect ratio
  ratio?: Ratio;
}

// Load fonts once
function loadFonts() {
  return [
    { name: "Alegreya", data: readFileSync(ALEGREYA_PATH), weight: 400 as const, style: "normal" as const },
    { name: "Gabarito", data: readFileSync(GABARITO_PATH), weight: 500 as const, style: "normal" as const },
  ];
}

// Calculate sizes based on emphasis
function getSizes(emphasis: "primary" | "secondary", ratio: Ratio) {
  const { width, height } = RATIOS[ratio];
  const scale = Math.min(width, height) / 1080;  // normalize to 1080 base

  const large = Math.max(Math.round(TYPE.large * scale), TYPE.min * 2);
  const small = Math.max(Math.round(TYPE.small * scale), TYPE.min);

  return emphasis === "primary"
    ? { primarySize: large, secondarySize: small }
    : { primarySize: small, secondarySize: large };
}

// Build layout
function buildLayout(config: LayoutConfig) {
  const { logo, primary, secondary, emphasis = "primary", ratio = "1:1" } = config;
  const { primarySize, secondarySize } = getSizes(emphasis, ratio);
  const logoHeight = 80;

  // Build elements
  const logoEl = logo !== "none" ? {
    type: "div",
    props: { style: { height: logoHeight } },
  } : null;

  const primaryEl = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 40px",
      },
      children: {
        type: "p",
        props: {
          style: {
            fontSize: primarySize,
            fontFamily: "Alegreya",
            color: COLORS.brown,
            lineHeight: 1.3,
            margin: 0,
            textAlign: "center",
          },
          children: primary,
        },
      },
    },
  };

  const secondaryEl = secondary ? {
    type: "p",
    props: {
      style: {
        fontSize: secondarySize,
        fontFamily: "Alegreya",
        color: COLORS.brown,
        margin: 0,
        textAlign: "center",
      },
      children: secondary,
    },
  } : null;

  // Arrange based on logo position
  let children: any[];
  if (logo === "top") {
    children = [logoEl, primaryEl, secondaryEl].filter(Boolean);
  } else if (logo === "bottom") {
    children = [secondaryEl, primaryEl, logoEl].filter(Boolean);
  } else {
    children = [secondaryEl, primaryEl].filter(Boolean);
    // No logo - add spacing
    if (!secondary) {
      children = [primaryEl];
    }
  }

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
        padding: "80px 60px",
      },
      children,
    },
  };
}

/**
 * Generate image from layout config
 */
export async function generateLayout(config: LayoutConfig): Promise<Buffer> {
  const ratio = config.ratio || "1:1";
  const { width, height } = RATIOS[ratio];

  const fonts = loadFonts();
  const layout = buildLayout(config);

  // Render with Satori
  const svg = await satori(layout, { width, height, fonts });
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  // Composite logo if needed
  if (config.logo === "none") {
    return pngBuffer;
  }

  const logoSvg = readFileSync(LOGO_PATH);
  const logoWidth = 180;
  const logoMargin = 80;

  const logoPng = await sharp(logoSvg)
    .resize({ width: logoWidth })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoPng).metadata();
  const logoHeight = logoMeta.height || 90;

  const logoLeft = Math.round((width - logoWidth) / 2);
  const logoTop = config.logo === "top"
    ? logoMargin
    : height - logoMargin - logoHeight;

  return sharp(pngBuffer)
    .composite([{ input: logoPng, top: logoTop, left: logoLeft }])
    .png()
    .toBuffer();
}

/**
 * Example configs for LLM reference
 */
export const EXAMPLES: Record<string, LayoutConfig> = {
  // Standard headline post
  headline: {
    logo: "top",
    primary: "When did you last take 20 minutes for yourself?",
    secondary: "Wellness for caregivers.",
    emphasis: "primary",
  },

  // Quote/testimonial
  quote: {
    logo: "bottom",
    primary: '"Taking care of myself isn\'t selfish—it\'s survival."',
    secondary: "— Sarah, caregiver for 12 years",
    emphasis: "primary",
  },

  // Stat callout
  stat: {
    logo: "top",
    primary: "53 million",
    secondary: "Americans are unpaid caregivers",
    emphasis: "primary",
  },

  // Tagline focus
  tagline: {
    logo: "bottom",
    primary: "You can't pour from an empty cup.",
    emphasis: "primary",
  },

  // Inverted emphasis
  inverted: {
    logo: "top",
    primary: "Did you know?",
    secondary: "Caregivers are 2x more likely to experience depression",
    emphasis: "secondary",
  },
};
