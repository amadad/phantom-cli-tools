// Cloudflare bindings
export interface Env {
  DB: D1Database;
  R2: R2Bucket;

  // Auth (set via wrangler secret put)
  API_KEY: string;      // For /api/generate, /api/agents/*
  ADMIN_KEY: string;    // For /api/admin/*

  // Secrets (set via wrangler secret put)
  GEMINI_API_KEY: string;
  R2_PUBLIC_URL: string;

  // Social platform credentials
  TWITTER_SCTY_API_KEY?: string;
  TWITTER_SCTY_API_SECRET?: string;
  TWITTER_SCTY_ACCESS_TOKEN?: string;
  TWITTER_SCTY_ACCESS_SECRET?: string;
  TWITTER_GIVECARE_API_KEY?: string;
  TWITTER_GIVECARE_API_SECRET?: string;
  TWITTER_GIVECARE_ACCESS_TOKEN?: string;
  TWITTER_GIVECARE_ACCESS_SECRET?: string;

  LINKEDIN_SCTY_ACCESS_TOKEN?: string;
  LINKEDIN_SCTY_ORG_ID?: string;
  LINKEDIN_GIVECARE_ACCESS_TOKEN?: string;
  LINKEDIN_GIVECARE_ORG_ID?: string;
}

// Guardrails for content evaluation
export interface Guardrails {
  pursue: {
    voice: string[];
    visual: string[];
  };
  reject: {
    voice: string[];
    visual: string[];
  };
  never: {
    phrases: string[];
    visual_elements: string[];
  };
  thresholds: {
    min_specificity_score: number;
    max_cliche_score: number;
    require_cta: boolean;
  };
}

// Evaluation result from guardrails check
export interface GuardrailsResult {
  passed: boolean;
  score: number;
  violations: string[];
  suggestions: string[];
  details: {
    specificity_score: number;
    cliche_score: number;
    has_cta: boolean;
    banned_phrases_found: string[];
  };
}

// Parsed brand (from YAML or D1)
export interface BrandProfile {
  name: string;
  slug: string;
  guardrails?: Guardrails;
  voice: {
    tone: string;
    style: string;
    rules: string[];
  };
  visual: {
    palette: { primary: string; secondary: string; accent?: string };
    style: string;
    mood: string;
    avoid: string[];
    // Logo configuration for brand watermark
    logo_url?: string;
    logo_text?: string;
    logo_style?: string;
    image_direction?: {
      subjects?: string[];
      technique?: string[];
      emotions?: string[];
      scene_templates?: Record<string, string>;
    };
    reference_styles?: Array<{
      name: string;
      description: string;
      style_description?: string;  // Detailed style description for Gemini style transfer
      images: string[];
      mood_keywords: string[];
    }>;
    image_generation?: {
      primary_model: string;
      fallback_model: string;
      default_aspect_ratio: string;
      default_resolution?: string;
      logo_url?: string;
      logo_text?: string;
      logo_style?: string;
    };
    design_system?: {
      illustration?: {
        style_description: string;
        reference: string;
        use_for: string[];
      };
      photo_treatment?: {
        style_description: string;
        reference: string;
        use_for: string[];
      };
      typography?: {
        style_description: string;
        reference: string;
        use_for: string[];
      };
      logo_positions?: string[];
      compositions?: Array<{
        type: string;
        description: string;
        weight: number;
      }>;
    };
  };
  platforms?: {
    twitter?: { max_chars: number; hashtags: number };
    linkedin?: { max_chars: number; hashtags: number };
  };
}

// Content pool item
export interface ContentPoolItem {
  id: string;
  brand_slug: string;
  topic: string;
  angle: string;
  hook?: string;
  context?: string;
  relevance: number;
  timeliness?: 'evergreen' | 'trending' | 'seasonal' | 'timely';
  source?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected' | 'used';
  created_at: string;
}

// Aesthetic choice (for creative director variety)
export interface AestheticChoice {
  mood: string;
  technique: string;
  subject: string;
  colorTone: string;
}
