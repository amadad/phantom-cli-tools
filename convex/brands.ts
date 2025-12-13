import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";

/**
 * Get all brands
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("brands").collect();
  },
});

/**
 * Get brand by slug
 */
export const getBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("brands")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
  },
});

/**
 * Get brand by slug (public)
 */
export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("brands")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
  },
});

/**
 * Create or update a brand from YAML config
 */
export const upsert = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    url: v.optional(v.string()),
    voice: v.object({
      tone: v.string(),
      style: v.string(),
      rules: v.array(v.string()),
    }),
    visual: v.object({
      palette: v.object({
        primary: v.string(),
        secondary: v.string(),
        accent: v.string(),
        highlight: v.optional(v.string()),
      }),
      style: v.string(),
      mood: v.string(),
      avoid: v.array(v.string()),
      imageDirection: v.optional(v.object({
        subjects: v.optional(v.array(v.string())),
        technique: v.optional(v.array(v.string())),
        emotions: v.optional(v.array(v.string())),
        sceneTemplates: v.optional(v.any()),
      })),
    }),
    platforms: v.object({
      twitter: v.optional(v.object({
        maxChars: v.number(),
        hashtags: v.number(),
      })),
      linkedin: v.optional(v.object({
        maxChars: v.number(),
        hashtags: v.number(),
      })),
      facebook: v.optional(v.object({
        maxChars: v.number(),
        hashtags: v.number(),
      })),
      instagram: v.optional(v.object({
        maxChars: v.number(),
        hashtags: v.number(),
      })),
      threads: v.optional(v.object({
        maxChars: v.number(),
        hashtags: v.number(),
      })),
      youtube: v.optional(v.object({
        titleMaxChars: v.number(),
        descriptionMaxChars: v.number(),
      })),
    }),
    handles: v.optional(v.object({
      twitter: v.optional(v.string()),
      linkedin: v.optional(v.string()),
      facebook: v.optional(v.string()),
      instagram: v.optional(v.string()),
      threads: v.optional(v.string()),
      youtube: v.optional(v.string()),
    })),
    topics: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("brands")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("brands", {
        ...args,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
