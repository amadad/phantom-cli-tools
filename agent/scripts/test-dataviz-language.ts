/**
 * Data-Viz Graphic Language Exploration
 *
 * Replace typographic glyphs with D3-inspired visual elements:
 * - Dot matrices
 * - Flow lines
 * - Network nodes
 * - Radial arcs
 * - Scatter fields
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
const P = {
  primary: "#1E1B16",
  secondary: "#3D3929",
  accent: "#5046E5",
  background: "#FDFBF7",
  surface: "#F5F2ED",
  midtone: "#7A7265",
};

function loadFonts() {
  return [{
    name: "Alegreya",
    data: readFileSync(ALEGREYA_PATH),
    weight: 400 as const,
    style: "normal" as const,
  }];
}

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// ============================================================================
// VISUAL LANGUAGE GENERATORS
// ============================================================================

// 1. DOT MATRIX - grid of circles with varying opacity/size
function generateDotMatrix(seed: number, dark: boolean) {
  const random = seededRandom(seed);
  const dots: any[] = [];
  const cols = 20;
  const rows = 20;
  const spacing = 40;
  const startX = 100;
  const startY = 100;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (random() > 0.6) continue; // Skip some dots

      const size = 3 + random() * 8;
      const opacity = 0.1 + random() * 0.4;

      dots.push({
        type: "div",
        props: {
          style: {
            position: "absolute",
            left: startX + c * spacing,
            top: startY + r * spacing,
            width: size,
            height: size,
            borderRadius: "50%",
            backgroundColor: dark ? P.accent : P.accent,
            opacity,
          },
        },
      });
    }
  }
  return dots;
}

// 2. FLOW LINES - horizontal lines with varying lengths (like a bar chart abstraction)
function generateFlowLines(seed: number, dark: boolean) {
  const random = seededRandom(seed);
  const lines: any[] = [];
  const count = 15;
  const startY = 150;
  const spacing = 50;

  for (let i = 0; i < count; i++) {
    const width = 100 + random() * 600;
    const height = 2 + random() * 4;
    const opacity = 0.15 + random() * 0.35;
    const offset = random() * 200;

    lines.push({
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: 80 + offset,
          top: startY + i * spacing,
          width,
          height,
          backgroundColor: dark ? P.accent : P.accent,
          opacity,
          borderRadius: height / 2,
        },
      },
    });
  }
  return lines;
}

// 3. SCATTER FIELD - organic scattered dots (like a scatter plot)
function generateScatterField(seed: number, dark: boolean) {
  const random = seededRandom(seed);
  const dots: any[] = [];
  const count = 80;

  for (let i = 0; i < count; i++) {
    const x = 80 + random() * 920;
    const y = 80 + random() * 920;
    const size = 4 + random() * 12;
    const opacity = 0.1 + random() * 0.3;
    const isAccent = random() > 0.7;

    dots.push({
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: isAccent ? P.accent : (dark ? P.midtone : P.secondary),
          opacity,
        },
      },
    });
  }
  return dots;
}

// 4. NETWORK NODES - connected dots suggesting relationships
function generateNetwork(seed: number, dark: boolean) {
  const random = seededRandom(seed);
  const elements: any[] = [];

  // Generate node positions
  const nodes: { x: number; y: number }[] = [];
  for (let i = 0; i < 12; i++) {
    nodes.push({
      x: 150 + random() * 780,
      y: 150 + random() * 780,
    });
  }

  // Draw connections (as thin rectangles since Satori doesn't do SVG lines)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (random() > 0.3) continue;

      const n1 = nodes[i];
      const n2 = nodes[j];
      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;

      elements.push({
        type: "div",
        props: {
          style: {
            position: "absolute",
            left: n1.x,
            top: n1.y,
            width: length,
            height: 1,
            backgroundColor: dark ? P.accent : P.accent,
            opacity: 0.15,
            transform: `rotate(${angle}deg)`,
            transformOrigin: "0 0",
          },
        },
      });
    }
  }

  // Draw nodes
  for (const node of nodes) {
    const size = 8 + random() * 16;
    elements.push({
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: node.x - size / 2,
          top: node.y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: P.accent,
          opacity: 0.3 + random() * 0.4,
        },
      },
    });
  }

  return elements;
}

// 5. RADIAL ARCS - concentric partial circles
function generateRadialArcs(seed: number, dark: boolean) {
  const random = seededRandom(seed);
  const arcs: any[] = [];
  const centerX = 540;
  const centerY = 540;

  for (let i = 0; i < 8; i++) {
    const radius = 150 + i * 60;
    const thickness = 3 + random() * 8;
    const opacity = 0.1 + random() * 0.25;

    // Create arc using border (partial circle hack)
    arcs.push({
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: centerX - radius,
          top: centerY - radius,
          width: radius * 2,
          height: radius * 2,
          borderRadius: "50%",
          border: `${thickness}px solid ${P.accent}`,
          borderTopColor: "transparent",
          borderRightColor: random() > 0.5 ? "transparent" : P.accent,
          opacity,
          transform: `rotate(${random() * 360}deg)`,
        },
      },
    });
  }
  return arcs;
}

// 6. VERTICAL BARS - abstract bar chart
function generateVerticalBars(seed: number, dark: boolean) {
  const random = seededRandom(seed);
  const bars: any[] = [];
  const count = 25;
  const spacing = 35;
  const startX = 100;

  for (let i = 0; i < count; i++) {
    const height = 100 + random() * 500;
    const width = 4 + random() * 12;
    const opacity = 0.1 + random() * 0.3;
    const fromBottom = random() > 0.5;

    bars.push({
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: startX + i * spacing,
          top: fromBottom ? 1080 - 100 - height : 100,
          width,
          height,
          backgroundColor: P.accent,
          opacity,
          borderRadius: width / 2,
        },
      },
    });
  }
  return bars;
}

// ============================================================================
// LAYOUT BUILDER
// ============================================================================

const STYLES = [
  { name: "dot-matrix", generator: generateDotMatrix, hook: "1 in 5 caregivers\nreport high\nfinancial strain", dark: false },
  { name: "flow-lines", generator: generateFlowLines, hook: "The system\nisn't broken.\nIt was built\nthis way.", dark: true },
  { name: "scatter-field", generator: generateScatterField, hook: "Nobody told you\nthis would be\nthe hardest thing", dark: false },
  { name: "network", generator: generateNetwork, hook: "Care work\nis invisible\nuntil it\nbreaks.", dark: true },
  { name: "radial-arcs", generator: generateRadialArcs, hook: "You're not\nfailing.\nYou're surviving.", dark: false },
  { name: "vertical-bars", generator: generateVerticalBars, hook: "65 million\nAmericans\nprovide unpaid care", dark: true },
];

function buildLayout(style: typeof STYLES[0], index: number) {
  const { dark, hook, generator } = style;
  const bgColor = dark ? P.primary : P.background;
  const textColor = dark ? P.background : P.primary;

  const vizElements = generator(index * 1000 + 42, dark);
  const lines = hook.split("\n");

  const textElements = lines.map((line, i) => {
    const isEmphasis = line.length < 15 || i === lines.length - 1;
    return {
      type: "div",
      props: {
        style: {
          fontSize: isEmphasis ? 72 : 54,
          fontFamily: "Alegreya",
          color: isEmphasis ? P.accent : textColor,
          lineHeight: 1.1,
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
        padding: 80,
        position: "relative",
      },
      children: [
        // Viz layer
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
            children: vizElements,
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
    let logoPng = await sharp(logoSvg).resize({ width: logoWidth }).png().toBuffer();

    if (isDark) {
      logoPng = await sharp(logoPng)
        .negate({ alpha: false })
        .tint({ r: 253, g: 251, b: 247 })
        .png()
        .toBuffer();
    }

    const logoMeta = await sharp(logoPng).metadata();
    const logoHeight = logoMeta.height || 60;
    const logoTop = 1080 - margin - logoHeight;

    return sharp(image)
      .composite([{ input: logoPng, top: logoTop, left: margin }])
      .png()
      .toBuffer();
  } catch {
    return image;
  }
}

async function main() {
  const fonts = loadFonts();
  const outputDir = join(process.cwd(), "..", "output", "dataviz-language");

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.log("Generating Data-Viz Language explorations...\n");

  for (let i = 0; i < STYLES.length; i++) {
    const style = STYLES[i];
    const layout = buildLayout(style, i);

    const svg = await satori(layout, { width: 1080, height: 1080, fonts });
    let png = await sharp(Buffer.from(svg)).png().toBuffer();
    png = await addLogo(png, style.dark);

    const bgLabel = style.dark ? "dark" : "cream";
    const filename = `${i + 1}-${style.name}-${bgLabel}.png`;
    writeFileSync(join(outputDir, filename), png);

    console.log(`${i + 1}. ${style.name}`);
    console.log(`   "${style.hook.split("\n")[0]}..." | ${bgLabel}\n`);
  }

  console.log(`Saved to: ${outputDir}`);
}

main().catch(console.error);
