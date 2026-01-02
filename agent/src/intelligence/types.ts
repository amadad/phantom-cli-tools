/**
 * Social Intelligence Types
 * For tracking influencers, trends, and landscape analysis
 */

export type Platform = 'instagram' | 'youtube' | 'tiktok' | 'linkedin' | 'twitter' | 'threads' | 'substack' | 'podcast' | 'website'
export type Brand = 'givecare' | 'scty'
export type InfluencerType = 'personal_caregiver' | 'coach' | 'expert' | 'organization' | 'media' | 'brand' | 'advocate'
export type ContentTheme = 'burnout' | 'self_care' | 'tips' | 'humor' | 'grief' | 'advocacy' | 'education' | 'community' | 'tech' | 'finance'

export interface SocialHandle {
  platform: Platform
  username: string
  url: string
  followers?: number
  verified?: boolean
}

export interface Influencer {
  id: string
  name: string
  type: InfluencerType
  description: string
  handles: SocialHandle[]

  // Metrics (updated periodically)
  metrics?: {
    totalFollowers?: number
    engagementRate?: number
    avgLikes?: number
    avgComments?: number
    postingFrequency?: string
    lastUpdated?: string
  }

  // Content analysis
  content?: {
    themes: ContentTheme[]
    aesthetic?: string
    format?: string[]  // 'reels', 'carousels', 'stories', etc.
    tone?: string
  }

  // Strategic info
  strategy?: {
    relevanceScore?: number  // 1-10 how relevant to brand
    partnershipPotential?: 'high' | 'medium' | 'low'
    competitorOrAlly?: 'competitor' | 'ally' | 'neutral'
    notes?: string
  }

  // Discovery metadata
  discoveredAt: string
  discoveredVia: string  // 'exa', 'apify', 'manual', etc.
  sources: string[]  // URLs where we found info about them
}

export interface InfluencerDatabase {
  brand: Brand
  lastUpdated: string
  influencers: Influencer[]

  // Aggregated insights
  insights?: {
    topThemes: { theme: ContentTheme; count: number }[]
    platformBreakdown: { platform: Platform; count: number }[]
    aestheticClusters: string[]
    gaps: string[]
  }
}

export interface DiscoveryResult {
  url: string
  title: string
  description: string
  platform?: Platform
  relevanceScore: number
  discoveredVia: string
}

export interface LandscapeAnalysis {
  brand: Brand
  generatedAt: string

  influencerTiers: {
    tier1: Influencer[]  // Must follow/partner
    tier2: Influencer[]  // Worth watching
    tier3: Influencer[]  // On radar
  }

  contentThemes: {
    theme: string
    prevalence: 'high' | 'medium' | 'low'
    engagement: 'high' | 'medium' | 'low'
    examples: string[]
  }[]

  aestheticAnalysis: {
    dominant: string
    emerging: string
    gap: string  // What's missing that GiveCare could own
  }

  positioning: {
    alignWith: string[]
    counterPosition: string[]
    uniqueAngle: string
  }
}
