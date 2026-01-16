/**
 * Test: Electric Cream palette - expressive hook
 *
 * Showcase the new palette with bold typography and marks
 * Uses actual SVG logo and varies background (cream vs dark)
 */

import satori from "satori";
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const ALEGREYA_PATH = join(
  process.cwd(),
  "node_modules/@fontsource/alegreya/files/alegreya-latin-400-normal.woff"
);
const LOGO_PATH = join(process.cwd(), "..", "public", "gc-logo.svg");

// Electric Cream palette
const PALETTE = {
  primary: "#1E1B16",      // Deep warm (text)
  secondary: "#3D3929",    // Warm olive-brown
  accent: "#5046E5",       // Electric indigo
  background: "#FDFBF7",   // Cream white
  surface: "#F5F2ED",      // Warm off-white
  midtone: "#7A7265",      // Warm gray
  muted: "#8A857B",        // WCAG AA muted
};

// Expressive hooks - vary backgrounds
const HOOKS = [
  {
    text: "Nobody told you\nthis would be\nthe hardest thing\nyou've ever done",
    style: "stacked",
    dark: false,  // cream background
  },
  {
    text: "The system\nisn't broken.\nIt was built\nthis way.",
    style: "offset",
    dark: true,   // dark background
  },
  {
    text: "You're not\nfailing.\nYou're surviving\nsomething\nimpossible.",
    style: "cascade",
    dark: false,
  },
  {
    text: "Care work\nis invisible\nuntil it\nbreaks.",
    style: "stacked",
    dark: true,
  },
];

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

// Typographic marks in Electric Cream style
const MARKS = ["·", "—", "†", "‡", "§", "¶", "※", "∴", "∵", "◊", "○", "●"];

function generateMarks(count: number, seed: number) {
  const random = seededRandom(seed);
  const marks: { row: number; col: number; glyph: string; opacity: number }[] = [];

  for (let i = 0; i < count; i++) {
    marks.push({
      row: Math.floor(random() * 12),
      col: Math.floor(random() * 12),
      glyph: MARKS[Math.floor(random() * MARKS.length)],
      opacity: 0.15 + random() * 0.25,
    });
  }
  return marks;
}

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function buildLayout(hook: typeof HOOKS[0], index: number) {
  const width = 1080;
  const height = 1080;
  const margin = 80;

  const lines = hook.text.split("\n");
  const marks = generateMarks(50, index * 1000);

  // Colors based on background mode
  const isDark = hook.dark;
  const bgColor = isDark ? PALETTE.primary : PALETTE.background;
  const textColor = isDark ? PALETTE.background : PALETTE.primary;
  const accentColor = PALETTE.accent;
  const markColor = isDark ? PALETTE.accent : PALETTE.accent;

  // Build mark elements
  const cellW = (width - margin * 2) / 12;
  const cellH = (height - margin * 2) / 12;

  const markElements = marks.map((m) => ({
    type: "span",
    props: {
      style: {
        position: "absolute",
        left: margin + m.col * cellW,
        top: margin + m.row * cellH,
        fontSize: 28,
        fontFamily: "Alegreya",
        color: markColor,
        opacity: isDark ? m.opacity * 0.8 : m.opacity,
      },
      children: m.glyph,
    },
  }));

  // Build text with varying styles
  const textElements = lines.map((line, i) => {
    const isEmphasis = i === lines.length - 2 || line.length < 12;

    return {
      type: "div",
      props: {
        style: {
          fontSize: isEmphasis ? 76 : 58,
          fontFamily: "Alegreya",
          color: isEmphasis ? accentColor : textColor,
          lineHeight: 1.05,
          marginLeft: hook.style === "offset" ? (i % 2 === 0 ? 0 : 60) : 0,
          marginTop: i === 0 ? 0 : -4,
        },
        children: line,
      },
    };
  });

  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        backgroundColor: bgColor,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: margin,
        position: "relative",
      },
      children: [
        // Marks layer
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
            },
            children: markElements,
          },
        },
        // Text layer
        ...textElements,
      ],
    },
  };
}

async function addLogo(image: Buffer, isDark: boolean): Promise<Buffer> {
  const margin = 60;
  const logoWidth = 140;

  try {
    const logoSvg = readFileSync(LOGO_PATH);

    // For dark backgrounds, we need to invert/recolor the logo
    // Load and resize logo
    let logoPng = await sharp(logoSvg).resize({ width: logoWidth }).png().toBuffer();

    // If dark mode, tint the logo to cream color
    if (isDark) {
      logoPng = await sharp(logoPng)
        .negate({ alpha: false })
        .tint({ r: 253, g: 251, b: 247 })  // Cream tint
        .png()
        .toBuffer();
    }

    const logoMeta = await sharp(logoPng).metadata();
    const logoHeight = logoMeta.height || 60;

    // Position at bottom-left
    const logoLeft = margin;
    const logoTop = 1080 - margin - logoHeight;

    return sharp(image)
      .composite([{ input: logoPng, top: logoTop, left: logoLeft }])
      .png()
      .toBuffer();
  } catch (err) {
    console.log("Logo not found, skipping:", err);
    return image;
  }
}

async function main() {
  const fonts = loadFonts();
  const outputDir = join(process.cwd(), "..", "output", "electric-cream");

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.log("Generating Electric Cream hooks...\n");
  console.log("Palette:");
  console.log(`  Primary:    ${PALETTE.primary} (deep warm)`);
  console.log(`  Accent:     ${PALETTE.accent} (electric indigo)`);
  console.log(`  Background: ${PALETTE.background} (cream)\n`);

  for (let i = 0; i < HOOKS.length; i++) {
    const hook = HOOKS[i];
    const layout = buildLayout(hook, i);

    const svg = await satori(layout, { width: 1080, height: 1080, fonts });
    let png = await sharp(Buffer.from(svg)).png().toBuffer();

    // Add logo
    png = await addLogo(png, hook.dark);

    const bgLabel = hook.dark ? "dark" : "cream";
    const filename = `hook-${i + 1}-${hook.style}-${bgLabel}.png`;
    writeFileSync(join(outputDir, filename), png);

    console.log(`${i + 1}. "${hook.text.split("\n")[0]}..."`);
    console.log(`   Style: ${hook.style} | Bg: ${bgLabel} → ${filename}\n`);
  }

  console.log(`Saved to: ${outputDir}`);
}

main().catch(console.error);
