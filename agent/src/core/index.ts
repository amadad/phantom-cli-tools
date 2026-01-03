/**
 * Core module exports
 */

// Types
export * from './types'

// Brand
export {
  loadBrand,
  clearBrandCache,
  getBrandVisualStyle,
  buildImagePrompt,
  buildVoiceContext,
  detectFrameType,
  selectReferenceStyle,
  getAbsoluteReferenceImagePaths,
  buildImagePromptWithStyleContext,
  buildSCTYPrompt,
  buildSCTYPromptFromStyle
} from './brand'
export type { SCTYPromptVariables } from './brand'

// Image
export {
  generateImage,
  generateImageWithReferences,
  saveImage
} from './image'

// Generate
export {
  generateContent,
  generateCopyOnly
} from './generate'
export type { GenerateOptions } from './generate'
