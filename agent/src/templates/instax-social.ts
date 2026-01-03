/**
 * Instax Social Template
 * Composes Instax Wide polaroid images with GiveCare brand typography
 *
 * Brand System (Electric Cream):
 * - Background: #FFFCF5 (cream, oklch 99% 0.008 85)
 * - Text: #54340E (warm brown, logo color)
 * - Primary: #5046E5 (electric indigo)
 * - Serif: Alegreya (body/headings)
 * - Display: Gabarito (bold display)
 */

import satori from "satori";
import sharp from "sharp";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Font paths - use GiveCare brand fonts
const GIVECARE_FONTS = join(process.cwd(), "..", "givecare", "apps", "web", "public", "fonts");
const ALEGREYA_PATH = join(GIVECARE_FONTS, "alegreya-400.woff2");
const GABARITO_PATH = join(GIVECARE_FONTS, "gabarito-500.woff2");

// Fallback to node_modules if GiveCare fonts not found
const ALEGREYA_FALLBACK = join(process.cwd(), "node_modules/@fontsource/alegreya/files/alegreya-latin-400-normal.woff");
const GABARITO_FALLBACK = join(process.cwd(), "node_modules/@fontsource/gabarito/files/gabarito-latin-500-normal.woff");

// Brand colors (Electric Cream palette)
const COLORS = {
  background: "#FFFCF5",  // oklch(99% 0.008 85)
  text: "#54340E",        // Logo brown
  primary: "#5046E5",     // Electric indigo
  muted: "#8A7F6F",       // oklch(58% 0.02 70)
  cream: "#F5F0E8",       // oklch(95% 0.015 80)
};

// GiveCare logo SVG (simplified wordmark)
const LOGO_SVG = `<svg width="120" height="32" viewBox="0 0 235 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M72.9224 30.3112C72.9224 40.6198 79.5907 47.8075 88.831 47.8075C98.0714 47.8075 104.74 40.6198 104.74 30.3112C104.74 20.0026 98.0714 12.8149 88.831 12.8149C79.5907 12.8149 72.9224 20.0026 72.9224 30.3112ZM98.643 30.3112C98.643 37.688 94.5944 42.464 88.831 42.464C83.0677 42.464 79.0191 37.688 79.0191 30.3112C79.0191 22.9344 83.0677 18.1584 88.831 18.1584C94.5944 18.1584 98.643 22.9344 98.643 30.3112Z" fill="#54340E"/>
<path d="M121.909 47.8074C128.911 47.8074 132.912 41.9437 132.912 34.8979C132.912 27.8521 128.911 21.9885 121.909 21.9885C118.67 21.9885 116.288 23.2653 114.717 25.1095V22.4614H109.001V55.7989H114.717V44.6864C116.288 46.5306 118.67 47.8074 121.909 47.8074ZM114.574 34.1886C114.574 29.5072 117.241 26.9537 120.766 26.9537C124.91 26.9537 127.148 30.1692 127.148 34.8979C127.148 39.6267 124.91 42.8422 120.766 42.8422C117.241 42.8422 114.574 40.2414 114.574 35.6545V34.1886Z" fill="#54340E"/>
<path d="M148.38 47.8074C153.381 47.8074 157.334 45.2066 159.097 40.8561L154.191 39.0119C153.429 41.5654 151.19 42.9841 148.38 42.9841C144.712 42.9841 142.14 40.3833 141.711 36.1274H159.24V34.2359C159.24 27.4266 155.381 21.9885 148.142 21.9885C140.902 21.9885 136.234 27.6157 136.234 34.8979C136.234 42.5585 141.235 47.8074 148.38 47.8074ZM148.094 26.7645C151.714 26.7645 153.429 29.1289 153.476 31.8716H141.997C142.855 28.5142 145.141 26.7645 148.094 26.7645Z" fill="#54340E"/>
<path d="M163.528 47.2872H169.244V32.7227C169.244 29.1762 171.863 27.2847 174.435 27.2847C177.579 27.2847 178.817 29.5072 178.817 32.5809V47.2872H184.533V30.9258C184.533 25.5824 181.389 21.9885 176.15 21.9885C172.911 21.9885 170.672 23.4544 169.244 25.1095V22.4614H163.528V47.2872Z" fill="#54340E"/>
<path d="M201.273 13.335L188.318 47.2872H194.367L197.272 39.5321H212.038L214.991 47.2872H221.135L208.18 13.335H201.273ZM204.608 20.0498L210.037 34.2359H199.273L204.608 20.0498Z" fill="#54340E"/>
<path d="M230.948 13.4336H224.851V47.3858H230.948V13.4336Z" fill="#54340E"/>
<path d="M58.9551 25.8051C60.3959 21.5118 59.8998 16.8087 57.5957 12.9036C54.1305 6.91384 47.1645 3.83229 40.3613 5.28243C37.3347 1.89745 32.9864 -0.0275359 28.4278 4.8298e-05C21.4737 -0.0157141 15.3035 4.42929 13.1641 10.9983C8.69675 11.9066 4.84064 14.6827 2.58414 18.6174C-0.9068 24.5914 -0.11097 32.1219 4.55287 37.2447C3.11204 41.538 3.6082 46.2411 5.91233 50.1462C9.37747 56.1359 16.3435 59.2175 23.1467 57.7673C26.1713 61.1523 30.5215 63.0773 35.0802 63.0477C42.0383 63.0655 48.2104 58.6165 50.3498 52.0416C54.8172 51.1333 58.6733 48.3572 60.9298 44.4225C64.4168 38.4485 63.619 30.9239 58.9571 25.8011L58.9551 25.8051ZM35.0842 58.9278C32.2998 58.9318 29.6027 57.9644 27.4652 56.1931C27.5625 56.1418 27.7312 56.0492 27.8403 55.9822L40.4863 48.7315C41.1333 48.367 41.5302 47.6833 41.5262 46.9445V29.2452L46.8708 32.3091C46.9284 32.3366 46.9661 32.3918 46.974 32.4549V47.1119C46.9661 53.6297 41.6493 58.914 35.0842 58.9278ZM9.51441 48.0853C8.11922 45.6933 7.61712 42.8896 8.09541 40.1686C8.18869 40.2238 8.35341 40.3242 8.4705 40.3912L21.1165 47.6419C21.7575 48.0143 22.5513 48.0143 23.1944 47.6419L38.6327 38.7914V44.919C38.6366 44.982 38.6069 45.0431 38.5573 45.0825L25.7743 52.4101C20.0805 55.665 12.8089 53.7302 9.51639 48.0853H9.51441ZM6.18621 20.6803C7.57544 18.2845 9.76844 16.4521 12.3802 15.5004C12.3802 15.6088 12.3742 15.7999 12.3742 15.9339V30.4373C12.3703 31.1742 12.7672 31.8579 13.4122 32.2224L28.8505 41.071L23.5059 44.1348C23.4524 44.1703 23.3849 44.1762 23.3253 44.1506L10.5405 36.8171C4.8585 33.5503 2.90961 26.3331 6.18423 20.6823L6.18621 20.6803ZM50.0978 30.8254L34.6595 21.9748L40.004 18.913C40.0576 18.8775 40.1251 18.8716 40.1846 18.8972L52.9695 26.2248C58.6614 29.4896 60.6123 36.7186 57.3238 42.3694C55.9325 44.7614 53.7415 46.5937 51.1318 47.5474V32.6105C51.1377 31.8736 50.7428 31.1919 50.0998 30.8254H50.0978ZM55.4165 22.8772C55.3233 22.8201 55.1585 22.7216 55.0415 22.6546L42.3955 15.4039C41.7545 15.0315 40.9606 15.0315 40.3176 15.4039L24.8793 24.2545V18.1268C24.8753 18.0638 24.9051 18.0027 24.9547 17.9633L37.7376 10.6416C43.4315 7.3808 50.711 9.32155 53.9936 14.9763C55.3808 17.3643 55.8829 20.1602 55.4126 22.8772H55.4165ZM21.9738 33.7986L16.6273 30.7348C16.5697 30.7072 16.532 30.652 16.5241 30.589V15.9319C16.528 9.40627 21.8607 4.11798 28.4337 4.12192C31.2142 4.12192 33.9053 5.09131 36.0427 6.8567C35.9455 6.90793 35.7788 7.00053 35.6677 7.06752L23.0217 14.3182C22.3747 14.6827 21.9778 15.3645 21.9818 16.1033L21.9738 33.7947V33.7986ZM24.8773 27.5843L31.754 23.6417L38.6307 27.5823V35.4655L31.754 39.4061L24.8773 35.4655V27.5843Z" fill="#54340E"/>
</svg>`;

// Aspect ratios
const RATIOS = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "16:9": { width: 1200, height: 675 },
  "9:16": { width: 1080, height: 1920 },
} as const;

export type Ratio = keyof typeof RATIOS;

// Layout positions - where the polaroid crops off
export type CropPosition =
  | "crop-right"      // Image bleeds off right edge
  | "crop-left"       // Image bleeds off left edge
  | "crop-bottom"     // Image bleeds off bottom
  | "crop-top-right"  // Image bleeds off top and right
  | "crop-bottom-left"; // Image bleeds off bottom and left

export interface InstaxSocialConfig {
  // The polaroid image path (webp with transparency)
  polaroidPath: string;

  // Headline text
  headline: string;

  // Optional subtext
  subtext?: string;

  // Where the polaroid crops off for dynamism
  cropPosition: CropPosition;

  // Aspect ratio
  ratio?: Ratio;

  // Polaroid rotation (degrees)
  rotation?: number;

  // Polaroid scale (1.0 = 80% of canvas width, larger = more cropping)
  scale?: number;
}

function loadFonts() {
  const fonts: { name: string; data: Buffer; weight: number; style: "normal" }[] = [];

  // Try GiveCare fonts first
  if (existsSync(ALEGREYA_PATH)) {
    fonts.push({ name: "Alegreya", data: readFileSync(ALEGREYA_PATH), weight: 400, style: "normal" });
  } else if (existsSync(ALEGREYA_FALLBACK)) {
    fonts.push({ name: "Alegreya", data: readFileSync(ALEGREYA_FALLBACK), weight: 400, style: "normal" });
  }

  if (existsSync(GABARITO_PATH)) {
    fonts.push({ name: "Gabarito", data: readFileSync(GABARITO_PATH), weight: 500, style: "normal" });
  } else if (existsSync(GABARITO_FALLBACK)) {
    fonts.push({ name: "Gabarito", data: readFileSync(GABARITO_FALLBACK), weight: 500, style: "normal" });
  }

  return fonts;
}

function buildLayout(config: InstaxSocialConfig, dims: { width: number; height: number }) {
  const { headline, subtext, cropPosition } = config;
  const { width, height } = dims;

  // Calculate sizes based on dimensions
  const headlineSize = Math.round(width * 0.065); // Bigger headline
  const subtextSize = Math.round(width * 0.032);
  const padding = Math.round(width * 0.06);

  // Determine text position based on crop position
  // Text goes opposite to where the image crops
  const textPosition = {
    "crop-right": { align: "left", vAlign: "top" },
    "crop-left": { align: "right", vAlign: "top" },
    "crop-bottom": { align: "center", vAlign: "top" },
    "crop-top-right": { align: "left", vAlign: "bottom" },
    "crop-bottom-left": { align: "right", vAlign: "top" },
  }[cropPosition];

  // Logo position - avoid where polaroid crops
  const logoPosition = {
    "crop-right": { hAlign: "left", vAlign: "bottom" },
    "crop-left": { hAlign: "right", vAlign: "bottom" },
    "crop-bottom": { hAlign: "left", vAlign: "top" }, // Top when polaroid at bottom
    "crop-top-right": { hAlign: "left", vAlign: "bottom" },
    "crop-bottom-left": { hAlign: "right", vAlign: "top" },
  }[cropPosition];

  // Text block with brand typography
  const textBlock = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: Math.round(padding * 0.5),
        maxWidth: "48%",
        textAlign: textPosition.align,
        padding: padding,
        position: "absolute",
        ...(textPosition.align === "left" ? { left: 0 } : {}),
        ...(textPosition.align === "right" ? { right: 0 } : {}),
        ...(textPosition.align === "center" ? { left: "25%", right: "25%" } : {}),
        ...(textPosition.vAlign === "top" ? { top: padding * 1.5 } : {}),
        ...(textPosition.vAlign === "center" ? { top: "35%" } : {}),
        ...(textPosition.vAlign === "bottom" ? { bottom: padding * 4 } : {}),
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 0,
            },
            children: {
              type: "span",
              props: {
                style: {
                  fontSize: headlineSize,
                  fontFamily: "Alegreya",
                  fontWeight: 400,
                  color: COLORS.text,
                  lineHeight: 1.15,
                  letterSpacing: "-0.02em",
                },
                children: headline,
              },
            },
          },
        },
        subtext ? {
          type: "div",
          props: {
            style: {
              display: "flex",
              marginTop: Math.round(padding * 0.3),
            },
            children: {
              type: "span",
              props: {
                style: {
                  fontSize: subtextSize,
                  fontFamily: "Alegreya",
                  fontStyle: "italic",
                  color: COLORS.muted,
                  lineHeight: 1.4,
                },
                children: subtext,
              },
            },
          },
        } : null,
      ].filter(Boolean),
    },
  };

  // Logo wordmark - positioned to avoid polaroid
  const logoBlock = {
    type: "div",
    props: {
      style: {
        display: "flex",
        position: "absolute",
        ...(logoPosition.vAlign === "bottom" ? { bottom: padding } : { top: padding }),
        ...(logoPosition.hAlign === "left" ? { left: padding } : { right: padding }),
        alignItems: "center",
        gap: Math.round(padding * 0.3),
      },
      children: [
        // Hexagon icon placeholder (simplified)
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              width: Math.round(width * 0.025),
              height: Math.round(width * 0.025),
              backgroundColor: COLORS.text,
              borderRadius: "20%",
            },
          },
        },
        // Wordmark
        {
          type: "span",
          props: {
            style: {
              display: "flex",
              fontFamily: "Gabarito",
              fontSize: Math.round(width * 0.022),
              fontWeight: 500,
              color: COLORS.text,
              letterSpacing: "-0.01em",
            },
            children: "GiveCare",
          },
        },
      ],
    },
  };

  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        backgroundColor: COLORS.background,
        display: "flex",
        position: "relative",
        overflow: "hidden",
      },
      children: [textBlock, logoBlock],
    },
  };
}

/**
 * Calculate polaroid position for dynamic cropping
 */
function getPolaroidPosition(
  cropPosition: CropPosition,
  canvasWidth: number,
  canvasHeight: number,
  polaroidWidth: number,
  polaroidHeight: number
): { left: number; top: number } {
  const overhang = 0.15; // How much to extend past edge

  switch (cropPosition) {
    case "crop-right":
      return {
        left: canvasWidth - polaroidWidth + Math.round(polaroidWidth * overhang),
        top: Math.round((canvasHeight - polaroidHeight) / 2),
      };
    case "crop-left":
      return {
        left: -Math.round(polaroidWidth * overhang),
        top: Math.round((canvasHeight - polaroidHeight) / 2),
      };
    case "crop-bottom":
      return {
        left: Math.round((canvasWidth - polaroidWidth) / 2),
        top: canvasHeight - polaroidHeight + Math.round(polaroidHeight * overhang),
      };
    case "crop-top-right":
      return {
        left: canvasWidth - polaroidWidth + Math.round(polaroidWidth * 0.1),
        top: -Math.round(polaroidHeight * 0.1),
      };
    case "crop-bottom-left":
      return {
        left: -Math.round(polaroidWidth * 0.1),
        top: canvasHeight - polaroidHeight + Math.round(polaroidHeight * 0.1),
      };
    default:
      return {
        left: canvasWidth - polaroidWidth,
        top: Math.round((canvasHeight - polaroidHeight) / 2),
      };
  }
}

/**
 * Generate social image with Instax polaroid - brand-aligned
 */
export async function generateInstaxSocial(config: InstaxSocialConfig): Promise<Buffer> {
  const ratio = config.ratio || "1:1";
  const dims = RATIOS[ratio];
  const { width, height } = dims;
  const scale = config.scale || 1.0;

  const fonts = loadFonts();
  const layout = buildLayout(config, dims);

  // Render base with Satori
  const svg = await satori(layout, { width, height, fonts });
  let base = await sharp(Buffer.from(svg)).png().toBuffer();

  // Load and resize polaroid - MUCH BIGGER (80% of width * scale)
  const targetWidth = Math.round(width * 0.8 * scale);
  const polaroid = await sharp(config.polaroidPath)
    .resize({ width: targetWidth })
    .png()
    .toBuffer();

  const polaroidMeta = await sharp(polaroid).metadata();
  const pWidth = polaroidMeta.width || targetWidth;
  const pHeight = polaroidMeta.height || Math.round(targetWidth * 0.75);

  // Get position for dynamic cropping
  const { left: pLeft, top: pTop } = getPolaroidPosition(
    config.cropPosition,
    width,
    height,
    pWidth,
    pHeight
  );

  // Apply rotation if specified
  let rotatedPolaroid = polaroid;
  if (config.rotation) {
    rotatedPolaroid = await sharp(polaroid)
      .rotate(config.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  }

  // Composite
  return sharp(base)
    .composite([{
      input: rotatedPolaroid,
      top: pTop,
      left: pLeft,
    }])
    .png()
    .toBuffer();
}

/**
 * Quick generation with sensible defaults
 */
export async function quickInstaxSocial(
  polaroidPath: string,
  headline: string,
  options: {
    subtext?: string;
    cropPosition?: CropPosition;
    ratio?: Ratio;
    rotation?: number;
    scale?: number;
  } = {}
): Promise<Buffer> {
  return generateInstaxSocial({
    polaroidPath,
    headline,
    subtext: options.subtext,
    cropPosition: options.cropPosition || "crop-right",
    ratio: options.ratio || "1:1",
    rotation: options.rotation || -3,
    scale: options.scale || 1.0,
  });
}

/**
 * Generate a set of hook variations with different crop positions
 */
export async function generateHookSet(
  polaroidPath: string,
  headline: string,
  subtext?: string
): Promise<{ position: CropPosition; buffer: Buffer }[]> {
  const positions: CropPosition[] = [
    "crop-right",
    "crop-bottom",
    "crop-top-right",
  ];

  const results: { position: CropPosition; buffer: Buffer }[] = [];

  for (const position of positions) {
    const buffer = await quickInstaxSocial(polaroidPath, headline, {
      subtext,
      cropPosition: position,
      rotation: position === "crop-bottom" ? 0 : -3,
      scale: position === "crop-bottom" ? 1.1 : 1.0,
    });
    results.push({ position, buffer });
  }

  return results;
}
