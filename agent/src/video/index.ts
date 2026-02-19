/**
 * Video generation pipeline
 *
 * Flow:
 * 1. Load brief (YAML)
 * 2. For each scene:
 *    a. Generate image (Gemini, 9:16)
 *    b. Animate image (Kling via Replicate)
 *    c. Conform to 1080x1920
 * 3. Stitch all scene clips
 * 4. Generate voice (Cartesia)
 * 5. Mix audio (voice + room tone)
 * 6. Add to queue
 */

import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'
import type { VideoBrief } from '../core/types'
import { createProvider } from './providers'
import { conformVideo, stitchVideos, measureDuration } from './conform'
import { generateSpeech, concatAudio, mixAudio } from './audio'

// Import image generation from existing module
import { generateImage } from '../generate/image'
import { loadBrand } from '../core/brand'

export interface VideoGenerationOptions {
  briefPath: string
  outputDir: string
  provider?: string
  skipAudio?: boolean
  dryRun?: boolean
}

export interface VideoGenerationResult {
  videoPath: string
  duration: number
  scenes: number
  brief: VideoBrief
}

/**
 * Load and parse video brief from YAML
 */
export function loadBrief(briefPath: string): VideoBrief {
  const content = fs.readFileSync(briefPath, 'utf-8')
  return yaml.load(content) as VideoBrief
}

/**
 * Generate a complete video from a brief
 */
export async function generateVideoFromBrief(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  const { briefPath, outputDir, provider = 'replicate', skipAudio = false, dryRun = false } = options

  console.log(`\n[video] Loading brief: ${briefPath}`)
  const brief = loadBrief(briefPath)

  console.log(`[video] Brand: ${brief.meta.brand}`)
  console.log(`[video] Topic: ${brief.meta.topic}`)
  console.log(`[video] Scenes: ${brief.scenes.length}`)
  console.log(`[video] Target duration: ${brief.meta.total_duration}s`)

  // Create output directory
  const sessionDir = path.join(outputDir, `${brief.output.filename}-${Date.now()}`)
  fs.mkdirSync(sessionDir, { recursive: true })

  // Load brand config
  const brand = await loadBrand(brief.meta.brand)

  // Get video provider
  const videoProvider = await createProvider(provider)

  // Process each scene
  const sceneClips: string[] = []

  for (const scene of brief.scenes) {
    console.log(`\n[video] === Scene ${scene.id} ===`)
    console.log(`[video] Script: ${scene.script.slice(0, 60)}...`)

    if (dryRun) {
      console.log(`[video] [DRY RUN] Would generate scene ${scene.id}`)
      continue
    }

    // 1. Generate image (9:16 for Kling compatibility)
    console.log(`[video] Generating image...`)
    const imageResult = await generateImage(
      'video',  // Video type: no style reference, prompt-driven aesthetic
      scene.image_prompt,
      brief.meta.brand,
      '',  // No headline for video
      undefined,
      'portrait'  // 9:16 aspect ratio (portrait = 9:16)
    )

    if (!imageResult) {
      throw new Error(`Failed to generate image for scene ${scene.id}`)
    }

    const imagePath = path.join(sessionDir, `scene-${scene.id}-image.png`)
    if (imageResult.b64) {
      fs.writeFileSync(imagePath, Buffer.from(imageResult.b64, 'base64'))
    }

    // 2. Animate image with video provider
    console.log(`[video] Animating with ${provider}...`)
    const preparedInput = await videoProvider.prepareInput(imagePath)
    const rawVideo = await videoProvider.generateFromImage(
      preparedInput,
      scene.motion_prompt,
      {
        duration: scene.duration <= 5 ? 5 : 10,
        motionStyle: 'subtle',
        negativePrompt: 'glitch, artifact, distortion, fast motion'
      }
    )

    // Save raw video
    const rawVideoPath = path.join(sessionDir, `scene-${scene.id}-raw.mp4`)
    fs.writeFileSync(rawVideoPath, rawVideo.buffer)

    // 3. Conform to canonical format
    console.log(`[video] Conforming...`)
    const conformedPath = path.join(sessionDir, `scene-${scene.id}.mp4`)
    await conformVideo({
      inputPath: rawVideoPath,
      outputPath: conformedPath,
      maxDuration: scene.duration,
      postProcess: brief.style?.post_process ? {
        grainIntensity: brief.style.grain_intensity,
        saturation: brief.style.saturation,
        warmth: brief.style.warmth,
        blur: brief.style.blur
      } : undefined
    })

    sceneClips.push(conformedPath)
  }

  if (dryRun) {
    return {
      videoPath: '',
      duration: 0,
      scenes: brief.scenes.length,
      brief
    }
  }

  // 4. Stitch all scenes together
  console.log(`\n[video] Stitching ${sceneClips.length} scenes...`)
  const stitchedPath = path.join(sessionDir, 'stitched.mp4')
  await stitchVideos(sceneClips, stitchedPath)

  let finalPath = stitchedPath

  // 5. Generate and mix audio
  if (!skipAudio) {
    console.log(`\n[video] Generating voice...`)

    // Concatenate all scene scripts
    const fullScript = brief.scenes.map(s => s.script).join(' ')

    const voicePath = path.join(sessionDir, 'voice.mp3')
    await generateSpeech({
      text: fullScript,
      voiceId: brief.voice.voice_id,
      model: brief.voice.model,
      emotion: brief.voice.emotion,
      speed: brief.voice.speed,
      outputPath: voicePath
    })

    // Find room tone for this brand
    const roomTonePath = path.join(
      process.cwd(),
      '..',
      'brands',
      brief.meta.brand,
      'audio',
      'room-tone.mp3'
    )

    console.log(`\n[video] Mixing audio...`)
    const mixedPath = path.join(sessionDir, `${brief.output.filename}.mp4`)
    await mixAudio({
      videoPath: stitchedPath,
      voicePath,
      backgroundPath: fs.existsSync(roomTonePath) ? roomTonePath : undefined,
      backgroundVolume: 0.15,
      outputPath: mixedPath
    })

    finalPath = mixedPath
  }

  // Get final duration
  const duration = measureDuration(finalPath)

  console.log(`\n[video] === Complete ===`)
  console.log(`[video] Output: ${finalPath}`)
  console.log(`[video] Duration: ${duration.toFixed(2)}s`)
  console.log(`[video] Scenes: ${brief.scenes.length}`)

  return {
    videoPath: finalPath,
    duration,
    scenes: brief.scenes.length,
    brief
  }
}

// Re-export types and utilities
export type { VideoBrief }
export { createProvider } from './providers'
export { conformVideo, stitchVideos, measureDuration } from './conform'
export { generateSpeech, mixAudio } from './audio'
