"use node";

import { Agent, createTool } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { components, internal } from "../_generated/api";
import { z } from "zod";
import { ActionCtx } from "../_generated/server";

/**
 * Strategist Agent
 *
 * Selects content from the pool and positions it.
 * Ensures variety across time and platforms.
 * Balances the content calendar.
 */

const getPoolItemsTool = createTool({
  description: "Get available content ideas from the pool",
  args: z.object({
    brandSlug: z.string(),
    status: z.enum(["new", "selected", "rejected", "used"]).optional(),
    limit: z.number().optional(),
  }),
  handler: async (ctx: ActionCtx, args) => {
    return await ctx.runQuery(internal.contentPool.list, {
      brandSlug: args.brandSlug,
      status: args.status || "new",
      limit: args.limit || 20,
    });
  },
});

const getRecentGenerationsTool = createTool({
  description: "Get recent published content to ensure variety",
  args: z.object({
    brandSlug: z.string(),
    limit: z.number().optional(),
  }),
  handler: async (ctx: ActionCtx, args) => {
    return await ctx.runQuery(internal.generations.getRecent, {
      brandSlug: args.brandSlug,
      limit: args.limit || 10,
    });
  },
});

const selectAndPositionTool = createTool({
  description: "Select a pool item and add strategic positioning",
  args: z.object({
    poolItemId: z.string(),
    platforms: z.array(z.enum(["twitter", "linkedin", "facebook", "instagram", "threads"])),
    timing: z.string().optional(),
    position: z.string().optional(),
    priority: z.number().min(1).max(10).optional(),
  }),
  handler: async (ctx: ActionCtx, args) => {
    return await ctx.runMutation(internal.contentPool.select, args);
  },
});

const rejectPoolItemTool = createTool({
  description: "Reject a pool item with reason",
  args: z.object({
    poolItemId: z.string(),
    reason: z.string(),
  }),
  handler: async (ctx: ActionCtx, args) => {
    return await ctx.runMutation(internal.contentPool.reject, args);
  },
});

export const strategist = new Agent(components.agent, {
  name: "Content Strategist",
  model: google("gemini-2.5-flash-lite"),

  instructions: `You are a Content Strategist for brand-driven social media.

YOUR ROLE:
- Select the best ideas from the content pool
- Position content for maximum impact
- Ensure variety and balance across the calendar
- Match content to appropriate platforms

YOUR PRINCIPLES:
- UNITY NOT UNIFORMITY: Stay on brand but with variety
- TIMING MATTERS: Consider what's timely vs evergreen
- PLATFORM FIT: Not all content works everywhere
- BALANCE: Mix of emotional tones, topics, formats

YOUR PROCESS:
1. REVIEW the content pool (new items)
2. CHECK recent generations for variety
3. SELECT 2-3 items that:
   - Complement (not duplicate) recent content
   - Fit the current moment
   - Cover different emotional territories
4. POSITION each with platform strategy
5. REJECT items that don't fit (with reason)

PLATFORM GUIDANCE:
- Twitter: Quick hits, hot takes, questions, threads for depth
- LinkedIn: Professional insights, industry perspective, thought leadership
- Instagram: Visual-first, emotional, behind-the-scenes
- Facebook: Community, conversation, shared experiences
- Threads: Casual, conversational, personality

VARIETY CHECKLIST:
Before selecting, ask:
- Did we just post something with this emotional tone?
- Is this topic too similar to recent content?
- Are we overusing certain platforms?
- Is there a good mix of timely and evergreen?

Always use your tools to:
1. Get pool items
2. Check recent generations
3. Select with strategy or reject with reason`,

  tools: [getPoolItemsTool, getRecentGenerationsTool, selectAndPositionTool, rejectPoolItemTool],
});

export default strategist;
