import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";

/**
 * Browse inspiration library
 */
export const browse = internalQuery({
  args: {
    category: v.optional(v.string()),
    aesthetic: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { category, aesthetic, limit = 10 }) => {
    if (category) {
      return await ctx.db
        .query("inspirations")
        .withIndex("by_category", (q) => q.eq("category", category))
        .take(limit);
    }

    if (aesthetic) {
      return await ctx.db
        .query("inspirations")
        .withIndex("by_aesthetic", (q) => q.eq("aesthetic", aesthetic))
        .take(limit);
    }

    return await ctx.db.query("inspirations").take(limit);
  },
});

/**
 * Add inspiration to library
 */
export const add = mutation({
  args: {
    category: v.string(),
    aesthetic: v.string(),
    prompt: v.any(),
    notes: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("inspirations", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

/**
 * List all inspirations (for dashboard)
 */
export const list = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { category, limit = 50 }) => {
    if (category) {
      return await ctx.db
        .query("inspirations")
        .withIndex("by_category", (q) => q.eq("category", category))
        .take(limit);
    }

    return await ctx.db.query("inspirations").take(limit);
  },
});

/**
 * Get categories
 */
export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("inspirations").collect();
    const categories = [...new Set(all.map((i) => i.category))];
    const aesthetics = [...new Set(all.map((i) => i.aesthetic))];
    return { categories, aesthetics };
  },
});
