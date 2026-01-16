/**
 * Content classification
 * Determines content type and image type from topic
 */

export type ContentType = 'warm' | 'product' | 'thought'
export type ImageType = 'photo' | 'poster' | 'abstract' | 'video'

export interface Classification {
  contentType: ContentType
  imageType: ImageType
}

/**
 * Classify content and image type from topic
 */
export function classify(topic: string): Classification {
  const t = topic.toLowerCase()

  // Content type
  let contentType: ContentType = 'warm'

  if (t.match(/release|launch|announce|feature|update|event|partner|assessment/)) {
    contentType = 'product'
  } else if (t.match(/^observation:|^insight:|^pattern:/)) {
    contentType = 'thought'
  }

  // Image type
  let imageType: ImageType = 'photo'

  // Poster: announcements, promos, events - need text overlay
  if (t.match(/announce|launch|event|promo|campaign|challenge/)) {
    imageType = 'poster'
  }
  // Abstract: reflective, conceptual, thought pieces
  else if (t.match(/observation|insight|pattern|meditation|reflection/)) {
    imageType = 'abstract'
  }
  // Photo: default - editorial, human, emotional

  return { contentType, imageType }
}
