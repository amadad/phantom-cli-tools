/**
 * Core types for Phantom Loom CLI
 */

export interface ImageDirection {
  subjects?: string[]
  technique?: string[]
  emotions?: string[]
  scene_templates?: Record<string, string>
}

/**
 * Reference style for brand-consistent image generation
 * Uses Gemini's multi-image input for style transfer
 */
export interface ReferenceStyle {
  name: string
  description: string
  images: string[]  // Paths relative to brand directory
  mood_keywords: string[]
  visual_mode: 'framed_portrait' | 'lifestyle_scene' | 'illustrative_concept' | 'documentary' | 'abstract'
  // Optional visual prompt variables
  form_mode?: string
  texture_mode?: string
  edge_style?: string
}

/**
 * Image generation model configuration
 */
export interface ImageGenerationConfig {
  provider: 'gemini' | 'reve'  // Image generation provider
  primary_model?: 'gemini-3-pro-image-preview' | 'gemini-2.5-flash-image'  // Legacy: for gemini only
  fallback_model?: 'gemini-3-pro-image-preview' | 'gemini-2.5-flash-image'  // Legacy: for gemini only
  default_aspect_ratio: AspectRatio
  default_resolution: '1K' | '2K' | '4K'
  max_reference_images: number
}

/**
 * Writing system for anti-AI-slop content generation
 * Stabilizes cognition under load, preserves human trace
 */
export interface WritingSystem {
  goal: string
  core_rules: string[]
  engines: Record<string, {
    description: string
    use_for: string[]
  }>
  structures: Array<{
    name: string
    pattern: string
    description: string
  }>
  language: {
    prefer: string[]
    limit: string[]
    replacements: Record<string, string>
  }
  trauma_informed: string[]
  human_markers: string[]
  metaphor_rules: string[]
  endings: {
    avoid: string[]
    prefer: string[]
  }
}

/**
 * Content frame definition for different post types
 */
export interface ContentFrame {
  description: string
  structure: string
  example?: string
  example_2?: string
  example_3?: string
  use_brand_voice?: boolean
  use_writing_system?: boolean
}

/**
 * Brand style configuration for poster generation
 * Loaded from style.yml or inline in brand config
 */
export interface BrandStyle {
  colors?: {
    dark?: string
    light?: string
    accent?: string
    backgrounds?: {
      warm?: string
      cream?: string
      dark?: string
    }
  }
  logo?: {
    svg?: string
    colors?: {
      onLight?: string
      onDark?: string
    }
  }
  typography?: {
    headline?: {
      font?: string
      weight?: number
      scale?: {
        large?: number
        medium?: number
        small?: number
      }
    }
  }
  templates?: Array<{
    name: string
    template: string
    ratio: string
    logo: boolean
  }>
  prompt_override?: string
}

export interface BrandProfile {
  name: string
  url: string
  voice: {
    tone: string
    style: string
    rules: string[]
    product_rules?: string[]
    writing_system?: WritingSystem
    avoid_phrases?: string[]
    frames?: Record<string, ContentFrame>
  }
  visual: {
    palette: {
      primary: string
      secondary: string
      accent: string
      highlight?: string
    }
    style: string
    mood: string
    avoid: string[]
    image_direction?: ImageDirection
    reference_styles?: ReferenceStyle[]
    image_generation?: ImageGenerationConfig
    prompt_override?: string
  }
  platforms: {
    twitter?: { max_chars: number; hashtags: number }
    linkedin?: { max_chars: number; hashtags: number }
    facebook?: { max_chars: number; hashtags: number; style?: string }
    instagram?: { max_chars: number; hashtags: number; style?: string }
    threads?: { max_chars: number; hashtags: number; style?: string }
    youtube?: { title_max_chars: number; description_max_chars: number; style?: string }
  }
  topics: string[]
  handles: {
    twitter?: string
    linkedin?: string
    facebook?: string
    instagram?: string
    threads?: string
    youtube?: string
  }
  /** Design system for poster generation. Loaded from style.yml or inline. */
  style?: BrandStyle
}

export interface VisualStyle {
  lighting: string
  composition: string
  colorGrading: string
  technical: string
  atmosphere: string
}

export type Platform = 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'threads' | 'youtube'

// Brand is a string - validated at runtime against discovered brands
export type Brand = string

export interface PlatformContent {
  platform: Platform
  text: string
  hashtags: string[]
  characterCount: number
}

export interface GenerationResult {
  id: string
  topic: string
  imageUrl: string
  imagePrompt: string
  imageModel: string
  content: {
    twitter: PlatformContent
    linkedin: PlatformContent
    facebook?: PlatformContent
    instagram?: PlatformContent
    threads?: PlatformContent
  }
  brand: string
  generatedAt: string
}

export interface ImageResult {
  url: string
  prompt: string
  model: string
  metadata: {
    format: string
    aspectRatio: string
    b64?: string
    referenceCount?: number
    resolution?: string
  }
}

export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'

/**
 * Topic library item - structured topic with tension/thesis for content generation
 */
export interface TopicItem {
  id: string
  text: string                    // Core topic
  tension?: string                // The "and yet" - creates dissonance
  thesis?: string                 // The punchline/insight
  category?: 'warm' | 'product' | 'thought'
  priority?: 'high' | 'medium' | 'low'
  tags?: string[]
  source?: {
    title?: string                // Source material title
    url?: string                  // Link to original
    quote?: string                // Key quote to anchor on
    context?: string              // Brief context for the quote
  }
  added: string                   // ISO date
  used?: Array<{
    date: string
    queueId: string
  }>
}

/**
 * Queue item for pending/published content
 */
export interface QueueItem {
  id: string
  brand?: string  // Brand name for per-brand queue separation
  source: { type: string; topic: string; brandName: string }
  stage: 'review' | 'publishing' | 'done' | 'failed'
  createdAt: string
  updatedAt: string
  requiresApproval?: boolean
  content: {
    topic: string
    twitter?: { text: string; hashtags: string[] }
    linkedin?: { text: string; hashtags: string[] }
    facebook?: { text: string; hashtags: string[] }
    instagram?: { text: string; hashtags: string[] }
    threads?: { text: string; hashtags: string[] }
    youtube?: { title: string; description: string; tags: string[] }
  }
  image?: { url: string; prompt: string; model: string }
  video?: {
    url: string              // Path to conformed video file
    duration: number         // Measured via ffprobe (seconds)
    aspectRatio: '9:16'      // Always 9:16 after conform
    width: 1080
    height: 1920
    provider: string         // 'replicate', 'runway', 'luma'
    sourceImage?: string     // Source image if animated
    hasAudio: boolean
  }
  posts?: Array<{
    platform: Platform
    success: boolean
    postUrl?: string
    error?: string
    postedAt?: string
  }>
}

/**
 * Video brief for generation pipeline
 */
export interface VideoBrief {
  meta: {
    brand: string
    topic: string
    total_duration: number
    aspect_ratio: '9:16'
    resolution: [number, number]
  }
  style?: {
    aesthetic: string
    post_process: boolean
    grain_intensity?: number
    saturation?: number
    warmth?: number
    blur?: number
  }
  voice: {
    provider: 'cartesia'
    model: string
    voice_id: string
    emotion?: string
    speed?: number
  }
  music?: {
    provider: string
    style: string
    duration: number
    volume_ratio: number
  }
  scenes: Array<{
    id: number
    duration: number
    script: string
    image_prompt: string
    motion_prompt: string
  }>
  output: {
    filename: string
    format: string
    codec: string
    audio_codec: string
  }
}

