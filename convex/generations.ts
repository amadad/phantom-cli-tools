"use node";

import { v } from "convex/values";
import { action, mutation, query, internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { creativeDirector } from "./agents/creativeDirector";

/**
 * List generations for a brand
 */
export const list = query({
  args: {
    brandSlug: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { brandSlug, status, limit = 20 }) => {
    let q = ctx.db.query("generations").order("desc");

    if (status) {
      q = ctx.db
        .query("generations")
        .withIndex("by_status", (q) => q.eq("status", status as any))
        .order("desc");
    }

    const generations = await q.take(limit);

    // Optionally filter by brand after fetching
    if (brandSlug) {
      const brand = await ctx.db
        .query("brands")
        .withIndex("by_slug", (q) => q.eq("slug", brandSlug))
        .first();

      if (brand) {
        return generations.filter((g) => g.brandId === brand._id);
      }
    }

    return generations;
  },
});

/**
 * Get a single generation
 */
export const get = query({
  args: { id: v.id("generations") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/**
 * Create a new generation (internal)
 */
export const create = internalMutation({
  args: {
    brandId: v.id("brands"),
    topic: v.string(),
  },
  handler: async (ctx, { brandId, topic }) => {
    const now = Date.now();
    return await ctx.db.insert("generations", {
      brandId,
      topic,
      concept: {
        description: "",
        imagePrompt: "",
      },
      content: {},
      status: "generating",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update generation with concept from agent
 */
export const updateConcept = internalMutation({
  args: {
    id: v.id("generations"),
    concept: v.object({
      description: v.string(),
      reasoning: v.optional(v.string()),
      imagePrompt: v.string(),
    }),
    agentThreadId: v.optional(v.string()),
  },
  handler: async (ctx, { id, concept, agentThreadId }) => {
    await ctx.db.patch(id, {
      concept,
      agentThreadId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update generation with image
 */
export const updateImage = internalMutation({
  args: {
    id: v.id("generations"),
    image: v.object({
      url: v.string(),
      model: v.string(),
      prompt: v.string(),
    }),
  },
  handler: async (ctx, { id, image }) => {
    await ctx.db.patch(id, {
      image,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update generation with copy
 */
export const updateContent = internalMutation({
  args: {
    id: v.id("generations"),
    content: v.object({
      twitter: v.optional(v.object({
        text: v.string(),
        hashtags: v.array(v.string()),
      })),
      linkedin: v.optional(v.object({
        text: v.string(),
        hashtags: v.array(v.string()),
      })),
      facebook: v.optional(v.object({
        text: v.string(),
        hashtags: v.array(v.string()),
      })),
      instagram: v.optional(v.object({
        text: v.string(),
        hashtags: v.array(v.string()),
      })),
      threads: v.optional(v.object({
        text: v.string(),
        hashtags: v.array(v.string()),
      })),
    }),
    status: v.optional(v.union(
      v.literal("generating"),
      v.literal("review"),
      v.literal("approved"),
      v.literal("scheduled"),
      v.literal("published"),
      v.literal("failed")
    )),
  },
  handler: async (ctx, { id, content, status }) => {
    const update: any = {
      content,
      updatedAt: Date.now(),
    };
    if (status) {
      update.status = status;
    }
    await ctx.db.patch(id, update);
  },
});

/**
 * Update generation status
 */
export const updateStatus = internalMutation({
  args: {
    id: v.id("generations"),
    status: v.union(
      v.literal("generating"),
      v.literal("review"),
      v.literal("approved"),
      v.literal("scheduled"),
      v.literal("published"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, error }) => {
    const update: any = {
      status,
      updatedAt: Date.now(),
    };
    if (error) {
      update.error = error;
    }
    await ctx.db.patch(id, update);
  },
});

/**
 * Main generation action - orchestrates the Creative Director agent
 */
export const generate = action({
  args: {
    brandSlug: v.string(),
    topic: v.string(),
  },
  handler: async (ctx, { brandSlug, topic }) => {
    console.log(`[generate] Starting generation for "${topic}" with brand "${brandSlug}"`);

    // Get brand
    const brand = await ctx.runQuery(api.brands.get, { slug: brandSlug });
    if (!brand) {
      throw new Error(`Brand not found: ${brandSlug}`);
    }

    // Create generation record
    const generationId = await ctx.runMutation(internal.generations.create, {
      brandId: brand._id,
      topic,
    });

    console.log(`[generate] Created generation: ${generationId}`);

    try {
      // Step 1: Creative Director generates concept
      console.log(`[generate] Asking Creative Director for concept...`);

      const { thread } = await creativeDirector.createThread(ctx, {
        userId: brandSlug, // Use brand as user context
      });

      const conceptResult = await thread.generateText({
        prompt: `Generate a creative visual concept for this topic:

TOPIC: "${topic}"
BRAND: "${brandSlug}"

Use your tools to:
1. Get the full brand profile
2. Generate 3 creative concepts (not clichés!)
3. Check each concept for clichés
4. Evaluate each concept for brand fit
5. Select the best one and refine it

Return your final concept in this format:
CONCEPT: [Your one-sentence concept description]
REASONING: [Why this concept works for this brand and topic]
IMAGE_PROMPT: [Detailed prompt with lighting, composition, textures, mood - at least 3 sentences]`,
      });

      // Parse the response
      const responseText = conceptResult.text;
      console.log(`[generate] Creative Director response: ${responseText.substring(0, 200)}...`);

      // Extract concept parts
      const conceptMatch = responseText.match(/CONCEPT:\s*(.+?)(?=REASONING:|$)/s);
      const reasoningMatch = responseText.match(/REASONING:\s*(.+?)(?=IMAGE_PROMPT:|$)/s);
      const promptMatch = responseText.match(/IMAGE_PROMPT:\s*(.+?)$/s);

      const concept = {
        description: conceptMatch?.[1]?.trim() || responseText,
        reasoning: reasoningMatch?.[1]?.trim(),
        imagePrompt: promptMatch?.[1]?.trim() || responseText,
      };

      // Update generation with concept
      await ctx.runMutation(internal.generations.updateConcept, {
        id: generationId,
        concept,
        agentThreadId: thread.threadId,
      });

      console.log(`[generate] Concept saved: ${concept.description.substring(0, 100)}...`);

      // Step 2: Generate image (TODO: integrate with image generation API)
      // For now, we'll leave this for the next step

      // Step 3: Generate platform copy (TODO: separate copywriter agent or tool)
      // For now, use the Creative Director to also write copy

      const copyResult = await thread.generateText({
        prompt: `Now write social media copy for this concept:

CONCEPT: ${concept.description}
BRAND: ${brandSlug}

Write copy for each platform:
- Twitter: max 280 chars, 3 hashtags, punchy
- LinkedIn: max 3000 chars, 5 hashtags, professional
- Instagram: max 2200 chars, 5 hashtags, visual-first
- Facebook: community-focused, 3 hashtags
- Threads: conversational, 2 hashtags

Return in this format:
TWITTER_TEXT: [text without hashtags]
TWITTER_HASHTAGS: [hashtag1, hashtag2, hashtag3]
LINKEDIN_TEXT: [text without hashtags]
LINKEDIN_HASHTAGS: [hashtag1, hashtag2, hashtag3, hashtag4, hashtag5]
INSTAGRAM_TEXT: [text without hashtags]
INSTAGRAM_HASHTAGS: [hashtag1, hashtag2, hashtag3, hashtag4, hashtag5]
FACEBOOK_TEXT: [text without hashtags]
FACEBOOK_HASHTAGS: [hashtag1, hashtag2, hashtag3]
THREADS_TEXT: [text without hashtags]
THREADS_HASHTAGS: [hashtag1, hashtag2]`,
      });

      // Parse copy (simplified parsing)
      const copyText = copyResult.text;

      const parseSection = (key: string) => {
        const match = copyText.match(new RegExp(`${key}:\\s*(.+?)(?=[A-Z_]+:|$)`, 's'));
        return match?.[1]?.trim() || '';
      };

      const parseHashtags = (key: string) => {
        const match = copyText.match(new RegExp(`${key}:\\s*(.+?)(?=[A-Z_]+:|$)`, 's'));
        if (!match) return [];
        return match[1]
          .split(',')
          .map((h) => h.trim().replace(/^#/, ''))
          .filter(Boolean);
      };

      const content = {
        twitter: {
          text: parseSection('TWITTER_TEXT'),
          hashtags: parseHashtags('TWITTER_HASHTAGS'),
        },
        linkedin: {
          text: parseSection('LINKEDIN_TEXT'),
          hashtags: parseHashtags('LINKEDIN_HASHTAGS'),
        },
        instagram: {
          text: parseSection('INSTAGRAM_TEXT'),
          hashtags: parseHashtags('INSTAGRAM_HASHTAGS'),
        },
        facebook: {
          text: parseSection('FACEBOOK_TEXT'),
          hashtags: parseHashtags('FACEBOOK_HASHTAGS'),
        },
        threads: {
          text: parseSection('THREADS_TEXT'),
          hashtags: parseHashtags('THREADS_HASHTAGS'),
        },
      };

      // Update generation with copy and set to review
      await ctx.runMutation(internal.generations.updateContent, {
        id: generationId,
        content,
        status: "review",
      });

      console.log(`[generate] Generation complete: ${generationId}`);

      return {
        success: true,
        generationId,
        concept,
        content,
      };
    } catch (error) {
      console.error(`[generate] Error:`, error);

      await ctx.runMutation(internal.generations.updateStatus, {
        id: generationId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  },
});
