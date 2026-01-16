/**
 * Poster generation using templates with aspect ratio variants
 *
 * Templates define percentage-based zones for image, text, and logo.
 * Compositing uses Sharp + Satori.
 */

import satori from 'satori'
import sharp from 'sharp'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { TEMPLATES, ASPECT_RATIOS, zoneToPixels, type AspectRatio, type TemplateConfig, type TemplateVariant } from './templates'
import { getAgentDir } from '../core/paths'

interface FontConfig {
  path?: string     // Path to .woff file (optional)
  name?: string     // @fontsource package name (e.g., 'space-grotesk')
  weight: number    // Font weight (300, 400, 700)
}

interface PosterOptions {
  template: string           // Template name (polaroid, editorial, etc.)
  ratio?: AspectRatio        // Aspect ratio variant (square, portrait, story, landscape, wide)
  headline: string
  contentImage: Buffer       // Gemini-generated image
  logoPath?: string          // Path to logo PNG/SVG
  fonts?: {
    headline?: FontConfig    // Custom headline font
    body?: FontConfig        // Custom body font (not used yet)
  }
  style?: {
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
      colors?: {
        onLight?: string
        onDark?: string
      }
    }
    typography?: {
      headline?: {
        scale?: {
          large?: number
          medium?: number
          small?: number
        }
      }
    }
  }
}

/**
 * Load font as ArrayBuffer for Satori
 */
function loadFont(name: string, weight: number): ArrayBuffer {
  const fontDir = join(getAgentDir(), 'node_modules', '@fontsource', name.toLowerCase(), 'files')
  const filename = `${name.toLowerCase()}-latin-${weight}-normal.woff`
  const buffer = readFileSync(join(fontDir, filename))
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

/**
 * Load custom font from path (woff2)
 */
function loadCustomFont(fontPath: string): ArrayBuffer {
  const buffer = readFileSync(fontPath)
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

/**
 * Get background color hex from template background type
 */
function getBackgroundColor(bg: 'light' | 'dark' | 'warm', style?: PosterOptions['style']): string {
  const defaults = {
    warm: '#FCEEE3',
    cream: '#FDFBF7',
    dark: '#1E1B16',
    light: '#FDFBF7'
  }

  if (style?.colors?.backgrounds) {
    if (bg === 'warm') return style.colors.backgrounds.warm || defaults.warm
    if (bg === 'dark') return style.colors.backgrounds.dark || defaults.dark
    return style.colors.backgrounds.cream || defaults.cream
  }

  return defaults[bg] || defaults.cream
}

/**
 * Get font size based on template text size and canvas height
 */
function getFontSize(textSize: 'large' | 'medium' | 'small', height: number, style?: PosterOptions['style']): number {
  // Reduced scales for better proportion
  const defaultScale = { large: 0.04, medium: 0.032, small: 0.025 }
  const scale = style?.typography?.headline?.scale?.[textSize] || defaultScale[textSize]
  return Math.round(height * scale)
}

/**
 * Generate poster from template
 */
export async function generatePoster(options: PosterOptions): Promise<Buffer> {
  const { template: templateName, ratio = 'square', headline, contentImage, logoPath, fonts, style } = options

  // Get template config
  const template = TEMPLATES[templateName]
  if (!template) {
    throw new Error(`Unknown template: ${templateName}. Available: ${Object.keys(TEMPLATES).join(', ')}`)
  }

  // Get variant for requested ratio
  const variant = template.variants[ratio]
  if (!variant) {
    const available = Object.keys(template.variants).join(', ')
    throw new Error(`Template ${templateName} doesn't support ${ratio}. Available: ${available}`)
  }

  const { width, height } = variant
  const backgroundColor = getBackgroundColor(template.background, style)
  const isDarkBg = template.background === 'dark'

  // Convert percentage zones to pixels
  const imageZone = zoneToPixels(variant.imageZone, width, height)
  const textZone = zoneToPixels(variant.textZone, width, height)
  const logoZone = zoneToPixels(variant.logoZone, width, height)

  console.log(`[poster] Template: ${templateName} (${width}x${height}, ${ratio})`)
  console.log(`[poster] Background: ${template.background} → ${backgroundColor}`)
  console.log(`[poster] Headline: "${headline.slice(0, 50)}..."`)

  // Colors from style guide - use brown (secondary) on light, cream on dark
  const textColor = isDarkBg
    ? (style?.colors?.light || '#FFE8D6')
    : (style?.logo?.colors?.onLight || '#54340E')

  const fontSize = getFontSize(template.textSize, height, style)

  // 1. Create base canvas
  const canvas = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: backgroundColor,
    },
  }).png().toBuffer()

  // 2. Resize content image to fit image zone
  const resizedContent = await sharp(contentImage)
    .resize(imageZone.width, imageZone.height, { fit: 'cover' })
    .png()
    .toBuffer()

  // 3. Generate headline text with Satori
  // Use custom font if provided, otherwise fall back to Alegreya
  let fontData: ArrayBuffer
  let fontName: string
  let fontWeight: number

  if (fonts?.headline?.name) {
    // Use @fontsource package
    fontData = loadFont(fonts.headline.name, fonts.headline.weight)
    fontName = fonts.headline.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    fontWeight = fonts.headline.weight
    console.log(`[poster] Font: ${fontName} ${fontWeight}`)
  } else if (fonts?.headline?.path && existsSync(fonts.headline.path)) {
    fontData = loadCustomFont(fonts.headline.path)
    fontName = 'CustomHeadline'
    fontWeight = fonts.headline.weight || 700
    console.log(`[poster] Font: Custom (${fonts.headline.path.split('/').pop()})`)
  } else {
    fontData = loadFont('alegreya', 400)
    fontName = 'Alegreya'
    fontWeight = 400
  }

  const textSvg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: template.textAlign === 'center' ? 'center' : 'flex-start',
          padding: '20px 0',
        },
        children: {
          type: 'div',
          props: {
            style: {
              fontFamily: fontName,
              fontSize: `${fontSize}px`,
              fontWeight: fontWeight,
              color: textColor,
              lineHeight: 1.15,
              textAlign: template.textAlign,
              letterSpacing: fontName === 'CustomHeadline' ? '-0.02em' : 'normal',
            },
            children: headline,
          },
        },
      },
    },
    {
      width: textZone.width,
      height: textZone.height,
      fonts: [{ name: fontName, data: fontData, weight: fontWeight as 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, style: 'normal' }],
    }
  )
  const textImg = await sharp(Buffer.from(textSvg)).png().toBuffer()

  // 4. Prepare composites
  const composites: sharp.OverlayOptions[] = [
    { input: resizedContent, top: imageZone.y, left: imageZone.x },
    { input: textImg, top: textZone.y, left: textZone.x },
  ]

  // 5. Add logo if provided
  if (logoPath && existsSync(logoPath)) {
    const logoColor = isDarkBg
      ? (style?.logo?.colors?.onDark || '#FFE8D6')
      : (style?.logo?.colors?.onLight || '#54340E')

    let logoBuffer: Buffer
    const isSvg = logoPath.endsWith('.svg')

    if (isSvg) {
      // Load SVG and replace fill color
      let svgContent = readFileSync(logoPath, 'utf-8')
      svgContent = svgContent.replace(/fill="#[0-9A-Fa-f]{6}"/g, `fill="${logoColor}"`)

      logoBuffer = await sharp(Buffer.from(svgContent))
        .resize(logoZone.width, logoZone.height, { fit: 'inside' })
        .png()
        .toBuffer()

      console.log(`[poster] Logo: SVG with ${logoColor}`)
    } else {
      // PNG with optional inversion
      let logo = sharp(logoPath)
        .resize(logoZone.width, logoZone.height, { fit: 'inside' })

      if (isDarkBg) {
        logo = logo.negate({ alpha: false })
      }

      logoBuffer = await logo.png().toBuffer()
      console.log(`[poster] Logo: PNG ${isDarkBg ? '(inverted)' : ''}`)
    }

    if (logoBuffer.length > 0) {
      composites.push({ input: logoBuffer, top: logoZone.y, left: logoZone.x })
    }
  } else if (logoPath) {
    console.log(`[poster] Logo not found: ${logoPath}`)
  }

  // 6. Composite everything
  const final = await sharp(canvas)
    .composite(composites)
    .png()
    .toBuffer()

  console.log(`[poster] Composited: image(${imageZone.width}x${imageZone.height}) + text + logo`)

  return final
}

/**
 * Get Gemini aspect ratio string for a template variant
 */
export function getTemplateAspectRatio(templateName: string, ratio: AspectRatio = 'square'): string {
  const template = TEMPLATES[templateName]
  if (!template) return '1:1'

  const variant = template.variants[ratio]
  if (!variant) return '1:1'

  const { width, height } = variant
  const r = width / height

  if (Math.abs(r - 1) < 0.1) return '1:1'
  if (Math.abs(r - 4/5) < 0.1) return '4:5'
  if (Math.abs(r - 3/4) < 0.1) return '3:4'
  if (Math.abs(r - 16/9) < 0.1) return '16:9'
  if (Math.abs(r - 9/16) < 0.1) return '9:16'

  return r > 1 ? '16:9' : '3:4'
}

/**
 * List available templates and their variants
 */
export function listTemplatesWithVariants(): void {
  console.log('\nAvailable Templates:\n')
  for (const [id, config] of Object.entries(TEMPLATES)) {
    console.log(`  ${id}: ${config.description}`)
    console.log(`    Background: ${config.background}, Text: ${config.textSize}`)
    console.log(`    Variants: ${Object.keys(config.variants).join(', ')}`)
    console.log()
  }
}

// Re-export types
export type { AspectRatio } from './templates'
