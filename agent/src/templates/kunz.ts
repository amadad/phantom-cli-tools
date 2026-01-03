/**
 * Kunz-inspired Layered Grid System
 *
 * Two overlapping grids create unexpected intersections.
 * Geometric forms interact with typography.
 *
 * Workaround: Satori doesn't support absolute positioning well,
 * so we use a row-based system with grid-snapped margins.
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

const RATIOS = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
} as const;

type Ratio = keyof typeof RATIOS;

// Grid system: 6 columns (A) overlaid with 5 columns (B)
// Mark grid (M): finer 12-column for pattern placement
function getGridPositions(width: number, height: number) {
  const margin = 60;
  const innerW = width - margin * 2;
  const innerH = height - margin * 2;

  return {
    margin,
    // 6-column grid (A) - primary type
    A: Array.from({ length: 7 }, (_, i) => margin + (innerW / 6) * i),
    // 5-column grid (B) - secondary type, offset tension
    B: Array.from({ length: 6 }, (_, i) => margin + (innerW / 5) * i),
    // 12-column grid (M) - marks/patterns, finer control
    M: {
      cols: Array.from({ length: 13 }, (_, i) => margin + (innerW / 12) * i),
      rows: Array.from({ length: 13 }, (_, i) => margin + (innerH / 12) * i),
    },
  };
}

type GridCol = "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "B1" | "B2" | "B3" | "B4" | "B5";

// Mark grid: M1-M12 for both columns and rows
type MarkGridRef = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

function resolveCol(ref: GridCol, width: number, height: number): number {
  const grid = getGridPositions(width, height);
  if (ref.startsWith("A")) {
    return grid.A[parseInt(ref[1]) - 1];
  }
  return grid.B[parseInt(ref[1]) - 1];
}

function resolveMarkPos(col: MarkGridRef, row: MarkGridRef, width: number, height: number) {
  const grid = getGridPositions(width, height);
  return {
    x: grid.M.cols[col - 1],
    y: grid.M.rows[row - 1],
  };
}

// Typographic marks as graphic devices - data-viz aesthetic
type TypographicMark =
  | "*" | "+" | ":" | "—" | "." | "(" | ")" | "[" | "]"
  // Data characters
  | "0" | "1" | "%" | "#" | "/" | "|" | ">" | "<";

// Mark modes: how the mark appears
type MarkMode =
  | "singular"    // single mark, quiet anchor
  | "pattern"     // repeated grid pattern, loud texture
  | "scatter";    // organic placement, medium presence

interface MarkSpec {
  glyph: TypographicMark;
  mode: MarkMode;
  // Position on 12x12 mark grid
  col: MarkGridRef;
  row: MarkGridRef;
  // For patterns: how many columns/rows to fill
  spanCols?: number;
  spanRows?: number;
  // Appearance
  size?: number;
  opacity?: number;
}

interface KunzSpec {
  rows: Array<{
    content: string;
    size: number;
    col: GridCol;  // Which grid column to align to
    marginTop?: number;  // Spacing from previous row
    align?: "left" | "right";
  }>;
  marks?: MarkSpec[];
  // Contrast: loud type = quiet marks, quiet type = loud marks
  contrast: "loud-quiet" | "quiet-loud" | "balanced";
  logo: {
    col: GridCol;
    position: "top" | "bottom";
  };
  ratio: Ratio;
}

// Build marks layout for Satori rendering (uses same font system)
function buildMarksLayout(spec: KunzSpec): any | null {
  const { width, height } = RATIOS[spec.ratio];

  if (!spec.marks || spec.marks.length === 0) return null;

  const cellW = (width - 120) / 12;
  const cellH = (height - 120) / 12;
  const markElements: any[] = [];

  for (const mark of spec.marks) {
    const basePos = resolveMarkPos(mark.col, mark.row, width, height);
    const size = mark.size || 24;
    const opacity = mark.opacity || 1;

    if (mark.mode === "singular") {
      markElements.push({
        type: "span",
        props: {
          style: {
            position: "absolute",
            left: basePos.x,
            top: basePos.y,
            fontSize: size,
            fontFamily: "Alegreya",
            color: COLORS.brown,
            opacity,
          },
          children: mark.glyph,
        },
      });
    } else if (mark.mode === "pattern") {
      const cols = mark.spanCols || 3;
      const rows = mark.spanRows || 3;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          markElements.push({
            type: "span",
            props: {
              style: {
                position: "absolute",
                left: basePos.x + c * cellW,
                top: basePos.y + r * cellH,
                fontSize: size,
                fontFamily: "Alegreya",
                color: COLORS.brown,
                opacity,
              },
              children: mark.glyph,
            },
          });
        }
      }
    } else if (mark.mode === "scatter") {
      const cols = mark.spanCols || 4;
      const rows = mark.spanRows || 4;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seed = (mark.col * 7 + mark.row * 13 + r * 17 + c * 23) % 100;
          const offsetX = (seed % 20) - 10;
          const offsetY = ((seed * 3) % 20) - 10;
          if (seed % 3 !== 0) {
            markElements.push({
              type: "span",
              props: {
                style: {
                  position: "absolute",
                  left: basePos.x + c * cellW * 1.2 + offsetX,
                  top: basePos.y + r * cellH * 1.2 + offsetY,
                  fontSize: size,
                  fontFamily: "Alegreya",
                  color: COLORS.brown,
                  opacity: opacity * (0.5 + (seed % 50) / 100),
                },
                children: mark.glyph,
              },
            });
          }
        }
      }
    }
  }

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
      children: markElements,
    },
  };
}

function buildKunzLayout(spec: KunzSpec) {
  const { width, height } = RATIOS[spec.ratio];
  const grid = getGridPositions(width, height);
  const elements: any[] = [];

  // Logo at top
  if (spec.logo.position === "top") {
    const logoLeft = resolveCol(spec.logo.col, width, height);
    elements.push({
      type: "div",
      props: {
        style: {
          display: "flex",
          width: "100%",
          height: 80,
          marginBottom: 40,
          paddingLeft: logoLeft - grid.margin,
        },
      },
    });
  }

  // Text rows only - marks handled separately via SVG composite
  for (const row of spec.rows) {
    const colPos = resolveCol(row.col, width, height);
    const leftPad = colPos - grid.margin;

    // For right-aligned text, calculate right padding from the column position
    const rightPad = row.align === "right"
      ? width - colPos - grid.margin
      : 0;

    elements.push({
      type: "div",
      props: {
        style: {
          display: "flex",
          width: "100%",
          marginTop: row.marginTop || 0,
          paddingLeft: row.align === "right" ? 0 : leftPad,
          paddingRight: rightPad,
          justifyContent: row.align === "right" ? "flex-end" : "flex-start",
        },
        children: {
          type: "p",
          props: {
            style: {
              fontSize: row.size,
              fontFamily: "Alegreya",
              color: COLORS.brown,
              lineHeight: row.size > 80 ? 0.95 : 1.2,
              margin: 0,
              textAlign: row.align || "left",
            },
            children: row.content,
          },
        },
      },
    });
  }

  // Marks are rendered as separate SVG layer (see generateMarksSvg)

  // Spacer to push logo to bottom
  elements.push({
    type: "div",
    props: {
      style: { flex: 1 },
    },
  });

  // Logo at bottom
  if (spec.logo.position === "bottom") {
    const logoLeft = resolveCol(spec.logo.col, width, height);
    elements.push({
      type: "div",
      props: {
        style: {
          display: "flex",
          width: "100%",
          height: 80,
          paddingLeft: logoLeft - grid.margin,
        },
      },
    });
  }

  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "transparent",  // Transparent so marks show through
        padding: grid.margin,
      },
      children: elements,
    },
  };
}

function loadFonts() {
  return [
    { name: "Alegreya", data: readFileSync(ALEGREYA_PATH), weight: 400 as const, style: "normal" as const },
  ];
}

export async function renderKunz(spec: KunzSpec): Promise<Buffer> {
  const { width, height } = RATIOS[spec.ratio];
  const fonts = loadFonts();

  // Start with cream background
  const layers: Array<{ input: Buffer; top: number; left: number }> = [];

  // Render marks layer (behind text)
  const marksLayout = buildMarksLayout(spec);
  if (marksLayout) {
    const marksSvg = await satori(marksLayout, { width, height, fonts });
    const marksPng = await sharp(Buffer.from(marksSvg)).png().toBuffer();
    layers.push({ input: marksPng, top: 0, left: 0 });
  }

  // Render text layout (on top)
  const layout = buildKunzLayout(spec);
  const textSvg = await satori(layout, { width, height, fonts });
  const textPng = await sharp(Buffer.from(textSvg)).png().toBuffer();
  layers.push({ input: textPng, top: 0, left: 0 });

  // Composite all layers on cream background
  let result = await sharp({ create: { width, height, channels: 4, background: { r: 245, g: 237, b: 228, alpha: 1 } } })
    .composite(layers)
    .png()
    .toBuffer();

  // Composite logo
  const grid = getGridPositions(width, height);
  const logoSvg = readFileSync(LOGO_PATH);
  const logoWidth = 160;

  const logoPng = await sharp(logoSvg)
    .resize({ width: logoWidth })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoPng).metadata();
  const logoHeight = logoMeta.height || 80;

  const logoLeft = resolveCol(spec.logo.col, width, height);
  const logoTop = spec.logo.position === "top"
    ? grid.margin
    : height - grid.margin - logoHeight;

  return sharp(result)
    .composite([{ input: logoPng, top: logoTop, left: logoLeft }])
    .png()
    .toBuffer();
}

/**
 * Kunz-inspired examples with typographic marks on separate grid
 *
 * Contrast modes:
 * - loud-quiet: Big type + subtle marks (singular, low opacity)
 * - quiet-loud: Small type + bold mark patterns
 * - balanced: Medium both
 */
export const KUNZ_EXAMPLES: Array<{ name: string; spec: KunzSpec }> = [
  // DATA-VIZ COLLAGE - pseudo-data as texture
  {
    name: "binary-flood",
    spec: {
      rows: [
        { content: "53", size: 220, col: "A1", marginTop: 80 },
        { content: "million", size: 56, col: "B3", marginTop: 20 },
        { content: "unpaid caregivers", size: 32, col: "A4", marginTop: 60 },
      ],
      marks: [
        { glyph: "1", mode: "pattern", col: 6, row: 1, spanCols: 7, spanRows: 4, size: 28, opacity: 0.5 },
        { glyph: "0", mode: "pattern", col: 7, row: 5, spanCols: 6, spanRows: 4, size: 28, opacity: 0.35 },
        { glyph: "%", mode: "singular", col: 11, row: 10, size: 64, opacity: 0.4 },
      ],
      contrast: "balanced",
      logo: { col: "A5", position: "bottom" },
      ratio: "1:1",
    },
  },
  {
    name: "hash-grid",
    spec: {
      rows: [
        { content: "You", size: 140, col: "A1", marginTop: 80 },
        { content: "matter", size: 140, col: "B2", marginTop: 0 },
        { content: "too.", size: 140, col: "A3", marginTop: 0 },
      ],
      marks: [
        { glyph: "#", mode: "pattern", col: 8, row: 1, spanCols: 5, spanRows: 6, size: 32, opacity: 0.45 },
        { glyph: "+", mode: "pattern", col: 9, row: 8, spanCols: 4, spanRows: 4, size: 24, opacity: 0.35 },
      ],
      contrast: "balanced",
      logo: { col: "B4", position: "bottom" },
      ratio: "1:1",
    },
  },
  {
    name: "pipe-stream",
    spec: {
      rows: [
        { content: "Burnout", size: 120, col: "A1", marginTop: 60 },
        { content: "is not", size: 44, col: "B4", marginTop: 100, align: "right" },
        { content: "a strategy.", size: 44, col: "B4", marginTop: 8, align: "right" },
      ],
      marks: [
        { glyph: "|", mode: "pattern", col: 1, row: 5, spanCols: 6, spanRows: 7, size: 36, opacity: 0.4 },
        { glyph: ">", mode: "pattern", col: 8, row: 9, spanCols: 4, spanRows: 3, size: 28, opacity: 0.35 },
      ],
      contrast: "balanced",
      logo: { col: "A1", position: "bottom" },
      ratio: "1:1",
    },
  },

  // PERCENTAGE + BINARY - data output aesthetic
  {
    name: "percent-field",
    spec: {
      rows: [
        { content: "It's okay", size: 52, col: "A1", marginTop: 420 },
        { content: "to ask for help.", size: 52, col: "B2", marginTop: 8 },
      ],
      marks: [
        { glyph: "%", mode: "pattern", col: 1, row: 1, spanCols: 8, spanRows: 4, size: 36, opacity: 0.45 },
        { glyph: "0", mode: "pattern", col: 1, row: 5, spanCols: 6, spanRows: 3, size: 24, opacity: 0.3 },
        { glyph: "1", mode: "scatter", col: 8, row: 4, spanCols: 5, spanRows: 4, size: 28, opacity: 0.35 },
      ],
      contrast: "quiet-loud",
      logo: { col: "A5", position: "top" },
      ratio: "1:1",
    },
  },
  {
    name: "data-collage",
    spec: {
      rows: [
        { content: "Your time", size: 56, col: "A1", marginTop: 60 },
        { content: "has value.", size: 56, col: "B2", marginTop: 8 },
      ],
      marks: [
        { glyph: ":", mode: "pattern", col: 1, row: 4, spanCols: 6, spanRows: 4, size: 32, opacity: 0.4 },
        { glyph: "#", mode: "pattern", col: 7, row: 3, spanCols: 6, spanRows: 5, size: 28, opacity: 0.35 },
        { glyph: "|", mode: "pattern", col: 1, row: 9, spanCols: 12, spanRows: 3, size: 24, opacity: 0.3 },
      ],
      contrast: "quiet-loud",
      logo: { col: "A1", position: "bottom" },
      ratio: "1:1",
    },
  },
  {
    name: "ones-zeros",
    spec: {
      rows: [
        { content: "The invisible", size: 48, col: "A1", marginTop: 100 },
        { content: "made visible.", size: 48, col: "B2", marginTop: 12 },
      ],
      marks: [
        { glyph: "1", mode: "scatter", col: 1, row: 3, spanCols: 12, spanRows: 5, size: 32, opacity: 0.45 },
        { glyph: "0", mode: "scatter", col: 2, row: 8, spanCols: 10, spanRows: 4, size: 28, opacity: 0.35 },
      ],
      contrast: "quiet-loud",
      logo: { col: "B4", position: "bottom" },
      ratio: "1:1",
    },
  },

  // HEAVY DATA TEXTURE
  {
    name: "terminal-output",
    spec: {
      rows: [
        { content: "24", size: 180, col: "A2", marginTop: 40 },
        { content: "hours a week", size: 56, col: "B3", marginTop: 40 },
        { content: "That's a part-time job.", size: 28, col: "A1", marginTop: 60 },
        { content: "Unpaid.", size: 28, col: "A4", marginTop: 12 },
      ],
      marks: [
        { glyph: ">", mode: "pattern", col: 1, row: 7, spanCols: 8, spanRows: 3, size: 24, opacity: 0.4 },
        { glyph: "|", mode: "pattern", col: 1, row: 10, spanCols: 12, spanRows: 3, size: 20, opacity: 0.35 },
      ],
      contrast: "balanced",
      logo: { col: "A1", position: "bottom" },
      ratio: "9:16",
    },
  },
  {
    name: "bracket-data",
    spec: {
      rows: [
        { content: '"I forgot', size: 56, col: "A1", marginTop: 100 },
        { content: "what it feels like", size: 56, col: "B2", marginTop: 8 },
        { content: 'to not be tired."', size: 56, col: "A1", marginTop: 8 },
        { content: "— Maria", size: 24, col: "A5", marginTop: 60, align: "right" },
      ],
      marks: [
        { glyph: "[", mode: "singular", col: 1, row: 1, size: 240, opacity: 0.25 },
        { glyph: "]", mode: "singular", col: 9, row: 5, size: 240, opacity: 0.25 },
        { glyph: "1", mode: "pattern", col: 7, row: 7, spanCols: 6, spanRows: 5, size: 22, opacity: 0.4 },
        { glyph: "0", mode: "pattern", col: 8, row: 9, spanCols: 5, spanRows: 3, size: 22, opacity: 0.3 },
      ],
      contrast: "balanced",
      logo: { col: "B4", position: "top" },
      ratio: "1:1",
    },
  },
  {
    name: "plus-percent",
    spec: {
      rows: [
        { content: "Care", size: 140, col: "A1", marginTop: 40 },
        { content: "begets", size: 40, col: "B3", marginTop: 40 },
        { content: "care.", size: 140, col: "A2", marginTop: 8 },
      ],
      marks: [
        { glyph: "+", mode: "pattern", col: 8, row: 1, spanCols: 5, spanRows: 5, size: 36, opacity: 0.5 },
        { glyph: "%", mode: "pattern", col: 9, row: 7, spanCols: 4, spanRows: 4, size: 28, opacity: 0.4 },
        { glyph: "#", mode: "scatter", col: 7, row: 10, spanCols: 6, spanRows: 3, size: 20, opacity: 0.3 },
      ],
      contrast: "balanced",
      logo: { col: "A1", position: "bottom" },
      ratio: "1:1",
    },
  },

  // MAXIMUM DATA-VIZ
  {
    name: "full-binary",
    spec: {
      rows: [
        { content: "Every", size: 44, col: "A1", marginTop: 440 },
        { content: "moment counts.", size: 44, col: "B2", marginTop: 8 },
      ],
      marks: [
        { glyph: "1", mode: "pattern", col: 1, row: 1, spanCols: 12, spanRows: 4, size: 26, opacity: 0.5 },
        { glyph: "0", mode: "pattern", col: 1, row: 5, spanCols: 12, spanRows: 4, size: 26, opacity: 0.4 },
        { glyph: "%", mode: "scatter", col: 2, row: 9, spanCols: 10, spanRows: 2, size: 20, opacity: 0.35 },
      ],
      contrast: "quiet-loud",
      logo: { col: "B4", position: "bottom" },
      ratio: "4:5",
    },
  },
  {
    name: "hash-bracket",
    spec: {
      rows: [
        { content: "Guilt", size: 100, col: "B1", marginTop: 140 },
        { content: "is not a", size: 32, col: "A4", marginTop: 40, align: "right" },
        { content: "job requirement.", size: 44, col: "A2", marginTop: 16 },
      ],
      marks: [
        { glyph: "[", mode: "singular", col: 1, row: 2, size: 280, opacity: 0.2 },
        { glyph: "]", mode: "singular", col: 8, row: 6, size: 280, opacity: 0.2 },
        { glyph: "#", mode: "pattern", col: 1, row: 8, spanCols: 8, spanRows: 4, size: 28, opacity: 0.4 },
        { glyph: ">", mode: "pattern", col: 9, row: 9, spanCols: 4, spanRows: 3, size: 24, opacity: 0.35 },
      ],
      contrast: "balanced",
      logo: { col: "A1", position: "bottom" },
      ratio: "1:1",
    },
  },
  {
    name: "data-scatter",
    spec: {
      rows: [
        { content: "When did", size: 44, col: "A1", marginTop: 80 },
        { content: "you last", size: 44, col: "B2", marginTop: 12 },
        { content: "rest?", size: 140, col: "A1", marginTop: 30 },
      ],
      marks: [
        { glyph: "1", mode: "scatter", col: 5, row: 1, spanCols: 8, spanRows: 6, size: 28, opacity: 0.45 },
        { glyph: "0", mode: "scatter", col: 6, row: 6, spanCols: 7, spanRows: 6, size: 24, opacity: 0.35 },
        { glyph: "|", mode: "pattern", col: 4, row: 10, spanCols: 9, spanRows: 3, size: 20, opacity: 0.3 },
      ],
      contrast: "balanced",
      logo: { col: "B4", position: "bottom" },
      ratio: "4:5",
    },
  },
];
