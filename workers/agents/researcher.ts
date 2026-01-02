import type { Env, BrandProfile, ContentPoolItem } from '../types';

/**
 * Researcher Agent (as function)
 *
 * Scans for content opportunities for each brand.
 * Creates a pool of ideas with unique angles.
 */

export async function research(
  env: Env,
  brandSlug: string,
  focusAreas?: string[]
): Promise<{ success: boolean; ideasAdded?: number; ideas?: any[]; error?: string }> {
  // 1. Get brand from D1
  const brand = await getBrand(env, brandSlug);
  if (!brand) {
    return { success: false, error: `Brand not found: ${brandSlug}` };
  }

  // 2. Get recent pool items to avoid duplication
  const recentItems = await getRecentPoolItems(env, brandSlug, 20);

  // 3. Generate new ideas via Gemini
  const ideas = await generateIdeas(env, brand, recentItems, focusAreas);

  // 4. Add ideas to pool
  for (const idea of ideas) {
    await addToPool(env, brandSlug, idea);
  }

  return { success: true, ideasAdded: ideas.length, ideas };
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
      avoid: JSON.parse(result.visual_avoid || '[]'),
      image_direction: JSON.parse(result.visual_image_direction || 'null'),
      reference_styles: JSON.parse(result.visual_reference_styles || '[]'),
      image_generation: JSON.parse(result.visual_image_generation || 'null')
    },
    platforms: JSON.parse(result.platforms || '{}')
  };
}

async function getRecentPoolItems(env: Env, brandSlug: string, limit: number): Promise<ContentPoolItem[]> {
  const results = await env.DB.prepare(
    'SELECT * FROM content_pool WHERE brand_slug = ? ORDER BY created_at DESC LIMIT ?'
  ).bind(brandSlug, limit).all<ContentPoolItem>();

  return results.results || [];
}

async function generateIdeas(
  env: Env,
  brand: BrandProfile,
  recentItems: ContentPoolItem[],
  focusAreas?: string[]
): Promise<any[]> {
  const recentTopics = recentItems.map(i => `- ${i.topic}: ${i.angle}`).join('\n');

  const prompt = `You are a Content Researcher for ${brand.name}.

BRAND VOICE:
- Tone: ${brand.voice.tone}
- Style: ${brand.voice.style}
- Rules: ${brand.voice.rules.join(', ')}

BRAND TOPICS/FOCUS AREAS:
${focusAreas?.join('\n') || 'General brand content'}

RECENT CONTENT (avoid duplicating):
${recentTopics || 'None yet'}

Generate 5-7 unique content ideas. Each idea MUST have:
1. A specific ANGLE, not just a topic
2. A brand-specific POV (could only come from THIS brand)
3. A clear emotional hook
4. Something unexpected (not the first thing everyone thinks of)

Return a JSON array of ideas:
[
  {
    "topic": "specific topic title",
    "angle": "unique perspective or approach",
    "hook": "emotional entry point or question",
    "context": "relevant context if any",
    "relevance": 1-10,
    "timeliness": "evergreen" | "trending" | "seasonal" | "timely",
    "notes": "optional notes"
  }
]`;

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
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  }
}

async function addToPool(env: Env, brandSlug: string, idea: any): Promise<void> {
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO content_pool (id, brand_slug, topic, angle, hook, context, relevance, timeliness, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).bind(
    id,
    brandSlug,
    idea.topic,
    idea.angle,
    idea.hook || null,
    idea.context || null,
    idea.relevance || 5,
    idea.timeliness || 'evergreen',
    idea.notes || null
  ).run();
}
