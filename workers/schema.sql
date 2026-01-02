-- Phantom Loom D1 Schema
-- Cloudflare D1 (SQLite)

-- Brands table (synced from YAML)
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,

  -- Voice
  voice_tone TEXT,
  voice_style TEXT,
  voice_rules TEXT, -- JSON array
  voice_frames TEXT, -- JSON object (content frame templates)
  voice_avoid_phrases TEXT, -- JSON array (phrases to never use)

  -- Visual
  visual_palette TEXT, -- JSON object
  visual_style TEXT,
  visual_mood TEXT,
  visual_avoid TEXT, -- JSON array
  visual_image_direction TEXT, -- JSON object
  visual_reference_styles TEXT, -- JSON array
  visual_image_generation TEXT, -- JSON object
  visual_design_system TEXT, -- JSON object (brand design system)

  -- Platforms
  platforms TEXT, -- JSON object

  -- Metadata
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Content pool (ideas from researcher)
CREATE TABLE IF NOT EXISTS content_pool (
  id TEXT PRIMARY KEY,
  brand_slug TEXT NOT NULL,

  topic TEXT NOT NULL,
  angle TEXT NOT NULL,
  hook TEXT,
  context TEXT,
  relevance INTEGER CHECK (relevance >= 1 AND relevance <= 10),
  timeliness TEXT CHECK (timeliness IN ('evergreen', 'trending', 'seasonal', 'timely')),
  source TEXT,
  notes TEXT,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'used')),

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (brand_slug) REFERENCES brands(slug)
);

-- Generations (content + images)
CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  brand_slug TEXT NOT NULL,

  -- Input
  topic TEXT NOT NULL,
  pool_item_id TEXT,

  -- Generated copy
  twitter_text TEXT,
  twitter_hashtags TEXT, -- JSON array
  linkedin_text TEXT,
  linkedin_hashtags TEXT, -- JSON array
  image_description TEXT,

  -- Generated image
  image_url TEXT,
  image_prompt TEXT,
  image_model TEXT,
  reference_style TEXT,

  -- Metadata
  status TEXT DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'posted', 'failed')),
  error TEXT,

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (brand_slug) REFERENCES brands(slug),
  FOREIGN KEY (pool_item_id) REFERENCES content_pool(id)
);

-- Scheduled posts
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL,
  brand_slug TEXT NOT NULL,

  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'linkedin', 'facebook', 'instagram', 'threads', 'youtube')),
  scheduled_for TEXT NOT NULL,

  -- Status tracking
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'posting', 'posted', 'failed')),
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  posted_at TEXT,
  platform_post_id TEXT,

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (generation_id) REFERENCES generations(id),
  FOREIGN KEY (brand_slug) REFERENCES brands(slug)
);

-- Aesthetic history (for creative director variety)
CREATE TABLE IF NOT EXISTS aesthetic_history (
  id TEXT PRIMARY KEY,
  brand_slug TEXT NOT NULL,
  generation_id TEXT,

  mood TEXT,
  technique TEXT,
  subject TEXT,
  color_tone TEXT,

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (brand_slug) REFERENCES brands(slug),
  FOREIGN KEY (generation_id) REFERENCES generations(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_content_pool_brand ON content_pool(brand_slug);
CREATE INDEX IF NOT EXISTS idx_content_pool_status ON content_pool(status);
CREATE INDEX IF NOT EXISTS idx_generations_brand ON generations(brand_slug);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled ON scheduled_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_aesthetic_history_brand ON aesthetic_history(brand_slug);
