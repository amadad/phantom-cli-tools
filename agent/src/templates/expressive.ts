/**
 * Expressive Layout System
 * More presence, more style, less safe
 * Unity through constraints, variety through boldness
 */

import satori from "satori";
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";

const ALEGREYA_PATH = join(process.cwd(), "node_modules/@fontsource/alegreya/files/alegreya-latin-400-normal.woff");
const LOGO_PATH = join(process.cwd(), "..", "public", "gc-logo.svg");

const COLORS = {
  cream: "#F5EDE4",
  brown: "#54340E",
};

// Expressive scale - much more contrast
const SCALE = {
  massive: 120,
  large: 64,
  medium: 44,
  small: 28,
  tiny: 20,
};

const RATIOS = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "16:9": { width: 1200, height: 675 },
  "9:16": { width: 1080, height: 1920 },
} as const;

type Ratio = keyof typeof RATIOS;

export interface ExpressiveSpec {
  texts: Array<{
    content: string;
    size: "massive" | "large" | "medium" | "small" | "tiny";
    align?: "left" | "center" | "right";
  }>;

  logo: {
    position: "top" | "bottom";
    align?: "left" | "center" | "right";
  } | "none";

  layout: "top" | "center" | "bottom" | "spread";
  ratio: Ratio;
  tension?: "tight" | "breathe" | "extreme";
}

function loadFonts() {
  return [
    { name: "Alegreya", data: readFileSync(ALEGREYA_PATH), weight: 400 as const, style: "normal" as const },
  ];
}

function buildExpressiveLayout(spec: ExpressiveSpec) {
  const { texts, logo, layout, tension = "breathe" } = spec;

  const padding = tension === "tight" ? 40 : tension === "extreme" ? 100 : 60;
  const gap = tension === "tight" ? 16 : tension === "extreme" ? 40 : 24;

  // Build text elements
  const textElements = texts.map((t) => ({
    type: "p",
    props: {
      style: {
        fontSize: SCALE[t.size],
        fontFamily: "Alegreya",
        color: COLORS.brown,
        lineHeight: SCALE[t.size] > 80 ? 1.0 : 1.25,
        margin: 0,
        textAlign: t.align || "center",
        width: "100%",
      },
      children: t.content,
    },
  }));

  // Logo placeholder
  const logoHeight = 80;
  const logoPlaceholder = logo !== "none" ? {
    type: "div",
    props: {
      style: {
        display: "flex",
        width: "100%",
        height: logoHeight,
        justifyContent: logo.align === "left" ? "flex-start" : logo.align === "right" ? "flex-end" : "center",
      },
    },
  } : null;

  // Text container
  const textContainer = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        gap,
        alignItems: "stretch",
      },
      children: textElements,
    },
  };

  // Arrange based on layout
  let justifyContent: string;
  let children: any[];

  if (layout === "top") {
    justifyContent = "flex-start";
    children = logo !== "none" && logo.position === "top"
      ? [logoPlaceholder, textContainer]
      : [textContainer, { type: "div", props: { style: { flex: 1 } } }, logoPlaceholder].filter(Boolean);
  } else if (layout === "bottom") {
    justifyContent = "flex-end";
    children = logo !== "none" && logo.position === "top"
      ? [logoPlaceholder, { type: "div", props: { style: { flex: 1 } } }, textContainer]
      : [textContainer, logoPlaceholder].filter(Boolean);
  } else if (layout === "spread") {
    justifyContent = "space-between";
    children = logo !== "none" && logo.position === "top"
      ? [logoPlaceholder, ...textElements.map((el, i) =>
          i < textElements.length - 1
            ? { type: "div", props: { style: { display: "flex", flexDirection: "column" }, children: [el] } }
            : { type: "div", props: { style: { display: "flex", flexDirection: "column" }, children: [el] } }
        ), logoPlaceholder === null ? null : { type: "div", props: { style: { height: logoHeight } } }].filter(Boolean)
      : [...textElements.map(el => ({ type: "div", props: { style: { display: "flex", flexDirection: "column", width: "100%" }, children: [el] } })), logoPlaceholder].filter(Boolean);
  } else {
    // center
    justifyContent = "center";
    children = logo !== "none" && logo.position === "top"
      ? [logoPlaceholder, { type: "div", props: { style: { flex: 1 } } }, textContainer, { type: "div", props: { style: { flex: 1 } } }, logo.position === "bottom" ? null : { type: "div", props: { style: { height: logoHeight } } }].filter(Boolean)
      : [{ type: "div", props: { style: { height: logoHeight } } }, { type: "div", props: { style: { flex: 1 } } }, textContainer, { type: "div", props: { style: { flex: 1 } } }, logoPlaceholder].filter(Boolean);
  }

  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLORS.cream,
        padding,
        justifyContent: layout === "spread" ? "space-between" : justifyContent,
      },
      children,
    },
  };
}

export async function renderExpressive(spec: ExpressiveSpec): Promise<Buffer> {
  const { width, height } = RATIOS[spec.ratio];
  const fonts = loadFonts();
  const layout = buildExpressiveLayout(spec);

  const svg = await satori(layout, { width, height, fonts });
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  if (spec.logo === "none") return pngBuffer;

  const logoSvg = readFileSync(LOGO_PATH);
  const logoWidth = 160;
  const margin = spec.tension === "tight" ? 40 : spec.tension === "extreme" ? 100 : 60;

  const logoPng = await sharp(logoSvg)
    .resize({ width: logoWidth })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoPng).metadata();
  const logoHeight = logoMeta.height || 80;

  let logoLeft: number;
  if (spec.logo.align === "left") logoLeft = margin;
  else if (spec.logo.align === "right") logoLeft = width - margin - logoWidth;
  else logoLeft = Math.round((width - logoWidth) / 2);

  const logoTop = spec.logo.position === "top" ? margin : height - margin - logoHeight;

  return sharp(pngBuffer)
    .composite([{ input: logoPng, top: logoTop, left: logoLeft }])
    .png()
    .toBuffer();
}

/**
 * Bold examples - more presence
 */
export const BOLD_EXAMPLES: Array<{ name: string; spec: ExpressiveSpec }> = [
  {
    name: "massive-stat",
    spec: {
      texts: [
        { content: "53M", size: "massive", align: "left" },
        { content: "unpaid caregivers in America", size: "small", align: "left" },
      ],
      logo: { position: "bottom", align: "right" },
      layout: "center",
      ratio: "1:1",
      tension: "extreme",
    },
  },
  {
    name: "off-center-question",
    spec: {
      texts: [
        { content: "When did you last", size: "medium", align: "left" },
        { content: "rest?", size: "massive", align: "left" },
      ],
      logo: { position: "top", align: "left" },
      layout: "center",
      ratio: "4:5",
      tension: "breathe",
    },
  },
  {
    name: "tight-quote",
    spec: {
      texts: [
        { content: '"I forgot what it feels like to not be tired."', size: "large", align: "center" },
        { content: "— Maria, 47", size: "tiny", align: "right" },
      ],
      logo: { position: "bottom", align: "center" },
      layout: "center",
      ratio: "1:1",
      tension: "tight",
    },
  },
  {
    name: "dramatic-reframe",
    spec: {
      texts: [
        { content: "Guilt", size: "massive", align: "right" },
        { content: "is not a job requirement.", size: "medium", align: "right" },
      ],
      logo: { position: "bottom", align: "left" },
      layout: "center",
      ratio: "1:1",
      tension: "extreme",
    },
  },
  {
    name: "stark-single",
    spec: {
      texts: [
        { content: "You matter too.", size: "large", align: "center" },
      ],
      logo: { position: "bottom", align: "center" },
      layout: "center",
      ratio: "16:9",
      tension: "extreme",
    },
  },
  {
    name: "stacked-story",
    spec: {
      texts: [
        { content: "24", size: "massive", align: "center" },
        { content: "hours a week", size: "medium", align: "center" },
        { content: "That's a part-time job. Unpaid.", size: "small", align: "center" },
      ],
      logo: { position: "bottom", align: "center" },
      layout: "spread",
      ratio: "9:16",
      tension: "breathe",
    },
  },
  {
    name: "corner-whisper",
    spec: {
      texts: [
        { content: "It's okay to ask for help.", size: "medium", align: "left" },
      ],
      logo: { position: "top", align: "right" },
      layout: "bottom",
      ratio: "1:1",
      tension: "extreme",
    },
  },
  {
    name: "asymmetric-break",
    spec: {
      texts: [
        { content: "Burnout", size: "massive", align: "left" },
        { content: "is not a strategy.", size: "medium", align: "right" },
      ],
      logo: { position: "bottom", align: "center" },
      layout: "spread",
      ratio: "1:1",
      tension: "extreme",
    },
  },
];
