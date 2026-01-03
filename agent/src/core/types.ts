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
  // SCTY-specific variables
  form_mode?: string
  texture_mode?: string
  edge_style?: string
}

/**
 * Image generation model configuration
 */
export interface ImageGenerationConfig {
  primary_model: 'gemini-3-pro-image-preview' | 'gemini-2.5-flash-image'
  fallback_model: 'gemini-3-pro-image-preview' | 'gemini-2.5-flash-image'
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
}

export interface VisualStyle {
  lighting: string
  composition: string
  colorGrading: string
  technical: string
  atmosphere: string
}

export type Platform = 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'threads' | 'youtube'
export type Brand = 'givecare' | 'scty'

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
 * Queue item for pending/published content
 */
export interface QueueItem {
  id: string
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
  }
  image?: { url: string; prompt: string; model: string }
  posts?: Array<{
    platform: Platform
    success: boolean
    postUrl?: string
    error?: string
    postedAt?: string
  }>
}
