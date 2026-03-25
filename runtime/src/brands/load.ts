import { existsSync, readFileSync } from 'fs'
import yaml from 'js-yaml'
import { join } from 'path'
import { resolveRuntimePaths } from '../core/paths'
import type { BrandFoundation } from '../domain/types'

interface LoadBrandOptions {
  root?: string
}

function expectString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid brand foundation: missing ${name}`)
  }
  return value.trim()
}

function expectStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Invalid brand foundation: ${name} must be a string array`)
  }
  return value
}

function expectRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid brand foundation: ${name} must be an object`)
  }
  return value as Record<string, unknown>
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

export function loadBrandFoundation(id: string, options: LoadBrandOptions = {}): BrandFoundation {
  const paths = resolveRuntimePaths(options.root)
  const brandPath = join(paths.brandsDir, id, 'brand.yml')

  if (!existsSync(brandPath)) {
    throw new Error(`Brand foundation not found: ${brandPath}`)
  }

  const raw = yaml.load(readFileSync(brandPath, 'utf8'))
  const data = expectRecord(raw, 'brand')
  const voice = expectRecord(data.voice, 'voice')
  const channels = expectRecord(data.channels, 'channels')
  const visual = expectRecord(data.visual, 'visual')
  const palette = expectRecord(visual.palette, 'visual.palette')
  const handlesRaw = data.handles ? expectRecord(data.handles, 'handles') : undefined

  const audiences = (data.audiences as unknown[] | undefined)?.map((entry) => {
    const item = expectRecord(entry, 'audience')
    return {
      id: expectString(item.id, 'audience.id'),
      summary: expectString(item.summary, 'audience.summary'),
    }
  }) ?? []

  const offers = (data.offers as unknown[] | undefined)?.map((entry) => {
    const item = expectRecord(entry, 'offer')
    return {
      id: expectString(item.id, 'offer.id'),
      summary: expectString(item.summary, 'offer.summary'),
    }
  }) ?? []

  const responsePlaybooks = (data.response_playbooks as unknown[] | undefined)?.map((entry) => {
    const item = expectRecord(entry, 'response_playbook')
    return {
      id: expectString(item.id, 'response_playbook.id'),
      trigger: expectString(item.trigger, 'response_playbook.trigger'),
      approach: expectString(item.approach, 'response_playbook.approach'),
    }
  }) ?? []

  const outreachPlaybooks = (data.outreach_playbooks as unknown[] | undefined)?.map((entry) => {
    const item = expectRecord(entry, 'outreach_playbook')
    return {
      id: expectString(item.id, 'outreach_playbook.id'),
      trigger: expectString(item.trigger, 'outreach_playbook.trigger'),
      approach: expectString(item.approach, 'outreach_playbook.approach'),
    }
  }) ?? []

  return {
    id: expectString(data.id, 'id'),
    name: expectString(data.name, 'name'),
    positioning: expectString(data.positioning, 'positioning'),
    audiences,
    offers,
    proofPoints: expectStringArray(data.proof_points, 'proof_points'),
    voice: {
      tone: expectString(voice.tone, 'voice.tone'),
      style: expectString(voice.style, 'voice.style'),
      do: expectStringArray(voice.do, 'voice.do'),
      dont: expectStringArray(voice.dont, 'voice.dont'),
    },
    channels: {
      social: { objective: expectString(expectRecord(channels.social, 'channels.social').objective, 'channels.social.objective') },
      blog: { objective: expectString(expectRecord(channels.blog, 'channels.blog').objective, 'channels.blog.objective') },
      outreach: { objective: expectString(expectRecord(channels.outreach, 'channels.outreach').objective, 'channels.outreach.objective') },
      respond: { objective: expectString(expectRecord(channels.respond, 'channels.respond').objective, 'channels.respond.objective') },
    },
    handles: handlesRaw
      ? Object.fromEntries(
          Object.entries(handlesRaw)
            .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
            .map(([key, value]) => [key, String(value).trim()]),
        )
      : undefined,
    visual: {
      palette: {
        background: expectString(palette.background, 'visual.palette.background'),
        primary: expectString(palette.primary, 'visual.palette.primary'),
        accent: expectString(palette.accent, 'visual.palette.accent'),
      },
      motif: optionalString(visual.motif),
      imageStyle: optionalString(visual.image_style),
      layout: optionalString(visual.layout),
    },
    responsePlaybooks,
    outreachPlaybooks,
  }
}
