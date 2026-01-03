/**
 * Content Analysis Layer
 *
 * Parses text to detect:
 * - Hook type (question, statistic, story, transformation, affirmation)
 * - Emphasis words (what to highlight)
 * - Mood (intimate, bold, urgent, calm)
 * - Optimal line break points
 */

export type HookType =
  | "question"        // Ends with ?, rhetorical pull
  | "statistic"       // Contains numbers, data-driven
  | "story"           // Has quotes, testimonial
  | "transformation"  // Before/after, journey
  | "affirmation";    // Positive statement, encouragement

export type Mood = "intimate" | "bold" | "urgent" | "calm";

export interface Analysis {
  type: HookType;
  emphasis: string[];      // Words/phrases to highlight
  mood: Mood;
  lines: LineBreak[];      // Suggested line breaks
  numbers: string[];       // Extracted numbers for special treatment
}

export interface LineBreak {
  text: string;
  isEmphasis: boolean;     // Should this line be larger?
  weight: number;          // Relative visual weight (0.8 - 1.4)
}

// Words that make good break points (break BEFORE these)
const BREAK_BEFORE = ["to", "about", "and", "but", "for", "with", "that", "is", "are", "of"];

// Words that indicate emphasis when at end
const EMPHASIS_PATTERNS = [
  /\?$/,                   // Questions
  /\.$/,                   // Final statements
  /[""].+[""]$/,           // Quoted phrases
];

// Detect hook type from text patterns
export function detectType(text: string): HookType {
  const lower = text.toLowerCase();

  // Question: ends with ?
  if (text.trim().endsWith("?")) {
    return "question";
  }

  // Statistic: contains numbers (not just "1" or "a")
  const numbers = text.match(/\d+[\d,.]*/g);
  if (numbers && numbers.some(n => parseInt(n.replace(/,/g, "")) > 1)) {
    return "statistic";
  }

  // Story: has quotes
  if (/[""][^""]+[""]/.test(text)) {
    return "story";
  }

  // Transformation: contains transformation words
  const transformWords = ["invisible", "visible", "become", "now", "finally", "counted", "recognized"];
  if (transformWords.some(w => lower.includes(w))) {
    return "transformation";
  }

  // Affirmation: positive statements with "you"
  const affirmWords = ["you're", "you are", "your", "better", "matter", "doing", "okay", "worth"];
  if (affirmWords.some(w => lower.includes(w))) {
    return "affirmation";
  }

  // Default to transformation (GiveCare's core message)
  return "transformation";
}

// Detect mood from text patterns
export function detectMood(text: string, type: HookType): Mood {
  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).length;

  // Short + question + "you" = intimate
  if (type === "question" && lower.includes("you") && wordCount < 15) {
    return "intimate";
  }

  // Statistics are authoritative = bold
  if (type === "statistic") {
    return "bold";
  }

  // Short, punchy statements = urgent
  if (wordCount < 8 && !text.includes(",")) {
    return "urgent";
  }

  // Affirmations are calm
  if (type === "affirmation") {
    return "calm";
  }

  // Quotes/stories are intimate
  if (type === "story") {
    return "intimate";
  }

  return "calm";
}

// Find emphasis - what words should be highlighted
export function findEmphasis(text: string): string[] {
  const emphasis: string[] = [];

  // Last 1-3 words if short phrase
  const words = text.replace(/[?.!,""]$/g, "").split(/\s+/);
  if (words.length >= 3) {
    const lastWords = words.slice(-3).join(" ");
    if (lastWords.length < 20) {
      emphasis.push(lastWords);
    } else {
      const lastTwo = words.slice(-2).join(" ");
      if (lastTwo.length < 15) {
        emphasis.push(lastTwo);
      }
    }
  }

  // Numbers are always emphasis
  const numbers = text.match(/\d+[\d,.]*/g);
  if (numbers) {
    emphasis.push(...numbers);
  }

  // Quoted content
  const quotes = text.match(/[""]([^""]+)[""]/);
  if (quotes) {
    emphasis.push(quotes[1]);
  }

  return emphasis;
}

// Extract numbers for special treatment
export function extractNumbers(text: string): string[] {
  const matches = text.match(/\d+[\d,.]*/g);
  return matches || [];
}

// Smart line breaking
export function findBreakPoints(text: string, maxLines: number = 5): LineBreak[] {
  const words = text.split(/\s+/);

  if (words.length <= 3) {
    // Very short - one line
    return [{ text, isEmphasis: true, weight: 1.4 }];
  }

  const lines: LineBreak[] = [];
  let currentLine: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const nextWord = words[i + 1];

    currentLine.push(word);

    // Should we break here?
    const shouldBreak =
      // Break before connector words (if not first word of line)
      (nextWord && BREAK_BEFORE.includes(nextWord.toLowerCase()) && currentLine.length >= 2) ||
      // Break after punctuation
      /[,;:]$/.test(word) ||
      // Don't let lines get too long
      currentLine.length >= 6;

    if (shouldBreak && i < words.length - 1) {
      lines.push({
        text: currentLine.join(" "),
        isEmphasis: false,
        weight: 1.0,
      });
      currentLine = [];
    }
  }

  // Push remaining words
  if (currentLine.length > 0) {
    lines.push({
      text: currentLine.join(" "),
      isEmphasis: true, // Last line often has the punch
      weight: 1.2,
    });
  }

  // Limit to maxLines
  if (lines.length > maxLines) {
    // Merge some lines
    const merged: LineBreak[] = [];
    for (let i = 0; i < lines.length; i += Math.ceil(lines.length / maxLines)) {
      const chunk = lines.slice(i, i + Math.ceil(lines.length / maxLines));
      merged.push({
        text: chunk.map(l => l.text).join(" "),
        isEmphasis: chunk.some(l => l.isEmphasis),
        weight: Math.max(...chunk.map(l => l.weight)),
      });
    }
    return merged;
  }

  // Adjust weights based on position and content
  return lines.map((line, i) => {
    const hasNumber = /\d/.test(line.text);
    const isLast = i === lines.length - 1;
    const isShort = line.text.split(/\s+/).length <= 3;

    return {
      ...line,
      weight: hasNumber ? 1.4 : isLast && isShort ? 1.3 : line.weight,
      isEmphasis: hasNumber || (isLast && isShort) || line.isEmphasis,
    };
  });
}

// Main analysis function
export function analyze(text: string): Analysis {
  const type = detectType(text);
  const mood = detectMood(text, type);
  const emphasis = findEmphasis(text);
  const numbers = extractNumbers(text);
  const lines = findBreakPoints(text);

  return { type, mood, emphasis, numbers, lines };
}
