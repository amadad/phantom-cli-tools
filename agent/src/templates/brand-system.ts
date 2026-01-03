/**
 * GiveCare Brand System
 * Rules and primitives for autonomous design decisions
 * Unity, not uniformity
 */

// =============================================================================
// BRAND RULES (for LLM context)
// =============================================================================

export const BRAND_RULES = `
# GiveCare Brand System

You are a brand-aware designer creating social content for GiveCare,
a wellness platform for caregivers.

## Voice
- Warm, honest, empowering
- Second-person ("you") preferred
- Short sentences, human-first
- Never clinical or corporate

## Visual Principles
- UNITY, not uniformity — cohesive but varied
- Typography IS the visual — no stock photos
- Generous whitespace — let content breathe
- Editorial magazine aesthetic

## DO
- Use contrast to create hierarchy (size, weight, position)
- Vary logo placement (top/bottom) for rhythm across posts
- Match layout to content type (stats want impact, quotes want intimacy)
- Use the full canvas — edge-to-edge thinking
- Create tension and balance

## DON'T
- Center everything — asymmetry creates interest
- Use decorative elements (no flourishes, filigrees, icons)
- Go below minimum type sizes
- Use more than 2 text elements per composition
- Add drop shadows, gradients, or effects

## Typography Scale (2:1 ratio)
- Display: 64-80px (stats, single words, impact)
- Headline: 48-64px (questions, statements)
- Body: 32-40px (supporting text, quotes)
- Caption: 20-28px (attribution, taglines)
- MINIMUM: 20px — nothing smaller

## Color
- Background: cream (#F5EDE4) — always
- Text: brown (#54340E) — always
- Accent: orange (#FF9F1C) — sparingly, for emphasis only

## Spacing
- Margins: 60-100px from edges
- Between elements: 40-80px
- Logo: always centered horizontally

## Content-Layout Matching
| Content Type | Suggested Approach |
|--------------|-------------------|
| Question | Large, centered, logo top |
| Statistic | Huge number, small label, high contrast |
| Quote | Attribution separate from quote, logo bottom |
| Statement | Bold, can break conventional centering |
| Fact | "Did you know?" pattern, inverted emphasis |
`;

// =============================================================================
// PRIMITIVES (what the renderer has available)
// =============================================================================

export const PRIMITIVES = {
  colors: {
    cream: "#F5EDE4",
    brown: "#54340E",
    orange: "#FF9F1C",
  },

  fonts: {
    serif: "Alegreya",      // headlines, quotes
    display: "Gabarito",    // stats, impact (future)
  },

  scale: {
    display: { min: 64, max: 80 },
    headline: { min: 48, max: 64 },
    body: { min: 32, max: 40 },
    caption: { min: 20, max: 28 },
    minimum: 20,
  },

  spacing: {
    margin: { min: 60, max: 100 },
    gap: { min: 40, max: 80 },
  },

  ratios: {
    "1:1": { width: 1080, height: 1080, use: "instagram, facebook" },
    "4:5": { width: 1080, height: 1350, use: "instagram portrait, linkedin mobile" },
    "16:9": { width: 1200, height: 675, use: "twitter" },
    "1.91:1": { width: 1200, height: 628, use: "linkedin" },
    "9:16": { width: 1080, height: 1920, use: "stories, reels, shorts" },
  },
};

// =============================================================================
// DESIGN SPEC (what the LLM outputs)
// =============================================================================

export interface DesignSpec {
  // Content
  texts: Array<{
    content: string;
    role: "display" | "headline" | "body" | "caption";
    align?: "left" | "center" | "right";
  }>;

  // Layout
  logo: "top" | "bottom" | "none";
  vertical: "top" | "center" | "bottom" | "spread";  // where text cluster sits

  // Sizing (LLM picks from scale, renderer enforces bounds)
  sizing?: "impact" | "balanced" | "intimate";

  // Platform
  ratio: keyof typeof PRIMITIVES.ratios;

  // Optional: reasoning for the design choice
  rationale?: string;
}

// =============================================================================
// EXAMPLE SPECS (for LLM few-shot learning)
// =============================================================================

export const EXAMPLE_SPECS: Array<{ content: string; spec: DesignSpec }> = [
  {
    content: "Question about self-care for caregivers",
    spec: {
      texts: [
        { content: "When did you last take 20 minutes for yourself?", role: "headline", align: "center" },
        { content: "Wellness for caregivers.", role: "caption", align: "center" },
      ],
      logo: "top",
      vertical: "center",
      sizing: "balanced",
      ratio: "1:1",
      rationale: "Question invites reflection — centered, breathing room, logo grounds the brand",
    },
  },
  {
    content: "Statistic about caregiver population",
    spec: {
      texts: [
        { content: "53 million", role: "display", align: "center" },
        { content: "Americans are unpaid caregivers", role: "caption", align: "center" },
      ],
      logo: "top",
      vertical: "center",
      sizing: "impact",
      ratio: "1:1",
      rationale: "Stat needs impact — huge number, tiny label, maximum contrast",
    },
  },
  {
    content: "Quote from a caregiver",
    spec: {
      texts: [
        { content: '"Taking care of myself isn\'t selfish—it\'s survival."', role: "headline", align: "center" },
        { content: "— Sarah, caregiver for 12 years", role: "caption", align: "center" },
      ],
      logo: "bottom",
      vertical: "center",
      sizing: "intimate",
      ratio: "1:1",
      rationale: "Quote is personal — attribution separate, logo at bottom lets quote lead",
    },
  },
  {
    content: "Fact with setup",
    spec: {
      texts: [
        { content: "Did you know?", role: "body", align: "center" },
        { content: "Caregivers are 2x more likely to experience depression", role: "headline", align: "center" },
      ],
      logo: "top",
      vertical: "spread",
      sizing: "balanced",
      ratio: "1:1",
      rationale: "Inverted hierarchy — small setup, big payoff, spread vertically for tension",
    },
  },
  {
    content: "Bold statement for Twitter",
    spec: {
      texts: [
        { content: "You can't pour from an empty cup.", role: "headline", align: "center" },
      ],
      logo: "bottom",
      vertical: "center",
      sizing: "impact",
      ratio: "16:9",
      rationale: "Single powerful line — no supporting text needed, let it breathe",
    },
  },
];

// =============================================================================
// PROMPT BUILDER (constructs context for LLM)
// =============================================================================

export function buildDesignPrompt(contentBrief: string): string {
  return `${BRAND_RULES}

## Your Task
Design a social media graphic for this content:
"${contentBrief}"

## Examples
${EXAMPLE_SPECS.map(ex => `
Content: "${ex.content}"
Design: ${JSON.stringify(ex.spec, null, 2)}
`).join("\n")}

## Output
Respond with a DesignSpec JSON object. Include your rationale.
`;
}
