import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "./_generated/server";

/**
 * Get recent aesthetic choices for a brand
 * Used by Creative Director to ensure variety
 */
export const getRecent = internalQuery({
  args: {
    brandSlug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { brandSlug, limit = 10 }) => {
    const brand = await ctx.db
      .query("brands")
      .withIndex("by_slug", (q) => q.eq("slug", brandSlug))
      .first();

    if (!brand) return [];

    return await ctx.db
      .query("aestheticHistory")
      .withIndex("by_brand_recent", (q) => q.eq("brandId", brand._id))
      .order("desc")
      .take(limit);
  },
});

/**
 * Record aesthetic choices for a generation
 */
export const record = internalMutation({
  args: {
    brandId: v.id("brands"),
    generationId: v.id("generations"),
    choices: v.object({
      mood: v.optional(v.string()),
      technique: v.optional(v.string()),
      subject: v.optional(v.string()),
      colorTone: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { brandId, generationId, choices }) => {
    return await ctx.db.insert("aestheticHistory", {
      brandId,
      generationId,
      choices,
      createdAt: Date.now(),
    });
  },
});

/**
 * Analyze variety - what choices haven't been used recently?
 */
export const analyzeVariety = internalQuery({
  args: {
    brandSlug: v.string(),
  },
  handler: async (ctx, { brandSlug }) => {
    const brand = await ctx.db
      .query("brands")
      .withIndex("by_slug", (q) => q.eq("slug", brandSlug))
      .first();

    if (!brand) return null;

    const recent = await ctx.db
      .query("aestheticHistory")
      .withIndex("by_brand_recent", (q) => q.eq("brandId", brand._id))
      .order("desc")
      .take(10);

    // Count occurrences of each choice
    const moods: Record<string, number> = {};
    const techniques: Record<string, number> = {};
    const subjects: Record<string, number> = {};
    const colorTones: Record<string, number> = {};

    for (const item of recent) {
      if (item.choices.mood) {
        moods[item.choices.mood] = (moods[item.choices.mood] || 0) + 1;
      }
      if (item.choices.technique) {
        techniques[item.choices.technique] = (techniques[item.choices.technique] || 0) + 1;
      }
      if (item.choices.subject) {
        subjects[item.choices.subject] = (subjects[item.choices.subject] || 0) + 1;
      }
      if (item.choices.colorTone) {
        colorTones[item.choices.colorTone] = (colorTones[item.choices.colorTone] || 0) + 1;
      }
    }

    // Known options
    const allMoods = ["contemplative", "hopeful", "resilient", "peaceful", "empowering", "tender"];
    const allTechniques = ["macro", "silhouette", "overhead", "eye-level", "shallow DOF", "wide angle"];
    const allSubjects = ["hands", "windows", "nature", "objects", "spaces", "moments"];
    const allColorTones = ["warm", "muted", "high contrast", "soft", "golden", "cool"];

    // Find underused options
    const underusedMoods = allMoods.filter((m) => !moods[m] || moods[m] < 2);
    const underusedTechniques = allTechniques.filter((t) => !techniques[t] || techniques[t] < 2);
    const underusedSubjects = allSubjects.filter((s) => !subjects[s] || subjects[s] < 2);
    const underusedColorTones = allColorTones.filter((c) => !colorTones[c] || colorTones[c] < 2);

    return {
      recentChoices: { moods, techniques, subjects, colorTones },
      suggestions: {
        moods: underusedMoods,
        techniques: underusedTechniques,
        subjects: underusedSubjects,
        colorTones: underusedColorTones,
      },
    };
  },
});

/**
 * Public query for dashboard
 */
export const listForDashboard = query({
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
      .query("aestheticHistory")
      .withIndex("by_brand_recent", (q) => q.eq("brandId", brand._id))
      .order("desc")
      .take(limit);
  },
});
