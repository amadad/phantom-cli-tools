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

// Typographic marks as graphic devices - concrete poetry vocabulary
type TypographicMark =
  // Footnote/invisible labor
  | "*"      // asterisk — the fine print, overlooked labor
  | "†"      // dagger — second footnote, deeper invisible
  // Accumulation/growth
  | "+"      // plus — positive feedback, adding up
  | "×"      // multiply — compounding effect
  // Ratio/transformation
  | ":"      // colon — ratio, before:after
  | "/"      // slash — division, fraction
  | "~"      // tilde — approximate, unmeasured
  // Time/duration
  | "—"      // em dash — pause, breath
  | "|"      // pipe — timeline, sequence
  // Measurement/quantification
  | "%"      // percent — making visible
  | "#"      // hash — data structure, tagging
  // Points/presence
  | "."      // period — data point, minimal
  | "·"      // middle dot — softer presence
  | "○"      // empty circle — potential, unfilled
  | "●"      // filled circle — complete, recognized
  // Structure/containment
  | "[" | "]"  // brackets — capture, framing
  | "(" | ")"  // parens — aside, qualifier
  // Flow/direction
  | ">" | "<"; // arrows — input, output

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
 * CONCRETE POETRY EXAMPLES
 *
 * Each example draws from viral hook categories:
 * - transformation: before/after, journey (invisible → visible)
 * - question: rhetorical pull, suspended meaning
 * - statistic: data-driven punch, numbers as truth
 * - story: narrative arc, testimony, lived experience
 *
 * Mark semantics (form = content):
 * - * asterisk: footnote, the overlooked, invisible labor
 * - ○→● circles: empty→full, potential→recognized
 * - [ ] brackets: containment, capture, framing experience
 * - > arrows: flow, direction, output
 * - | pipes: timeline, sequence, duration
 * - % : measurement, quantification, making visible
 * - + : positive feedback, accumulation, growth
 * - ~ : approximate, unmeasured, estimated
 */
export const KUNZ_EXAMPLES: Array<{ name: string; spec: KunzSpec }> = [
  // ═══════════════════════════════════════════════════════════════════
  // TRANSFORMATION - Before/After, invisible → visible
  // Hook pattern: Journey, metamorphosis, "I used to... now I..."
  // ═══════════════════════════════════════════════════════════════════
  {
    name: "transform-emerge",
    // Asterisks (footnotes/invisible) → filled circles (visible/recognized)
    // The overlooked becoming seen - GiveCare mission as visual
    spec: {
      rows: [
        { content: "The invisible", size: 48, col: "A1", marginTop: 300 },
        { content: "made visible.", size: 72, col: "B2", marginTop: 12 },
      ],
      marks: [
        // LEFT: asterisks (invisible labor, footnotes nobody reads)
        { glyph: "*", mode: "pattern", col: 1, row: 1, spanCols: 4, spanRows: 5, size: 28, opacity: 0.2 },
        { glyph: "*", mode: "scatter", col: 1, row: 6, spanCols: 4, spanRows: 5, size: 24, opacity: 0.15 },
        // CENTER: transitional (tildes = approximate, unmeasured)
        { glyph: "~", mode: "scatter", col: 5, row: 2, spanCols: 3, spanRows: 8, size: 26, opacity: 0.25 },
        // RIGHT: filled circles (visible, recognized, complete)
        { glyph: "●", mode: "pattern", col: 8, row: 1, spanCols: 5, spanRows: 5, size: 20, opacity: 0.5 },
        { glyph: "●", mode: "pattern", col: 9, row: 6, spanCols: 4, spanRows: 5, size: 16, opacity: 0.45 },
        // Output arrow: transformation complete
        { glyph: ">", mode: "singular", col: 11, row: 11, size: 48, opacity: 0.4 },
      ],
      contrast: "quiet-loud",
      logo: { col: "A1", position: "bottom" },
      ratio: "1:1",
    },
  },
  {
    name: "transform-hours",
    // Hours accumulating → becoming measured → becoming recognized
    // Pipes show timeline, % shows measurement, > shows output
    spec: {
      rows: [
        { content: "24", size: 200, col: "A1", marginTop: 60 },
        { content: "hours a week", size: 48, col: "B3", marginTop: 20 },
        { content: "Now counted.", size: 32, col: "A2", marginTop: 80 },
      ],
      marks: [
        // Timeline pipes stacking up (hours accumulating)
        { glyph: "|", mode: "pattern", col: 8, row: 1, spanCols: 1, spanRows: 8, size: 24, opacity: 0.4 },
        { glyph: "|", mode: "pattern", col: 9, row: 2, spanCols: 1, spanRows: 7, size: 24, opacity: 0.35 },
        { glyph: "|", mode: "pattern", col: 10, row: 3, spanCols: 1, spanRows: 6, size: 24, opacity: 0.3 },
        // Percentages at bottom (measurement happening)
        { glyph: "%", mode: "pattern", col: 6, row: 9, spanCols: 6, spanRows: 3, size: 32, opacity: 0.45 },
        // Output arrow (recognition)
        { glyph: ">", mode: "pattern", col: 11, row: 11, spanCols: 2, spanRows: 2, size: 28, opacity: 0.5 },
      ],
      contrast: "balanced",
      logo: { col: "A5", position: "bottom" },
      ratio: "1:1",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // QUESTION - Rhetorical pull, suspended meaning
  // Hook pattern: "Do you...?", "What if...?", "Have you ever...?"
  // ═══════════════════════════════════════════════════════════════════
  {
    name: "question-container",
    // Brackets create empty space - the question is a container awaiting answer
    // From viral hook: "Do you want me to tell you about my mom?"
    spec: {
      rows: [
        { content: "Do you want me", size: 44, col: "A1", marginTop: 200 },
        { content: "to tell you", size: 44, col: "B2", marginTop: 8 },
        { content: "about caregiving?", size: 64, col: "A1", marginTop: 12 },
      ],
      marks: [
        // Large brackets framing emptiness (answer space)
        { glyph: "[", mode: "singular", col: 1, row: 1, size: 320, opacity: 0.2 },
        { glyph: "]", mode: "singular", col: 10, row: 1, size: 320, opacity: 0.2 },
        // Empty circles waiting to be filled (potential answers)
        { glyph: "○", mode: "scatter", col: 3, row: 4, spanCols: 6, spanRows: 3, size: 18, opacity: 0.2 },
        { glyph: "○", mode: "scatter", col: 4, row: 7, spanCols: 5, spanRows: 3, size: 16, opacity: 0.15 },
        // Colons at edge (uncertainty, waiting)
        { glyph: ":", mode: "pattern", col: 11, row: 8, spanCols: 2, spanRows: 4, size: 28, opacity: 0.35 },
      ],
      contrast: "quiet-loud",
      logo: { col: "B4", position: "bottom" },
      ratio: "1:1",
    },
  },
  {
    name: "question-rest",
    // Question suspended in negative space
    // Minimal marks - the emptiness IS the answer
    spec: {
      rows: [
        { content: "When did", size: 44, col: "A1", marginTop: 100 },
        { content: "you last", size: 44, col: "A2", marginTop: 12 },
        { content: "rest?", size: 160, col: "A1", marginTop: 40 },
      ],
      marks: [
        // Empty center - the rest that isn't happening
        // Only sparse marks at edges (constant activity, no pause)
        { glyph: "|", mode: "pattern", col: 10, row: 1, spanCols: 3, spanRows: 4, size: 20, opacity: 0.25 },
        { glyph: "|", mode: "pattern", col: 11, row: 5, spanCols: 2, spanRows: 3, size: 18, opacity: 0.2 },
        // Faint dashes at bottom (pauses that don't happen)
        { glyph: "—", mode: "scatter", col: 8, row: 9, spanCols: 5, spanRows: 4, size: 16, opacity: 0.15 },
      ],
      contrast: "loud-quiet",
      logo: { col: "B4", position: "bottom" },
      ratio: "4:5",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // STATISTIC - Data-driven punch
  // Hook pattern: "X million...", "1 in 5...", shocking number
  // ═══════════════════════════════════════════════════════════════════
  {
    name: "stat-coalesce",
    // Dots coalescing INTO the statistic
    // Scattered points → meaningful number
    spec: {
      rows: [
        { content: "53", size: 280, col: "A1", marginTop: 80 },
        { content: "million", size: 64, col: "B3", marginTop: 0 },
        { content: "caregivers", size: 40, col: "A4", marginTop: 40 },
      ],
      marks: [
        // Dots FLOWING TOWARD the number (points becoming statistic)
        { glyph: "·", mode: "pattern", col: 7, row: 1, spanCols: 6, spanRows: 3, size: 24, opacity: 0.5 },
        { glyph: "·", mode: "pattern", col: 8, row: 4, spanCols: 5, spanRows: 3, size: 20, opacity: 0.4 },
        { glyph: "·", mode: "scatter", col: 9, row: 7, spanCols: 4, spanRows: 3, size: 18, opacity: 0.35 },
        // Arrows pointing toward the stat
        { glyph: ">", mode: "singular", col: 6, row: 3, size: 40, opacity: 0.3 },
        { glyph: ">", mode: "singular", col: 7, row: 5, size: 36, opacity: 0.25 },
        // Hash marks at bottom (counting, tallying)
        { glyph: "#", mode: "pattern", col: 1, row: 9, spanCols: 4, spanRows: 3, size: 28, opacity: 0.35 },
      ],
      contrast: "balanced",
      logo: { col: "A5", position: "bottom" },
      ratio: "1:1",
    },
  },
  {
    name: "stat-fraction",
    // "1 in 5" - fractions as truth
    // Colons and slashes as ratio marks
    spec: {
      rows: [
        { content: "1 in 5", size: 140, col: "A1", marginTop: 80 },
        { content: "caregivers report", size: 36, col: "B2", marginTop: 60 },
        { content: "high emotional stress.", size: 36, col: "A3", marginTop: 8 },
      ],
      marks: [
        // Colons as ratio marks (the fraction concept)
        { glyph: ":", mode: "pattern", col: 8, row: 1, spanCols: 5, spanRows: 3, size: 36, opacity: 0.45 },
        // Slashes (division, fraction)
        { glyph: "/", mode: "pattern", col: 9, row: 5, spanCols: 4, spanRows: 3, size: 28, opacity: 0.4 },
        // Dots at bottom (the individuals being counted)
        { glyph: "·", mode: "scatter", col: 1, row: 8, spanCols: 6, spanRows: 4, size: 20, opacity: 0.3 },
        // Brackets containing the measured experience
        { glyph: "[", mode: "singular", col: 7, row: 9, size: 120, opacity: 0.2 },
        { glyph: "]", mode: "singular", col: 11, row: 9, size: 120, opacity: 0.2 },
      ],
      contrast: "balanced",
      logo: { col: "A1", position: "bottom" },
      ratio: "1:1",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // STORY - Narrative hook, testimony, lived experience
  // Hook pattern: "This was the last...", "I remember when...", raw honesty
  // ═══════════════════════════════════════════════════════════════════
  {
    name: "story-capture",
    // Quote captured in brackets
    // Raw testimony being witnessed, validated
    spec: {
      rows: [
        { content: '"I forgot', size: 56, col: "A1", marginTop: 140 },
        { content: "what it feels like", size: 56, col: "B2", marginTop: 8 },
        { content: 'to not be tired."', size: 56, col: "A1", marginTop: 8 },
        { content: "— Anonymous caregiver", size: 20, col: "A4", marginTop: 80, align: "right" },
      ],
      marks: [
        // Large brackets CAPTURING the testimony (witnessing)
        { glyph: "[", mode: "singular", col: 1, row: 2, size: 200, opacity: 0.25 },
        { glyph: "]", mode: "singular", col: 7, row: 5, size: 200, opacity: 0.25 },
        // Asterisks (footnotes - the overlooked experiences)
        { glyph: "*", mode: "pattern", col: 8, row: 2, spanCols: 5, spanRows: 4, size: 20, opacity: 0.35 },
        { glyph: "*", mode: "pattern", col: 9, row: 6, spanCols: 4, spanRows: 3, size: 18, opacity: 0.25 },
        // Hash tags (data identity, categorization)
        { glyph: "#", mode: "scatter", col: 8, row: 9, spanCols: 5, spanRows: 3, size: 16, opacity: 0.25 },
      ],
      contrast: "balanced",
      logo: { col: "B4", position: "bottom" },
      ratio: "1:1",
    },
  },
  {
    name: "story-timeline",
    // Pipes creating timeline of caregiving journey
    // Sequential marks showing duration, persistence
    spec: {
      rows: [
        { content: "Year one.", size: 36, col: "A1", marginTop: 120 },
        { content: "Year five.", size: 48, col: "B2", marginTop: 80 },
        { content: "Year twelve.", size: 64, col: "A1", marginTop: 80 },
        { content: "Still here.", size: 80, col: "B2", marginTop: 80 },
      ],
      marks: [
        // Vertical pipes as timeline (duration)
        { glyph: "|", mode: "pattern", col: 10, row: 1, spanCols: 1, spanRows: 11, size: 24, opacity: 0.45 },
        { glyph: "|", mode: "pattern", col: 11, row: 2, spanCols: 1, spanRows: 9, size: 22, opacity: 0.35 },
        { glyph: "|", mode: "pattern", col: 12, row: 3, spanCols: 1, spanRows: 7, size: 20, opacity: 0.25 },
        // Plus marks at year positions (milestones, additions)
        { glyph: "+", mode: "singular", col: 10, row: 2, size: 28, opacity: 0.5 },
        { glyph: "+", mode: "singular", col: 10, row: 5, size: 28, opacity: 0.5 },
        { glyph: "+", mode: "singular", col: 10, row: 8, size: 28, opacity: 0.5 },
        { glyph: "+", mode: "singular", col: 10, row: 11, size: 28, opacity: 0.5 },
      ],
      contrast: "quiet-loud",
      logo: { col: "A1", position: "bottom" },
      ratio: "9:16",
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // HYBRID - Combining multiple hook types
  // ═══════════════════════════════════════════════════════════════════
  {
    name: "hybrid-affirmation",
    // Transformation + Story: affirmation with positive feedback
    // Plus signs accumulating, arrows growing
    spec: {
      rows: [
        { content: "You're doing", size: 52, col: "A1", marginTop: 200 },
        { content: "better than", size: 52, col: "B2", marginTop: 8 },
        { content: "you think.", size: 84, col: "A1", marginTop: 12 },
      ],
      marks: [
        // Plus signs accumulating (positive feedback)
        { glyph: "+", mode: "pattern", col: 8, row: 1, spanCols: 5, spanRows: 4, size: 32, opacity: 0.5 },
        { glyph: "+", mode: "pattern", col: 9, row: 5, spanCols: 4, spanRows: 3, size: 28, opacity: 0.4 },
        // Arrows showing growth direction
        { glyph: ">", mode: "pattern", col: 10, row: 9, spanCols: 3, spanRows: 3, size: 24, opacity: 0.35 },
        // Filled circle at end (you, complete, recognized)
        { glyph: "●", mode: "singular", col: 12, row: 11, size: 32, opacity: 0.5 },
      ],
      contrast: "balanced",
      logo: { col: "A5", position: "bottom" },
      ratio: "1:1",
    },
  },
  {
    name: "hybrid-reframe",
    // Question + Transformation: reframing burnout
    // Hash noise → clearing → clean output
    spec: {
      rows: [
        { content: "Burnout", size: 100, col: "A1", marginTop: 80 },
        { content: "is not", size: 40, col: "B3", marginTop: 40 },
        { content: "a badge", size: 60, col: "A2", marginTop: 20 },
        { content: "of honor.", size: 60, col: "B2", marginTop: 8 },
      ],
      marks: [
        // Dense hash marks at top (the noise of "hustle culture")
        { glyph: "#", mode: "pattern", col: 7, row: 1, spanCols: 6, spanRows: 3, size: 24, opacity: 0.4 },
        // Tildes in middle (approximate, unmeasured exhaustion)
        { glyph: "~", mode: "scatter", col: 8, row: 5, spanCols: 5, spanRows: 3, size: 18, opacity: 0.25 },
        // Clean output at bottom (new understanding)
        { glyph: ">", mode: "pattern", col: 9, row: 9, spanCols: 4, spanRows: 3, size: 28, opacity: 0.45 },
        { glyph: "●", mode: "singular", col: 12, row: 11, size: 28, opacity: 0.5 },
      ],
      contrast: "balanced",
      logo: { col: "A1", position: "bottom" },
      ratio: "1:1",
    },
  },
  {
    name: "hybrid-count",
    // Statistic + Story: "Every moment counts" with dots accumulating
    spec: {
      rows: [
        { content: "Every", size: 48, col: "A1", marginTop: 60 },
        { content: "moment", size: 120, col: "B1", marginTop: 20 },
        { content: "counts.", size: 48, col: "A3", marginTop: 40 },
      ],
      marks: [
        // Dots accumulating in waves (moments being counted)
        { glyph: "·", mode: "pattern", col: 1, row: 6, spanCols: 4, spanRows: 3, size: 24, opacity: 0.4 },
        { glyph: "·", mode: "pattern", col: 3, row: 8, spanCols: 5, spanRows: 3, size: 22, opacity: 0.35 },
        { glyph: "·", mode: "pattern", col: 5, row: 10, spanCols: 6, spanRows: 3, size: 20, opacity: 0.3 },
        // Percentage (quantification)
        { glyph: "%", mode: "singular", col: 11, row: 6, size: 56, opacity: 0.45 },
        // Hash (recorded, counted)
        { glyph: "#", mode: "pattern", col: 10, row: 9, spanCols: 3, spanRows: 3, size: 20, opacity: 0.3 },
      ],
      contrast: "quiet-loud",
      logo: { col: "B4", position: "bottom" },
      ratio: "4:5",
    },
  },
  {
    name: "hybrid-value",
    // Transformation: asterisks (overlooked) → filled circles (valued)
    spec: {
      rows: [
        { content: "Your time", size: 72, col: "A1", marginTop: 200 },
        { content: "has value.", size: 72, col: "B2", marginTop: 12 },
      ],
      marks: [
        // Asterisks becoming filled circles (overlooked → valued)
        { glyph: "*", mode: "scatter", col: 1, row: 1, spanCols: 5, spanRows: 4, size: 22, opacity: 0.2 },
        { glyph: "●", mode: "pattern", col: 7, row: 1, spanCols: 6, spanRows: 4, size: 16, opacity: 0.45 },
        // Percentages and plus signs (measurement + value)
        { glyph: "%", mode: "pattern", col: 2, row: 8, spanCols: 5, spanRows: 4, size: 32, opacity: 0.4 },
        { glyph: "+", mode: "pattern", col: 8, row: 9, spanCols: 5, spanRows: 4, size: 28, opacity: 0.35 },
      ],
      contrast: "balanced",
      logo: { col: "A1", position: "bottom" },
      ratio: "1:1",
    },
  },
];
