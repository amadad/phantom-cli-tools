/**
 * Renderer for DesignSpec
 * Interprets LLM design decisions within brand constraints
 */

import satori from "satori";
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";
import { DesignSpec, PRIMITIVES } from "./brand-system";

// Assets
const ALEGREYA_PATH = join(process.cwd(), "node_modules/@fontsource/alegreya/files/alegreya-latin-400-normal.woff");
const LOGO_PATH = join(process.cwd(), "..", "public", "gc-logo.svg");

// Load font
function loadFonts() {
  return [
    { name: "Alegreya", data: readFileSync(ALEGREYA_PATH), weight: 400 as const, style: "normal" as const },
  ];
}

// Map role to size (respecting scale bounds)
function getSize(role: string, sizing: string = "balanced"): number {
  const scale = PRIMITIVES.scale;
  const sizeMap = {
    display: scale.display,
    headline: scale.headline,
    body: scale.body,
    caption: scale.caption,
  };

  const range = sizeMap[role as keyof typeof sizeMap] || scale.body;

  // Sizing modifier
  if (sizing === "impact") return range.max;
  if (sizing === "intimate") return range.min;
  return Math.round((range.min + range.max) / 2);
}

// Build Satori layout from spec
function buildFromSpec(spec: DesignSpec) {
  const { texts, logo, vertical, sizing = "balanced", ratio } = spec;
  const { colors } = PRIMITIVES;

  // Build text elements
  const textElements = texts.map((t, i) => ({
    type: "p",
    props: {
      style: {
        fontSize: getSize(t.role, sizing),
        fontFamily: "Alegreya",
        color: colors.brown,
        lineHeight: t.role === "display" ? 1.1 : 1.3,
        margin: 0,
        textAlign: t.align || "center",
      },
      children: t.content,
    },
  }));

  // Logo placeholder
  const logoEl = logo !== "none" ? {
    type: "div",
    props: { style: { height: 80 } },
  } : null;

  // Arrange vertically
  let children: any[];
  let justifyContent: string;

  if (vertical === "spread") {
    justifyContent = "space-between";
    children = logo === "top"
      ? [logoEl, ...textElements].filter(Boolean)
      : [...textElements, logoEl].filter(Boolean);
  } else {
    justifyContent = "space-between";

    // Text cluster wrapper
    const textCluster = {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          flex: vertical === "center" ? 1 : undefined,
          justifyContent: "center",
        },
        children: textElements,
      },
    };

    if (logo === "top") {
      children = [logoEl, textCluster, { type: "div", props: { style: { height: 40 } } }].filter(Boolean);
    } else if (logo === "bottom") {
      children = [{ type: "div", props: { style: { height: 40 } } }, textCluster, logoEl].filter(Boolean);
    } else {
      children = [textCluster];
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
        justifyContent,
        backgroundColor: colors.cream,
        padding: "80px 60px",
      },
      children,
    },
  };
}

/**
 * Render a DesignSpec to PNG
 */
export async function render(spec: DesignSpec): Promise<Buffer> {
  const dims = PRIMITIVES.ratios[spec.ratio];
  const { width, height } = dims;

  const fonts = loadFonts();
  const layout = buildFromSpec(spec);

  // Render with Satori
  const svg = await satori(layout, { width, height, fonts });
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  // Composite logo if needed
  if (spec.logo === "none") {
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
  const logoTop = spec.logo === "top"
    ? logoMargin
    : height - logoMargin - logoHeight;

  return sharp(pngBuffer)
    .composite([{ input: logoPng, top: logoTop, left: logoLeft }])
    .png()
    .toBuffer();
}

/**
 * Quick render from simple inputs (for testing)
 */
export async function quickRender(
  primary: string,
  options: {
    secondary?: string;
    type?: "question" | "stat" | "quote" | "statement";
    ratio?: keyof typeof PRIMITIVES.ratios;
  } = {}
): Promise<Buffer> {
  const { secondary, type = "statement", ratio = "1:1" } = options;

  // Auto-generate spec based on content type
  const spec: DesignSpec = {
    texts: [{ content: primary, role: type === "stat" ? "display" : "headline", align: "center" }],
    logo: type === "quote" ? "bottom" : "top",
    vertical: "center",
    sizing: type === "stat" ? "impact" : "balanced",
    ratio,
  };

  if (secondary) {
    spec.texts.push({
      content: secondary,
      role: "caption",
      align: "center",
    });
  }

  return render(spec);
}
