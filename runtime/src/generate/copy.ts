import type { BrandFoundation } from '../domain/types'

interface SocialDraftOptions {
  brand: BrandFoundation
  topic: string
}

interface SocialDraftVariant {
  id: string
  hook: string
  body: string
  cta: string
}

interface SocialDraftSet {
  channel: 'social'
  headline: string
  imageDirection: string
  variants: SocialDraftVariant[]
}

function cleanTopic(topic: string): string {
  return topic.trim().replace(/\s+/g, ' ')
}

function sentenceCase(value: string): string {
  const trimmed = cleanTopic(value)
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function voiceDescriptor(brand: BrandFoundation): string {
  return compact(`${brand.voice.tone.toLowerCase()} ${brand.voice.style.toLowerCase()}`)
}

function buildEvidenceLine(brand: BrandFoundation): string {
  const proof = brand.proofPoints[0] ?? brand.positioning
  return compact(`${proof} ${brand.positioning}`)
}

function buildImageDirection(brand: BrandFoundation, topic: string): string {
  const motif = brand.visual.motif ?? 'strong brand geometry'
  const imageStyle = brand.visual.imageStyle ?? voiceDescriptor(brand)
  return compact(`${imageStyle}. ${motif} around the idea of ${cleanTopic(topic)}.`)
}

export function generateSocialDraftSet(options: SocialDraftOptions): SocialDraftSet {
  const { brand } = options
  const topic = cleanTopic(options.topic)
  const audience = brand.audiences[0]?.summary ?? 'the audience'
  const objective = brand.channels.social.objective
  const evidence = buildEvidenceLine(brand)
  const dont = brand.voice.dont[0] ?? 'generic language'
  const doRule = brand.voice.do[0] ?? 'say the real thing plainly'

  return {
    channel: 'social',
    headline: sentenceCase(topic),
    imageDirection: buildImageDirection(brand, topic),
    variants: [
      {
        id: 'social-main',
        hook: `${sentenceCase(topic)} is usually treated like a personal problem. It is not.`,
        body: compact(`${brand.name} frames it as a systems issue for ${audience}. ${evidence}`),
        cta: compact(`${doRule}. ${objective}`),
      },
      {
        id: 'social-alt',
        hook: `The usual story about ${topic} hides the real failure.`,
        body: compact(`Most takes fall into ${dont}. ${brand.name} starts with the operational constraint, then names one concrete consequence.`),
        cta: compact(`Start with the system. Then make one useful change.`),
      },
    ],
  }
}
