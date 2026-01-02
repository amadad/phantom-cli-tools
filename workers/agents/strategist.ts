import type { Env, BrandProfile, ContentPoolItem } from '../types';

/**
 * Strategist Agent (as function)
 *
 * Selects the best content ideas from the pool.
 * Balances variety, timeliness, and brand fit.
 */

export async function selectContent(
  env: Env,
  brandSlug: string,
  criteria?: { maxItems?: number; preferTrending?: boolean }
): Promise<{ success: boolean; selected?: ContentPoolItem[]; total?: number; error?: string }> {
  // 1. Get brand
  const brand = await getBrand(env, brandSlug);
  if (!brand) {
    return { success: false, error: `Brand not found: ${brandSlug}` };
  }

  // 2. Get pending pool items
  const pendingItems = await getPendingItems(env, brandSlug);
  if (pendingItems.length === 0) {
    return { success: true, selected: [], total: 0 };
  }

  // 3. Get recent posts for variety
  const recentPosts = await getRecentPosts(env, brandSlug, 10);

  // 4. Use AI to rank and select
  const maxItems = criteria?.maxItems || 3;
  const selected = await rankAndSelect(env, brand, pendingItems, recentPosts, maxItems, criteria?.preferTrending);

  // 5. Mark selected items as approved
  for (const item of selected) {
    await approveItem(env, item.id);
  }

  return { success: true, selected, total: pendingItems.length };
}

async function getBrand(env: Env, slug: string): Promise<BrandProfile | null> {
  const result = await env.DB.prepare(
    'SELECT * FROM brands WHERE slug = ?'
  ).bind(slug).first<any>();

  if (!result) return null;

  return {
    name: result.name,
    slug: result.slug,
    voice: {
      tone: result.voice_tone || '',
      style: result.voice_style || '',
      rules: JSON.parse(result.voice_rules || '[]')
    },
    visual: {
      palette: JSON.parse(result.visual_palette || '{}'),
      style: result.visual_style || '',
      mood: result.visual_mood || '',
      avoid: JSON.parse(result.visual_avoid || '[]')
    },
    platforms: JSON.parse(result.platforms || '{}')
  };
}

async function getPendingItems(env: Env, brandSlug: string): Promise<ContentPoolItem[]> {
  const results = await env.DB.prepare(
    'SELECT * FROM content_pool WHERE brand_slug = ? AND status = ? ORDER BY relevance DESC, created_at DESC'
  ).bind(brandSlug, 'pending').all<ContentPoolItem>();

  return results.results || [];
}

async function getRecentPosts(env: Env, brandSlug: string, limit: number): Promise<any[]> {
  const results = await env.DB.prepare(
    'SELECT topic, image_description FROM generations WHERE brand_slug = ? AND status = ? ORDER BY created_at DESC LIMIT ?'
  ).bind(brandSlug, 'posted', limit).all<any>();

  return results.results || [];
}

async function rankAndSelect(
  env: Env,
  brand: BrandProfile,
  items: ContentPoolItem[],
  recentPosts: any[],
  maxItems: number,
  preferTrending?: boolean
): Promise<ContentPoolItem[]> {
  const recentTopics = recentPosts.map(p => p.topic).join(', ');

  const prompt = `You are a Content Strategist for ${brand.name}.

BRAND:
- Tone: ${brand.voice.tone}
- Style: ${brand.voice.style}

RECENT POSTS (avoid similar topics):
${recentTopics || 'None yet'}

CONTENT POOL TO SELECT FROM:
${items.map((item, i) => `
[${i}] Topic: ${item.topic}
    Angle: ${item.angle}
    Hook: ${item.hook || 'N/A'}
    Relevance: ${item.relevance}/10
    Timeliness: ${item.timeliness}
`).join('\n')}

SELECTION CRITERIA:
- Variety: Don't pick items too similar to recent posts
- Balance: Mix evergreen with timely content
- Impact: Prioritize high relevance scores
${preferTrending ? '- PRIORITY: Select trending/timely content first' : ''}

Select the ${maxItems} BEST items to create content for next.
Return a JSON object with indices (0-based):
{ "selected": [0, 3, 5], "reasoning": "brief explanation" }`;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  const data = await response.json() as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"selected":[]}';

  try {
    const result = JSON.parse(text);
    const indices = result.selected || [];
    return indices
      .filter((i: number) => i >= 0 && i < items.length)
      .slice(0, maxItems)
      .map((i: number) => items[i]);
  } catch {
    // Fallback: return top items by relevance
    return items.slice(0, maxItems);
  }
}

async function approveItem(env: Env, id: string): Promise<void> {
  await env.DB.prepare(
    'UPDATE content_pool SET status = ?, updated_at = ? WHERE id = ?'
  ).bind('approved', new Date().toISOString(), id).run();
}
