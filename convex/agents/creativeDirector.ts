"use node";

import { Agent, createTool } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { components, internal } from "../_generated/api";
import { z } from "zod";
import { ActionCtx } from "../_generated/server";

/**
 * Creative Director Agent
 *
 * Shapes the aesthetic choices for each piece of content.
 * Ensures visual variety while maintaining brand unity.
 * Creates unexpected, emotionally resonant visual concepts.
 */

const getBrandTool = createTool({
  description: "Get brand profile including visual style and image direction",
  args: z.object({
    brandSlug: z.string(),
  }),
  handler: async (ctx: ActionCtx, args: { brandSlug: string }) => {
    return await ctx.runQuery(internal.brands.getBySlug, { slug: args.brandSlug });
  },
});

const getAestheticHistoryTool = createTool({
  description: "Get recent aesthetic choices to ensure variety (unity not uniformity)",
  args: z.object({
    brandSlug: z.string(),
    limit: z.number().optional(),
  }),
  handler: async (ctx: ActionCtx, args: { brandSlug: string; limit?: number }) => {
    return await ctx.runQuery(internal.aestheticHistory.getRecent, {
      brandSlug: args.brandSlug,
      limit: args.limit || 10,
    });
  },
});

const checkClicheTool = createTool({
  description: "Check if a visual concept is a cliché",
  args: z.object({
    concept: z.string(),
  }),
  handler: async (_ctx: ActionCtx, args: { concept: string }) => {
    const cliches = [
      "person smiling at camera", "hands holding", "lightbulb",
      "puzzle pieces", "handshake", "team high five", "person at laptop",
      "coffee and laptop", "sunrise", "mountain peak", "road to horizon",
      "person looking stressed", "helping elderly", "medical professional",
      "heart hands", "diverse group smiling", "pointing at screen",
    ];

    const conceptLower = args.concept.toLowerCase();
    const isCliche = cliches.some((c) => conceptLower.includes(c));

    const genericPatterns = [
      /^a person/i, /^someone/i, /^a (man|woman) (sitting|standing)/i,
      /stock photo/i, /professional.*setting/i,
    ];
    const isGeneric = genericPatterns.some((p) => p.test(args.concept));

    return {
      isCliche,
      isGeneric,
      shouldReject: isCliche || isGeneric,
      suggestion: isCliche || isGeneric
        ? "Try: specific objects, unusual angles, metaphorical scenes, details over full scenes"
        : "Concept passes cliché check",
    };
  },
});

const getInspirationTool = createTool({
  description: "Browse inspiration library for reference prompts",
  args: z.object({
    category: z.string().optional(),
    aesthetic: z.string().optional(),
  }),
  handler: async (ctx: ActionCtx, args) => {
    return await ctx.runQuery(internal.inspirations.browse, args);
  },
});

export const creativeDirector = new Agent(components.agent, {
  name: "Creative Director",
  model: google("gemini-2.5-flash-lite"),

  instructions: `You are a Creative Director ensuring visual excellence and variety.

YOUR CORE PRINCIPLE: UNITY NOT UNIFORMITY
- Every piece should be unmistakably on-brand
- But no two pieces should look the same
- Variety in technique, subject, mood, angle
- Consistency in quality, feeling, emotional truth

YOUR ROLE:
1. Shape the visual concept for each content piece
2. Ensure it doesn't repeat recent aesthetic choices
3. Create detailed, specific image prompts
4. Reject clichés ruthlessly

BEFORE YOU CREATE, CHECK:
- Recent aesthetic choices (what moods, techniques, subjects have we used?)
- Brand image direction (what's in the toolkit?)
- Cliché detector (is this idea fresh?)

VARIETY DIMENSIONS TO ROTATE:
- MOOD: contemplative, hopeful, resilient, peaceful, empowering, tender
- TECHNIQUE: macro, silhouette, overhead, eye-level, shallow DOF, wide angle
- SUBJECT: hands, windows, nature, objects, spaces, moments
- COLOR TONE: warm, muted, high contrast, soft, golden, cool

PROMPT STRUCTURE (learn from examples):
Your image prompts should include:
1. Subject: What's in the frame, specifically
2. Pose/Arrangement: How elements are positioned
3. Lighting: Direction, quality, mood
4. Camera: Lens, angle, depth of field
5. Mood: Emotional atmosphere
6. Technical: Resolution, style references

EXAMPLE OUTPUT:
For topic "permission to rest":

CONCEPT: A single wilted but alive houseplant on a sunlit windowsill - metaphor for resilience through imperfect care

AESTHETIC_CHOICES:
- mood: tender resilience
- technique: macro with shallow DOF
- subject: nature/objects
- colorTone: warm muted

IMAGE_PROMPT: Extreme close-up of a small potted plant on a dusty windowsill, one leaf slightly yellowed but the plant still reaching toward the light. Late afternoon sun creating long shadows and a warm golden glow. Shallow depth of field (f/1.8), focus on the healthiest leaf. Dust particles visible in the light beam. Worn wooden windowsill with peeling paint. 35mm lens, eye-level. Editorial photography style, think Kinfolk magazine. Muted warm tones, slightly desaturated. Leave negative space on the left for text.

CRITICAL - DO NOT INCLUDE: stock photography poses, clinical settings, artificial smiles, generic AI art style, oversaturated colors, perfect symmetry, centered composition

Always use your tools to:
1. Get brand visual direction
2. Check aesthetic history for variety
3. Test concepts against cliché detector
4. Browse inspiration for reference`,

  tools: [getBrandTool, getAestheticHistoryTool, checkClicheTool, getInspirationTool],
});

export default creativeDirector;
