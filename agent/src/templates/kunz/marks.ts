/**
 * Mark Generator
 *
 * Generates mark positions on a 12×12 grid based on rules.
 * Handles placement algorithms for different patterns.
 */

import type { MarkRule, Placement, TypographicMark } from "./rules";
import { getRules, densityToCount, getGlyphs } from "./rules";
import type { Analysis } from "./analyze";

// Grid cell position
export interface MarkPosition {
  row: number;      // 0-11
  col: number;      // 0-11
  glyph: TypographicMark;
  scale: number;    // Font size multiplier
  opacity: number;
}

const GRID_SIZE = 12;

// Seeded random for reproducibility
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Exclusion zones (normalized 0-1 coordinates)
export interface ExclusionZone {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Generate marks for an analysis
 */
export function generateMarks(
  analysis: Analysis,
  exclusionZones?: ExclusionZone[],
  canvasWidth: number = 1080,
  canvasHeight: number = 1080
): MarkPosition[] {
  const rules = getRules(analysis.type, analysis.mood);
  const marks: MarkPosition[] = [];

  // Create a seed from the text for consistent regeneration
  const seed = analysis.lines.reduce((acc, line) => {
    return acc + line.text.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  }, 0);
  const random = seededRandom(seed);

  for (const rule of rules) {
    const positions = getPositionsForPlacement(rule, random);
    const glyphs = getGlyphs(rule);
    const scaleMultiplier = rule.scale === "large" ? 1.5 : rule.scale === "small" ? 0.6 : 1.0;

    for (const pos of positions) {
      marks.push({
        row: pos.row,
        col: pos.col,
        glyph: glyphs[Math.floor(random() * glyphs.length)],
        scale: scaleMultiplier,
        opacity: rule.opacity ?? 0.5,
      });
    }
  }

  // Filter out marks in any exclusion zone
  if (exclusionZones && exclusionZones.length > 0) {
    return marks.filter(m => !isInAnyExclusionZone(m, exclusionZones, canvasWidth, canvasHeight));
  }

  return marks;
}

/**
 * Check if mark overlaps any exclusion zone
 * Exclusion zones are in normalized canvas coordinates (0-1)
 * Marks are on a 12x12 grid that starts at margin=60
 */
function isInAnyExclusionZone(
  mark: MarkPosition,
  zones: ExclusionZone[],
  width: number = 1080,
  height: number = 1080
): boolean {
  const margin = 60;
  const cellW = (width - margin * 2) / GRID_SIZE;
  const cellH = (height - margin * 2) / GRID_SIZE;

  // Convert grid position to normalized canvas coordinates
  const cellLeft = (margin + mark.col * cellW) / width;
  const cellRight = (margin + (mark.col + 1) * cellW) / width;
  const cellTop = (margin + mark.row * cellH) / height;
  const cellBottom = (margin + (mark.row + 1) * cellH) / height;

  for (const zone of zones) {
    // Check if cell overlaps with this zone
    const overlaps = !(
      cellBottom < zone.top ||
      cellTop > zone.bottom ||
      cellRight < zone.left ||
      cellLeft > zone.right
    );
    if (overlaps) return true;
  }

  return false;
}

/**
 * Get positions based on placement type
 */
function getPositionsForPlacement(
  rule: MarkRule,
  random: () => number
): { row: number; col: number }[] {
  const count = densityToCount(rule.density);

  switch (rule.placement) {
    case "scatter":
      return generateScatter(count, random);

    case "frame":
      return generateFrame(count, random);

    case "flow-down":
      return generateFlowDown(count, random);

    case "flow-up":
      return generateFlowUp(count, random);

    case "cluster":
      return generateCluster(count, random);

    case "line":
      return generateLine(count, random);

    case "corner-tl":
      return generateCorner(count, random, "tl");

    case "corner-br":
      return generateCorner(count, random, "br");

    case "center":
      return generateCenter(count, random);

    case "margin-left":
      return generateMargin(count, random, "left");

    case "margin-right":
      return generateMargin(count, random, "right");

    default:
      return generateScatter(count, random);
  }
}

// Placement generators

function generateScatter(count: number, random: () => number): { row: number; col: number }[] {
  const positions = new Set<string>();
  while (positions.size < count) {
    const row = Math.floor(random() * GRID_SIZE);
    const col = Math.floor(random() * GRID_SIZE);
    positions.add(`${row},${col}`);
  }
  return Array.from(positions).map(p => {
    const [row, col] = p.split(",").map(Number);
    return { row, col };
  });
}

function generateFrame(count: number, random: () => number): { row: number; col: number }[] {
  const positions: { row: number; col: number }[] = [];

  // Top and bottom edges
  for (let col = 0; col < GRID_SIZE; col++) {
    if (random() < 0.5) positions.push({ row: 0, col });
    if (random() < 0.5) positions.push({ row: GRID_SIZE - 1, col });
  }

  // Left and right edges (excluding corners)
  for (let row = 1; row < GRID_SIZE - 1; row++) {
    if (random() < 0.5) positions.push({ row, col: 0 });
    if (random() < 0.5) positions.push({ row, col: GRID_SIZE - 1 });
  }

  // Limit to count
  return positions.slice(0, count);
}

function generateFlowDown(count: number, random: () => number): { row: number; col: number }[] {
  const positions: { row: number; col: number }[] = [];
  const density = count / (GRID_SIZE * GRID_SIZE);

  for (let row = 0; row < GRID_SIZE; row++) {
    // More dense at top, sparser at bottom
    const rowDensity = density * (1 - row / GRID_SIZE);
    for (let col = 0; col < GRID_SIZE; col++) {
      if (random() < rowDensity * 2) {
        positions.push({ row, col });
      }
    }
  }

  return positions.slice(0, count);
}

function generateFlowUp(count: number, random: () => number): { row: number; col: number }[] {
  const positions: { row: number; col: number }[] = [];
  const density = count / (GRID_SIZE * GRID_SIZE);

  for (let row = GRID_SIZE - 1; row >= 0; row--) {
    // More dense at bottom, sparser at top
    const rowDensity = density * (row / GRID_SIZE);
    for (let col = 0; col < GRID_SIZE; col++) {
      if (random() < rowDensity * 2) {
        positions.push({ row, col });
      }
    }
  }

  return positions.slice(0, count);
}

function generateCluster(count: number, random: () => number): { row: number; col: number }[] {
  // Pick a center point
  const centerRow = 3 + Math.floor(random() * 6); // Middle area
  const centerCol = 3 + Math.floor(random() * 6);

  const positions: { row: number; col: number }[] = [];

  for (let i = 0; i < count; i++) {
    // Random offset from center (gaussian-ish distribution)
    const offsetRow = Math.round((random() - 0.5) * 4);
    const offsetCol = Math.round((random() - 0.5) * 4);

    const row = Math.max(0, Math.min(GRID_SIZE - 1, centerRow + offsetRow));
    const col = Math.max(0, Math.min(GRID_SIZE - 1, centerCol + offsetCol));

    positions.push({ row, col });
  }

  return positions;
}

function generateLine(count: number, random: () => number): { row: number; col: number }[] {
  const row = Math.floor(random() * GRID_SIZE);
  const positions: { row: number; col: number }[] = [];

  for (let col = 0; col < GRID_SIZE && positions.length < count; col++) {
    if (random() < 0.7) {
      positions.push({ row, col });
    }
  }

  return positions;
}

function generateCorner(
  count: number,
  random: () => number,
  corner: "tl" | "tr" | "bl" | "br"
): { row: number; col: number }[] {
  const positions: { row: number; col: number }[] = [];
  const size = 4; // Corner area size

  const rowStart = corner.includes("t") ? 0 : GRID_SIZE - size;
  const colStart = corner.includes("l") ? 0 : GRID_SIZE - size;

  for (let row = rowStart; row < rowStart + size && positions.length < count; row++) {
    for (let col = colStart; col < colStart + size && positions.length < count; col++) {
      if (random() < 0.5) {
        positions.push({ row, col });
      }
    }
  }

  return positions;
}

function generateCenter(count: number, random: () => number): { row: number; col: number }[] {
  const positions: { row: number; col: number }[] = [];
  const margin = 3; // Stay away from edges

  for (let i = 0; i < count; i++) {
    const row = margin + Math.floor(random() * (GRID_SIZE - margin * 2));
    const col = margin + Math.floor(random() * (GRID_SIZE - margin * 2));
    positions.push({ row, col });
  }

  return positions;
}

function generateMargin(
  count: number,
  random: () => number,
  side: "left" | "right"
): { row: number; col: number }[] {
  const positions: { row: number; col: number }[] = [];
  const col = side === "left" ? 0 : GRID_SIZE - 1;

  for (let row = 0; row < GRID_SIZE && positions.length < count; row++) {
    if (random() < 0.5) {
      positions.push({ row, col });
    }
  }

  return positions;
}
