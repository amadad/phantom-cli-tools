/**
 * Core types for the content pipeline
 */

// Brand configuration (loaded from YAML)
export interface Brand {
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
    }
    style: string
    mood: string
    avoid: string[]
  }
  platforms: {
    twitter: { max_chars: number; hashtags: number }
    linkedin: { max_chars: number; hashtags: number }
  }
  topics: string[]
  handles: {
    twitter: string
    linkedin: string
  }
}

// Content source types
export type SourceType = 'manual' | 'rss' | 'url' | 'schedule'

export interface ContentSource {
  type: SourceType
  url?: string        // For RSS or URL sources
  topic?: string      // For manual or schedule
  schedule?: string   // Cron expression for scheduled
  brandName: string
}

// Pipeline stages
export type PipelineStage = 'research' | 'write' | 'image' | 'review' | 'post' | 'done' | 'failed'

// Content item flowing through pipeline
export interface ContentItem {
  id: string
  source: ContentSource
  stage: PipelineStage
  createdAt: string
  updatedAt: string

  // Research output
  research?: {
    summary: string
    keyPoints: string[]
    angles: string[]
  }

  // Generated content
  content?: {
    topic: string
    twitter: {
      text: string
      hashtags: string[]
    }
    linkedin: {
      text: string
      hashtags: string[]
    }
  }

  // Generated image
  image?: {
    url: string        // base64 data URL or file path
    prompt: string
    model: string
  }

  // Post results
  posts?: {
    platform: 'twitter' | 'linkedin'
    success: boolean
    postUrl?: string
    error?: string
    postedAt?: string
  }[]

  // Errors if failed
  error?: string
}

// Queue item for human-in-loop
export interface QueueItem extends ContentItem {
  requiresApproval: boolean
  approvedAt?: string
  approvedBy?: string
  rejectedAt?: string
  rejectionReason?: string
}

// RSS feed item
export interface FeedItem {
  title: string
  link: string
  pubDate: string
  content?: string
  contentSnippet?: string
}

// Monitor configuration
export interface MonitorConfig {
  feeds: {
    url: string
    brandName: string
    checkInterval: number  // minutes
  }[]
}

// Pipeline configuration
export interface PipelineConfig {
  autoApprove: boolean        // Skip review stage
  autoPost: boolean           // Post immediately after approval
  imageGeneration: boolean    // Generate images
  platforms: ('twitter' | 'linkedin')[]
}
