/**
 * Core types for Phantom Loom
 */

export interface ImageDirection {
  subjects?: string[]
  technique?: string[]
  emotions?: string[]
  scene_templates?: Record<string, string>
}

export interface BrandProfile {
  name: string
  url: string
  voice: {
    tone: string
    style: string
    rules: string[]
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
  }
}

export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'
