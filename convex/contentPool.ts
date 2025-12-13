import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";

/**
 * List pool items for a brand
 */
export const list = internalQuery({
  args: {
    brandSlug: v.string(),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { brandSlug, status, limit = 20 }) => {
    // Get brand first
    const brand = await ctx.db
      .query("brands")
      .withIndex("by_slug", (q) => q.eq("slug", brandSlug))
      .first();

    if (!brand) return [];

    let items;
    if (status) {
      items = await ctx.db
        .query("contentPool")
        .withIndex("by_brand_status", (q) =>
          q.eq("brandId", brand._id).eq("status", status as any)
        )
        .order("desc")
        .take(limit);
    } else {
      items = await ctx.db
        .query("contentPool")
        .withIndex("by_brand", (q) => q.eq("brandId", brand._id))
        .order("desc")
        .take(limit);
    }

    return items;
  },
});

/**
 * Get recent pool items (for researcher to check duplicates)
 */
export const getRecent = internalQuery({
  args: {
    brandSlug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { brandSlug, limit = 20 }) => {
    const brand = await ctx.db
      .query("brands")
      .withIndex("by_slug", (q) => q.eq("slug", brandSlug))
      .first();

    if (!brand) return [];

    return await ctx.db
      .query("contentPool")
      .withIndex("by_brand", (q) => q.eq("brandId", brand._id))
      .order("desc")
      .take(limit);
  },
});

/**
 * Add item to pool (used by Researcher)
 */
export const add = internalMutation({
  args: {
    brandSlug: v.string(),
    topic: v.string(),
    angle: v.string(),
    hook: v.optional(v.string()),
    context: v.optional(v.string()),
    relevance: v.number(),
    timeliness: v.optional(v.string()),
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const brand = await ctx.db
      .query("brands")
      .withIndex("by_slug", (q) => q.eq("slug", args.brandSlug))
      .first();

    if (!brand) {
      throw new Error(`Brand not found: ${args.brandSlug}`);
    }

    const now = Date.now();

    return await ctx.db.insert("contentPool", {
      brandId: brand._id,
      idea: {
        topic: args.topic,
        angle: args.angle,
        hook: args.hook,
        context: args.context,
      },
      research: {
        source: args.source,
        relevance: args.relevance,
        timeliness: args.timeliness,
        notes: args.notes,
      },
      status: "new",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Select pool item (used by Strategist)
 */
export const select = internalMutation({
  args: {
    poolItemId: v.string(),
    platforms: v.array(v.string()),
    timing: v.optional(v.string()),
    position: v.optional(v.string()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.poolItemId as any);
    if (!item) {
      throw new Error(`Pool item not found: ${args.poolItemId}`);
    }

    await ctx.db.patch(item._id, {
      status: "selected",
      strategy: {
        platforms: args.platforms,
        timing: args.timing,
        position: args.position,
        priority: args.priority,
      },
      updatedAt: Date.now(),
    });

    return item._id;
  },
});

/**
 * Reject pool item (used by Strategist)
 */
export const reject = internalMutation({
  args: {
    poolItemId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.poolItemId as any);
    if (!item) {
      throw new Error(`Pool item not found: ${args.poolItemId}`);
    }

    await ctx.db.patch(item._id, {
      status: "rejected",
      research: {
        ...item.research,
        notes: args.reason,
      },
      updatedAt: Date.now(),
    });

    return item._id;
  },
});

/**
 * Mark pool item as used
 */
export const markUsed = internalMutation({
  args: {
    poolItemId: v.id("contentPool"),
  },
  handler: async (ctx, { poolItemId }) => {
    await ctx.db.patch(poolItemId, {
      status: "used",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Public query for dashboard
 */
export const listForDashboard = query({
  args: {
    brandSlug: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { brandSlug, status }) => {
    const brand = await ctx.db
      .query("brands")
      .withIndex("by_slug", (q) => q.eq("slug", brandSlug))
      .first();

    if (!brand) return [];

    if (status) {
      return await ctx.db
        .query("contentPool")
        .withIndex("by_brand_status", (q) =>
          q.eq("brandId", brand._id).eq("status", status as any)
        )
        .order("desc")
        .take(50);
    }

    return await ctx.db
      .query("contentPool")
      .withIndex("by_brand", (q) => q.eq("brandId", brand._id))
      .order("desc")
      .take(50);
  },
});
