/**
 * Image Grader
 *
 * Evaluates generated images against brand style criteria.
 * Uses vision LLM to assess brand adherence and quality.
 */

import { GoogleGenAI } from '@google/genai'
import { readFileSync, appendFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getBrandDir, getEvalLogPath } from '../core/paths'
import { loadBrand } from '../core/brand'

// =============================================================================
// TYPES
// =============================================================================

export interface ImageEvalResult {
  passed: boolean
  score: number
  dimensions: {
    color_adherence: number    // 1-10: matches brand palette
    style_match: number        // 1-10: matches reference style
    mood_alignment: number     // 1-10: evokes intended emotion
    technical_quality: number  // 1-10: composition, clarity, no artifacts
    brand_fit: number          // 1-10: overall brand appropriateness
  }
  issues: string[]
  strengths: string[]
  suggestion?: string
}

export interface ImageGradeOptions {
  referenceStyle?: string   // Reference image filename
  intendedMood?: string     // e.g., "warm, empowering"
  log?: boolean
}

// =============================================================================
// GRADING
// =============================================================================

/**
 * Grade an image against brand criteria
 */
export async function gradeImage(
  imageB64: string,
  brandName: string,
  options: ImageGradeOptions = {}
): Promise<ImageEvalResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const brand = loadBrand(brandName)
  const style = (brand as any).style || {}
  const colors = style.colors || {}

  // Build evaluation prompt
  const prompt = buildImageEvalPrompt(brandName, colors, options)

  const ai = new GoogleGenAI({ apiKey })

  // Load reference image if specified
  const parts: any[] = []

  if (options.referenceStyle) {
    const refPath = join(getBrandDir(brandName), 'styles', options.referenceStyle)
    if (existsSync(refPath)) {
      const refBuffer = readFileSync(refPath)
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: refBuffer.toString('base64')
        }
      })
      parts.push({ text: 'REFERENCE IMAGE (target style) above.\n\n' })
    }
  }

  // Add image to evaluate
  parts.push({
    inlineData: {
      mimeType: 'image/png',
      data: imageB64
    }
  })
  parts.push({ text: `IMAGE TO EVALUATE above.\n\n${prompt}` })

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts }]
  })

  const text = (response as any).candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Parse JSON response with fallback
  let judge: any = {}
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      judge = JSON.parse(jsonMatch[0])
    }
  } catch {
    // Fallback to neutral scores on parse failure
  }

  // Compute overall score (weighted average)
  const dimensions = {
    color_adherence: judge.color_adherence || 5,
    style_match: judge.style_match || 5,
    mood_alignment: judge.mood_alignment || 5,
    technical_quality: judge.technical_quality || 5,
    brand_fit: judge.brand_fit || 5
  }

  const weights = {
    color_adherence: 0.20,
    style_match: 0.25,
    mood_alignment: 0.20,
    technical_quality: 0.15,
    brand_fit: 0.20
  }

  const score = Math.round(
    Object.entries(dimensions).reduce((sum, [key, val]) => {
      return sum + val * weights[key as keyof typeof weights] * 10
    }, 0)
  )

  const result: ImageEvalResult = {
    passed: score >= 70 && (judge.issues || []).length < 3,
    score,
    dimensions,
    issues: judge.issues || [],
    strengths: judge.strengths || [],
    suggestion: judge.suggestion
  }

  // Log if enabled
  if (options.log) {
    logImageEval(brandName, result, options)
  }

  return result
}

// =============================================================================
// PROMPT
// =============================================================================

function buildImageEvalPrompt(
  brandName: string,
  colors: Record<string, any>,
  options: ImageGradeOptions
): string {
  const colorList = Object.entries(colors)
    .filter(([k, v]) => typeof v === 'string')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  return `You are evaluating a generated image for the ${brandName} brand.

BRAND COLORS:
${colorList || '(not specified)'}

INTENDED MOOD: ${options.intendedMood || 'warm, empowering, authentic'}

Evaluate the image and respond with JSON only:

{
  "color_adherence": <1-10>,
  "style_match": <1-10>,
  "mood_alignment": <1-10>,
  "technical_quality": <1-10>,
  "brand_fit": <1-10>,
  "issues": ["issue1", "issue2"],
  "strengths": ["strength1", "strength2"],
  "suggestion": "one specific improvement"
}

SCORING GUIDE:
- color_adherence: Does it use brand colors? Avoid off-brand colors?
- style_match: Does it match the reference style (if provided)?
- mood_alignment: Does it evoke the intended emotional response?
- technical_quality: Good composition? Sharp? No AI artifacts?
- brand_fit: Would this look right on the brand's social media?

Be specific in issues/strengths. Focus on actionable feedback.`
}

// =============================================================================
// LOGGING
// =============================================================================

function logImageEval(
  brandName: string,
  result: ImageEvalResult,
  options: ImageGradeOptions
): void {
  const logPath = getEvalLogPath()

  const entry = {
    ts: new Date().toISOString(),
    type: 'image',
    brand: brandName,
    score: result.score,
    passed: result.passed,
    dimensions: result.dimensions,
    issues: result.issues,
    reference: options.referenceStyle
  }

  appendFileSync(logPath, JSON.stringify(entry) + '\n')
}

// =============================================================================
// EXPORTS
// =============================================================================

export { gradeImage as grade }
