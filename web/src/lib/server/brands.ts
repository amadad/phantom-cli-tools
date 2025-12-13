/**
 * Server functions for brand management
 */

import { createServerFn } from '@tanstack/react-start'

export interface BrandSummary {
  id: string
  name: string
  tone: string
  primaryColor: string
  topics: string[]
}

interface PlatformConfig {
  max_chars?: number
  hashtags?: number
  style?: string
  title_max_chars?: number
  description_max_chars?: number
}

export interface BrandDetail {
  id: string
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
  }
  platforms: {
    twitter?: PlatformConfig
    linkedin?: PlatformConfig
    facebook?: PlatformConfig
    instagram?: PlatformConfig
    threads?: PlatformConfig
    youtube?: PlatformConfig
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

/**
 * List all available brands
 */
export const listBrandsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BrandSummary[]> => {
    const { readdirSync, readFileSync } = await import('fs')
    const { join } = await import('path')
    const yaml = await import('js-yaml')

    const brandsDir = join(process.cwd(), '..', 'brands')

    try {
      const files = readdirSync(brandsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))

      const brands: BrandSummary[] = []

      for (const file of files) {
        try {
          const content = readFileSync(join(brandsDir, file), 'utf-8')
          const brand = yaml.load(content) as any
          const id = file.replace(/\.ya?ml$/, '')

          brands.push({
            id,
            name: brand.name || id,
            tone: brand.voice?.tone || '',
            primaryColor: brand.visual?.palette?.primary || '#000000',
            topics: brand.topics || []
          })
        } catch (e) {
          console.error(`Failed to load brand ${file}:`, e)
        }
      }

      return brands
    } catch {
      return []
    }
  }
)

/**
 * Get full brand details
 */
export const getBrandFn = createServerFn({ method: 'GET' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<BrandDetail | null> => {
    const { readFileSync, existsSync } = await import('fs')
    const { join } = await import('path')
    const yaml = await import('js-yaml')

    const brandPath = join(process.cwd(), '..', 'brands', `${data.id}.yml`)

    if (!existsSync(brandPath)) {
      // Try .yaml extension
      const yamlPath = join(process.cwd(), '..', 'brands', `${data.id}.yaml`)
      if (!existsSync(yamlPath)) {
        return null
      }
    }

    try {
      const content = readFileSync(brandPath, 'utf-8')
      const brand = yaml.load(content) as any

      return {
        id: data.id,
        name: brand.name || data.id,
        url: brand.url || '',
        voice: brand.voice || { tone: '', style: '', rules: [] },
        visual: brand.visual || {
          palette: { primary: '#000', secondary: '#666', accent: '#999' },
          style: '',
          mood: '',
          avoid: []
        },
        platforms: brand.platforms || {
          twitter: { max_chars: 280, hashtags: 3 },
          linkedin: { max_chars: 3000, hashtags: 5 }
        },
        topics: brand.topics || [],
        handles: brand.handles || { twitter: '', linkedin: '' }
      }
    } catch {
      return null
    }
  })
