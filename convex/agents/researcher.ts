"use node";

import { Agent, createTool } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { components, internal } from "../_generated/api";
import { z } from "zod";
import { ActionCtx } from "../_generated/server";

/**
 * Researcher Agent
 *
 * Scans for content opportunities for each brand.
 * Creates a pool of ideas with unique angles.
 * Focuses on finding the non-obvious, the timely, the resonant.
 */

const getBrandTool = createTool({
  description: "Get brand profile including topics, voice, and audience",
  args: z.object({
    brandSlug: z.string(),
  }),
  handler: async (ctx: ActionCtx, args: { brandSlug: string }) => {
    return await ctx.runQuery(internal.brands.getBySlug, { slug: args.brandSlug });
  },
});

const getRecentPoolItemsTool = createTool({
  description: "Get recent content pool items to avoid duplicating ideas",
  args: z.object({
    brandSlug: z.string(),
    limit: z.number().optional(),
  }),
  handler: async (ctx: ActionCtx, args: { brandSlug: string; limit?: number }) => {
    return await ctx.runQuery(internal.contentPool.getRecent, {
      brandSlug: args.brandSlug,
      limit: args.limit || 20,
    });
  },
});

const addToPoolTool = createTool({
  description: "Add a content idea to the pool for strategist review",
  args: z.object({
    brandSlug: z.string(),
    topic: z.string(),
    angle: z.string(),
    hook: z.string().optional(),
    context: z.string().optional(),
    relevance: z.number().min(1).max(10),
    timeliness: z.enum(["evergreen", "trending", "seasonal", "timely"]).optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
  }),
  handler: async (ctx: ActionCtx, args) => {
    return await ctx.runMutation(internal.contentPool.add, args);
  },
});

export const researcher = new Agent(components.agent, {
  name: "Researcher",
  model: google("gemini-2.5-flash-lite"),

  instructions: `You are a Content Researcher for brand-driven social media.

YOUR ROLE:
- Find content opportunities that resonate with the brand's audience
- Discover unique angles on familiar topics
- Identify timely hooks and cultural moments
- Build a diverse pool of ideas (NOT a list of generic topics)

YOUR PROCESS:
1. STUDY the brand's topics, voice, and audience
2. REVIEW recent pool items to avoid duplication
3. EXPLORE each topic area for:
   - Unexpected angles
   - Timely hooks (current events, seasons, awareness days)
   - Emotional entry points
   - Contrarian takes that still feel on-brand
4. GENERATE 5-10 ideas per research session
5. ADD each idea to the pool with relevance score

WHAT MAKES A GOOD IDEA:
- Has a specific ANGLE, not just a topic
- Could only come from THIS brand (brand-specific POV)
- Has a clear emotional hook
- Isn't the first thing everyone thinks of
- Can be visualized in an interesting way

EXAMPLES:

Topic Area: "caregiver burnout"
BAD IDEA: "Tips for managing caregiver stress"
GOOD IDEA: {
  topic: "The permission no one gives caregivers",
  angle: "Reframing 'me time' as necessary medicine, not luxury",
  hook: "What if your rest wasn't selfish?",
  context: "Mental Health Awareness Month",
  relevance: 9
}

Topic Area: "building support networks"
BAD IDEA: "Why community matters for caregivers"
GOOD IDEA: {
  topic: "The 3am text thread",
  angle: "The informal support networks caregivers build in the cracks",
  hook: "Who do you text when it's 3am and you can't sleep?",
  relevance: 8
}

Always use your tools to:
1. Get the brand profile first
2. Check recent pool items
3. Add each new idea to the pool`,

  tools: [getBrandTool, getRecentPoolItemsTool, addToPoolTool],
});

export default researcher;
