/**
 * Data-Viz Graphic Language v2 - ORGANIC
 *
 * More organic, less geometric. Play with scale.
 * Drop radial arcs, add: contours, growth, clusters
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

const P = {
  primary: "#1E1B16",
  secondary: "#3D3929",
  accent: "#5046E5",
  background: "#FDFBF7",
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

// Gaussian-ish distribution for organic clustering
function gaussianRandom(random: () => number) {
  return (random() + random() + random()) / 3;
}

// ============================================================================
// ORGANIC VISUAL GENERATORS
// ============================================================================

// 1. ORGANIC DOT FIELD - clustered, irregular, varying scale dramatically
function generateOrganicDots(seed: number, dark: boolean) {
  const random = seededRandom(seed);
  const dots: any[] = [];

  // Create 3-4 cluster centers
  const clusters = [];
  for (let i = 0; i < 4; i++) {
    clusters.push({
      x: 150 + random() * 780,
      y: 150 + random() * 780,
      radius: 150 + random() * 250,
    });
  }

  // Generate dots around clusters
  for (let i = 0; i < 120; i++) {
    const cluster = clusters[Math.floor(random() * clusters.length)];
    const angle = random() * Math.PI * 2;
    const dist = gaussianRandom(random) * cluster.radius;

    const x = cluster.x + Math.cos(angle) * dist;
    const y = cluster.y + Math.sin(angle) * dist;

    if (x < 50 || x > 1030 || y < 50 || y > 1030) continue;

    // Dramatic scale variation: tiny to large
    const sizeRoll = random();
    const size = sizeRoll > 0.95 ? 30 + random() * 40 :  // 5% huge
                 sizeRoll > 0.8 ? 12 + random() * 18 :   // 15% large
                 sizeRoll > 0.5 ? 6 + random() * 8 :     // 30% medium
                 2 + random() * 4;                        // 50% tiny

    const opacity = size > 25 ? 0.08 + random() * 0.15 :
                    size > 10 ? 0.15 + random() * 0.25 :
                    0.2 + random() * 0.35;

    dots.push({
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: P.accent,
          opacity,
        },
      },
    });
  }
  return dots;
}

// 2. FLOWING WAVES - organic horizontal flows with curves
function generateFlowingWaves(seed: number, dark: boolean) {
  const random = seededRandom(seed);
  const elements: any[] = [];

  for (let wave = 0; wave < 12; wave++) {
    const baseY = 100 + wave * 75;
    const segments = 8 + Math.floor(random() * 6);

    for (let s = 0; s < segments; s++) {
      const x = 60 + s * 120 + random() * 60;
      const y = baseY + (random() - 0.5) * 40;
      const width = 40 + random() * 100;
      const height = 2 + random() * 6;
      const opacity = 0.1 + random() * 0.3;

      elements.push({
        type: "div",
        props: {
          style: {
            position: "absolute",
            left: x,
            top: y,
            width,
            height,
            backgroundColor: P.accent,
            opacity,
            borderRadius: height,
            transform: `rotate(${(random() - 0.5) * 15}deg)`,
          },
        },
      });
    }
  }
  return elements;
}

// 3. SCATTER CONSTELLATION - organic with size anchors
function generateConstellation(seed: number, dark: boolean) {
  const random = seededRandom(seed);
  const elements: any[] = [];

  // Large anchor points
  const anchors: { x: number; y: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const x = 150 + random() * 780;
    const y = 150 + random() * 780;
    const size = 35 + random() * 50;

    anchors.push({ x, y });

    elements.push({
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: P.accent,
          opacity: 0.08 + random() * 0.12,
        },
      },
    });
  }

  // Small satellites around anchors
  for (const anchor of anchors) {
    const count = 8 + Math.floor(random() * 12);
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const dist = 30 + random() * 120;
      const x = anchor.x + Math.cos(angle) * dist;
      const y = anchor.y + Math.sin(angle) * dist;
      const size = 3 + random() * 8;

      elements.push({
        type: "div",
        props: {
          style: {
            position: "absolute",
            left: x - size / 2,
            top: y - size / 2,
            width: size,
            height: size,
            borderRadius: "50%",
            backgroundColor: P.accent,
            opacity: 0.2 + random() * 0.35,
          },
        },
      });
    }
  }

  return elements;
}

// 4. ORGANIC NETWORK - softer connections, irregular nodes
function generateOrganicNetwork(seed: number, dark: boolean) {
  const random = seededRandom(seed);
  const elements: any[] = [];

  // Irregular node positions with clustering
  const nodes: { x: number; y: number; size: number }[] = [];
  const clusterX = 300 + random() * 480;
  const clusterY = 300 + random() * 480;

  for (let i = 0; i < 15; i++) {
    const angle = random() * Math.PI * 2;
    const dist = gaussianRandom(random) * 350;
    nodes.push({
      x: clusterX + Math.cos(angle) * dist,
      y: clusterY + Math.sin(angle) * dist,
      size: 6 + random() * 24,
    });
  }

  // Soft connections
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dist = Math.sqrt(
        Math.pow(nodes[j].x - nodes[i].x, 2) +
        Math.pow(nodes[j].y - nodes[i].y, 2)
      );
      if (dist > 300 || random() > 0.4) continue;

      const n1 = nodes[i];
      const n2 = nodes[j];
      const length = dist;
      const angle = Math.atan2(n2.y - n1.y, n2.x - n1.x) * 180 / Math.PI;

      elements.push({
        type: "div",
        props: {
          style: {
            position: "absolute",
            left: n1.x,
            top: n1.y,
            width: length,
            height: 1 + random() * 2,
            backgroundColor: P.accent,
            opacity: 0.08 + random() * 0.12,
            transform: `rotate(${angle}deg)`,
            transformOrigin: "0 50%",
          },
        },
      });
    }
  }

  // Nodes with varying sizes
  for (const node of nodes) {
    elements.push({
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: node.x - node.size / 2,
          top: node.y - node.size / 2,
          width: node.size,
          height: node.size,
          borderRadius: "50%",
          backgroundColor: P.accent,
          opacity: node.size > 20 ? 0.15 : 0.25 + random() * 0.25,
        },
      },
    });
  }

  return elements;
}

// 5. GROWTH STEMS - organic vertical lines like plants growing
function generateGrowthStems(seed: number, dark: boolean) {
  const random = seededRandom(seed);
  const elements: any[] = [];

  for (let i = 0; i < 20; i++) {
    const baseX = 80 + i * 48 + (random() - 0.5) * 30;
    const height = 150 + random() * 550;
    const width = 2 + random() * 5;
    const fromBottom = true;

    // Main stem
    elements.push({
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: baseX,
          top: fromBottom ? 1080 - 80 - height : 80,
          width,
          height,
          backgroundColor: P.accent,
          opacity: 0.15 + random() * 0.2,
          borderRadius: width,
        },
      },
    });

    // Nodes/buds along stem
    const nodeCount = 2 + Math.floor(random() * 4);
    for (let n = 0; n < nodeCount; n++) {
      const nodeY = (1080 - 80 - height) + (height * (0.2 + n * 0.25));
      const nodeSize = 8 + random() * 20;
      const offsetX = (random() - 0.5) * 30;

      elements.push({
        type: "div",
        props: {
          style: {
            position: "absolute",
            left: baseX + offsetX - nodeSize / 2,
            top: nodeY - nodeSize / 2,
            width: nodeSize,
            height: nodeSize,
            borderRadius: "50%",
            backgroundColor: P.accent,
            opacity: 0.1 + random() * 0.2,
          },
        },
      });
    }
  }

  return elements;
}

// 6. PARTICLE CLOUD - dense texture of tiny dots with a few large ones
function generateParticleCloud(seed: number, dark: boolean) {
  const random = seededRandom(seed);
  const elements: any[] = [];

  // Dense tiny particles
  for (let i = 0; i < 200; i++) {
    const x = 60 + random() * 960;
    const y = 60 + random() * 960;
    const size = 2 + random() * 4;

    elements.push({
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: P.accent,
          opacity: 0.15 + random() * 0.25,
        },
      },
    });
  }

  // Few dramatic large circles
  for (let i = 0; i < 3; i++) {
    const x = 200 + random() * 680;
    const y = 200 + random() * 680;
    const size = 80 + random() * 120;

    elements.push({
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: P.accent,
          opacity: 0.04 + random() * 0.06,
        },
      },
    });
  }

  return elements;
}

// ============================================================================
// LAYOUT & MAIN
// ============================================================================

const STYLES = [
  { name: "organic-dots", generator: generateOrganicDots, hook: "1 in 5 caregivers\nreport high\nfinancial strain", dark: false },
  { name: "flowing-waves", generator: generateFlowingWaves, hook: "The system\nisn't broken.\nIt was built\nthis way.", dark: true },
  { name: "constellation", generator: generateConstellation, hook: "Nobody told you\nthis would be\nthe hardest thing", dark: false },
  { name: "organic-network", generator: generateOrganicNetwork, hook: "Care work\nis invisible\nuntil it\nbreaks.", dark: true },
  { name: "growth-stems", generator: generateGrowthStems, hook: "You're not\nfailing.\nYou're surviving.", dark: false },
  { name: "particle-cloud", generator: generateParticleCloud, hook: "65 million\nAmericans\nprovide unpaid care", dark: true },
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
        ...textElements,
      ],
    },
  };
}

async function addLogo(image: Buffer, isDark: boolean): Promise<Buffer> {
  try {
    const logoSvg = readFileSync(LOGO_PATH);
    let logoPng = await sharp(logoSvg).resize({ width: 140 }).png().toBuffer();

    if (isDark) {
      logoPng = await sharp(logoPng)
        .negate({ alpha: false })
        .tint({ r: 253, g: 251, b: 247 })
        .png()
        .toBuffer();
    }

    const logoMeta = await sharp(logoPng).metadata();
    const logoHeight = logoMeta.height || 60;

    return sharp(image)
      .composite([{ input: logoPng, top: 1080 - 60 - logoHeight, left: 60 }])
      .png()
      .toBuffer();
  } catch {
    return image;
  }
}

async function main() {
  const fonts = loadFonts();
  const outputDir = join(process.cwd(), "..", "output", "dataviz-organic");

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.log("Generating ORGANIC Data-Viz explorations...\n");
  console.log("Features: clustering, scale variation, organic flow\n");

  for (let i = 0; i < STYLES.length; i++) {
    const style = STYLES[i];
    const layout = buildLayout(style, i);

    const svg = await satori(layout, { width: 1080, height: 1080, fonts });
    let png = await sharp(Buffer.from(svg)).png().toBuffer();
    png = await addLogo(png, style.dark);

    const bgLabel = style.dark ? "dark" : "cream";
    const filename = `${i + 1}-${style.name}-${bgLabel}.png`;
    writeFileSync(join(outputDir, filename), png);

    console.log(`${i + 1}. ${style.name} (${bgLabel})`);
    console.log(`   "${style.hook.split("\n")[0]}..."\n`);
  }

  console.log(`Saved to: ${outputDir}`);
}

main().catch(console.error);
