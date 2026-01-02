import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bearerAuth } from 'hono/bearer-auth';
import type { Env, BrandProfile } from './types';

// Import agent functions (not Durable Objects)
import { research } from './agents/researcher';
import { selectContent } from './agents/strategist';
import { createContent } from './agents/creative-director';

const app = new Hono<{ Bindings: Env }>();

// CORS for web app
app.use('/*', cors({
  origin: ['http://localhost:3000', 'https://phantom-loom.pages.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization']
}));

// ─────────────────────────────────────────────────────────────────────────────
// AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

// Protect mutation endpoints with API key
app.use('/api/generate', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token || token !== c.env.API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

app.use('/api/agents/*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token || token !== c.env.API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

// Admin endpoints require separate ADMIN_KEY
app.use('/api/admin/*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token || token !== c.env.ADMIN_KEY) {
    return c.json({ error: 'Unauthorized: admin access required' }, 401);
  }
  await next();
});

// Health check (API)
app.get('/api/health', (c) => c.json({ status: 'ok', service: 'phantom-loom' }));

// ─────────────────────────────────────────────────────────────────────────────
// BRANDS
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/brands', async (c) => {
  const results = await c.env.DB.prepare('SELECT * FROM brands ORDER BY name').all();
  return c.json({ brands: results.results || [] });
});

app.get('/api/brands/:slug', async (c) => {
  const slug = c.req.param('slug');
  const brand = await c.env.DB.prepare('SELECT * FROM brands WHERE slug = ?').bind(slug).first();

  if (!brand) {
    return c.json({ error: 'Brand not found' }, 404);
  }

  // Parse JSON fields
  const parsed = parseBrandFromDb(brand);
  return c.json({ brand: parsed });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT POOL
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/pool/:brandSlug', async (c) => {
  const brandSlug = c.req.param('brandSlug');
  const status = c.req.query('status');

  let query = 'SELECT * FROM content_pool WHERE brand_slug = ?';
  const bindings: any[] = [brandSlug];

  if (status) {
    query += ' AND status = ?';
    bindings.push(status);
  }

  query += ' ORDER BY relevance DESC, created_at DESC';

  const results = await c.env.DB.prepare(query).bind(...bindings).all();
  return c.json({ items: results.results || [] });
});

// ─────────────────────────────────────────────────────────────────────────────
// GENERATIONS
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/generations/:brandSlug', async (c) => {
  const brandSlug = c.req.param('brandSlug');
  const limit = parseInt(c.req.query('limit') || '20');

  const results = await c.env.DB.prepare(
    'SELECT * FROM generations WHERE brand_slug = ? ORDER BY created_at DESC LIMIT ?'
  ).bind(brandSlug, limit).all();

  return c.json({ generations: results.results || [] });
});

app.get('/api/generation/:id', async (c) => {
  const id = c.req.param('id');
  const generation = await c.env.DB.prepare('SELECT * FROM generations WHERE id = ?').bind(id).first();

  if (!generation) {
    return c.json({ error: 'Generation not found' }, 404);
  }

  // Parse JSON fields
  const parsed = {
    ...generation,
    twitter_hashtags: JSON.parse((generation as any).twitter_hashtags || '[]'),
    linkedin_hashtags: JSON.parse((generation as any).linkedin_hashtags || '[]')
  };

  return c.json({ generation: parsed });
});

// ─────────────────────────────────────────────────────────────────────────────
// AGENTS (as functions, not Durable Objects)
// ─────────────────────────────────────────────────────────────────────────────

// Research: Generate new content ideas
app.post('/api/agents/research', async (c) => {
  const body = await c.req.json();
  const { brandSlug, focusAreas } = body;

  if (!brandSlug) {
    return c.json({ error: 'brandSlug required' }, 400);
  }

  try {
    const result = await research(c.env, brandSlug, focusAreas);
    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Strategy: Select best content from pool
app.post('/api/agents/select', async (c) => {
  const body = await c.req.json();
  const { brandSlug, criteria } = body;

  if (!brandSlug) {
    return c.json({ error: 'brandSlug required' }, 400);
  }

  try {
    const result = await selectContent(c.env, brandSlug, criteria);
    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Creative: Generate content (copy + image)
app.post('/api/agents/create', async (c) => {
  const body = await c.req.json();
  const { brandSlug, topic, poolItemId, frame } = body;

  if (!brandSlug || !topic) {
    return c.json({ error: 'brandSlug and topic required' }, 400);
  }

  try {
    const result = await createContent(c.env, brandSlug, topic, poolItemId, frame);
    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Post: Publish or schedule content to social platforms
app.post('/api/agents/post', async (c) => {
  const body = await c.req.json();
  const { generationId, brandSlug, platforms, scheduledFor, immediate } = body;

  if (!generationId || !brandSlug) {
    return c.json({ error: 'generationId and brandSlug required' }, 400);
  }

  try {
    // Get generation from D1
    const generation = await c.env.DB.prepare(
      'SELECT * FROM generations WHERE id = ?'
    ).bind(generationId).first<any>();

    if (!generation) {
      return c.json({ success: false, error: 'Generation not found' }, 404);
    }

    const targetPlatforms = platforms || ['twitter', 'linkedin'];

    // If scheduledFor is provided, create scheduled posts
    if (scheduledFor && !immediate) {
      const scheduled: Array<{ platform: string; postId: string }> = [];

      for (const platform of targetPlatforms) {
        const postId = crypto.randomUUID();
        await c.env.DB.prepare(`
          INSERT INTO scheduled_posts (id, generation_id, brand_slug, platform, scheduled_for, status)
          VALUES (?, ?, ?, ?, ?, 'scheduled')
        `).bind(postId, generationId, brandSlug, platform, scheduledFor).run();

        scheduled.push({ platform, postId });
      }

      return c.json({ success: true, scheduled });
    }

    // Immediate posting - for now return stub (direct posting would go here)
    const results: Array<{ platform: string; success: boolean; postId?: string; error?: string }> = [];

    for (const platform of targetPlatforms) {
      // TODO: Wire to direct posting implementations (twitter-direct.ts, etc.)
      // For now, mark as posted in D1 and return success
      results.push({
        platform,
        success: true,
        postId: `${platform}-${Date.now()}`
      });
    }

    // Update generation status
    await c.env.DB.prepare(
      'UPDATE generations SET status = ? WHERE id = ?'
    ).bind('posted', generationId).run();

    return c.json({ success: true, results });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get scheduled posts
app.get('/api/schedule/:brandSlug', async (c) => {
  const brandSlug = c.req.param('brandSlug');

  const results = await c.env.DB.prepare(`
    SELECT sp.*, g.topic, g.twitter_text, g.linkedin_text, g.image_url
    FROM scheduled_posts sp
    JOIN generations g ON sp.generation_id = g.id
    WHERE sp.brand_slug = ? AND sp.status IN ('scheduled', 'posting')
    ORDER BY sp.scheduled_for ASC
  `).bind(brandSlug).all();

  return c.json({ scheduled: results.results || [] });
});

// Cancel scheduled post
app.delete('/api/schedule/:postId', async (c) => {
  const postId = c.req.param('postId');

  const result = await c.env.DB.prepare(
    'UPDATE scheduled_posts SET status = ? WHERE id = ? AND status = ?'
  ).bind('cancelled', postId, 'scheduled').run();

  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Post not found or already processed' }, 404);
  }

  return c.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// DIRECT GENERATION (shortcut)
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/generate', async (c) => {
  const body = await c.req.json();
  const { brandSlug, topic, frame } = body;

  if (!brandSlug || !topic) {
    return c.json({ error: 'brandSlug and topic required' }, 400);
  }

  try {
    // frame options: 'announcement', 'weekly_update', 'event', 'partnership', 'thought'
    const result = await createContent(c.env, brandSlug, topic, undefined, frame);
    return c.json(result);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BRAND SYNC (admin endpoint)
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/admin/sync-brands', async (c) => {
  const body = await c.req.json();
  const { brands } = body as { brands: BrandProfile[] };

  if (!brands?.length) {
    return c.json({ error: 'No brands provided' }, 400);
  }

  const results: Array<{ slug: string; status: string }> = [];

  for (const brand of brands) {
    try {
      await c.env.DB.prepare(`
        INSERT INTO brands (
          id, slug, name, guardrails,
          voice_tone, voice_style, voice_rules, voice_frames, voice_avoid_phrases,
          visual_palette, visual_style, visual_mood, visual_avoid,
          visual_image_direction, visual_reference_styles, visual_image_generation,
          visual_design_system, platforms, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
          name = excluded.name,
          guardrails = excluded.guardrails,
          voice_tone = excluded.voice_tone,
          voice_style = excluded.voice_style,
          voice_rules = excluded.voice_rules,
          voice_frames = excluded.voice_frames,
          voice_avoid_phrases = excluded.voice_avoid_phrases,
          visual_palette = excluded.visual_palette,
          visual_style = excluded.visual_style,
          visual_mood = excluded.visual_mood,
          visual_avoid = excluded.visual_avoid,
          visual_image_direction = excluded.visual_image_direction,
          visual_reference_styles = excluded.visual_reference_styles,
          visual_image_generation = excluded.visual_image_generation,
          visual_design_system = excluded.visual_design_system,
          platforms = excluded.platforms,
          updated_at = excluded.updated_at
      `).bind(
        brand.slug,
        brand.slug,
        brand.name,
        JSON.stringify(brand.guardrails || null),
        brand.voice?.tone || null,
        brand.voice?.style || null,
        JSON.stringify(brand.voice?.rules || []),
        JSON.stringify((brand.voice as any)?.frames || null),
        JSON.stringify((brand.voice as any)?.avoid_phrases || []),
        JSON.stringify(brand.visual?.palette || {}),
        brand.visual?.style || null,
        brand.visual?.mood || null,
        JSON.stringify(brand.visual?.avoid || []),
        JSON.stringify(brand.visual?.image_direction || null),
        JSON.stringify(brand.visual?.reference_styles || []),
        JSON.stringify(brand.visual?.image_generation || null),
        JSON.stringify((brand.visual as any)?.design_system || null),
        JSON.stringify(brand.platforms || {}),
        new Date().toISOString()
      ).run();

      results.push({ slug: brand.slug!, status: 'synced' });
    } catch (error: any) {
      results.push({ slug: brand.slug!, status: `error: ${error.message}` });
    }
  }

  return c.json({ results });
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function parseBrandFromDb(brand: any): BrandProfile {
  return {
    name: brand.name,
    slug: brand.slug,
    guardrails: brand.guardrails ? JSON.parse(brand.guardrails) : undefined,
    voice: {
      tone: brand.voice_tone || '',
      style: brand.voice_style || '',
      rules: JSON.parse(brand.voice_rules || '[]'),
      frames: JSON.parse(brand.voice_frames || 'null'),
      avoid_phrases: JSON.parse(brand.voice_avoid_phrases || '[]')
    },
    visual: {
      palette: JSON.parse(brand.visual_palette || '{}'),
      style: brand.visual_style || '',
      mood: brand.visual_mood || '',
      avoid: JSON.parse(brand.visual_avoid || '[]'),
      image_direction: JSON.parse(brand.visual_image_direction || 'null'),
      reference_styles: JSON.parse(brand.visual_reference_styles || '[]'),
      image_generation: JSON.parse(brand.visual_image_generation || 'null'),
      design_system: JSON.parse(brand.visual_design_system || 'null')
    },
    platforms: JSON.parse(brand.platforms || '{}')
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC FILE SERVING (Web UI from R2)
// ─────────────────────────────────────────────────────────────────────────────

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function getContentType(path: string): string {
  const ext = path.substring(path.lastIndexOf('.'));
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

// Serve static files for all non-API routes
app.get('/*', async (c) => {
  let path = c.req.path;

  // Default to index.html for root
  if (path === '/') {
    path = '/index.html';
  }

  // Try to get the file from R2
  const key = `web${path}`;
  let file = await c.env.R2.get(key);

  // If not found and not a file with extension, try as SPA route (serve index.html)
  if (!file && !path.includes('.')) {
    file = await c.env.R2.get('web/index.html');
    if (file) {
      return new Response(file.body, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        }
      });
    }
  }

  if (!file) {
    // Return 404 page or fallback to index for SPA
    const indexFile = await c.env.R2.get('web/index.html');
    if (indexFile) {
      return new Response(indexFile.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        }
      });
    }
    return c.json({ error: 'Not found' }, 404);
  }

  const contentType = getContentType(path);
  const cacheControl = path.includes('/assets/')
    ? 'public, max-age=31536000, immutable'  // Cache assets forever (hashed filenames)
    : 'no-cache';  // Don't cache HTML

  return new Response(file.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl
    }
  });
});

export default app;
