/**
 * Video conforming - normalize all provider outputs to canonical format
 *
 * Guarantees:
 * - 1080x1920 (9:16) resolution
 * - H.264 video codec
 * - AAC audio codec (even if silent)
 * - yuv420p pixel format
 * - +faststart for streaming
 * - Constant 30fps
 * - Duration measured via ffprobe
 */

import { execSync, exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

export interface ConformOptions {
  inputPath: string
  outputPath: string
  targetWidth?: number
  targetHeight?: number
  maxDuration?: number
  // Film grain post-processing
  postProcess?: {
    grainIntensity?: number
    saturation?: number
    warmth?: number
    blur?: number  // 0-2, soft focus effect
  }
}

export interface ConformResult {
  path: string
  duration: number  // Measured via ffprobe
  width: number
  height: number
  codec: string
  audioCodec: string
}

/**
 * Measure video duration using ffprobe
 */
export function measureDuration(videoPath: string): number {
  const result = execSync(
    `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${videoPath}"`,
    { encoding: 'utf-8' }
  )
  return parseFloat(result.trim())
}

/**
 * Get video dimensions using ffprobe
 */
export function getVideoDimensions(videoPath: string): { width: number; height: number } {
  const result = execSync(
    `ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${videoPath}"`,
    { encoding: 'utf-8' }
  )
  const [width, height] = result.trim().split(',').map(Number)
  return { width, height }
}

/**
 * Conform video to canonical 1080x1920 H.264/AAC format
 */
export async function conformVideo(options: ConformOptions): Promise<ConformResult> {
  const {
    inputPath,
    outputPath,
    targetWidth = 1080,
    targetHeight = 1920,
    maxDuration,
    postProcess
  } = options

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Build filter chain
  const filters: string[] = []

  // Scale and pad to target dimensions (letterbox if needed)
  filters.push(
    `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`,
    `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2`,
    'setsar=1'
  )

  // Post-processing for film look
  if (postProcess) {
    // Slight blur/soft focus first (before grain)
    if (postProcess.blur && postProcess.blur > 0) {
      filters.push(`gblur=sigma=${postProcess.blur}`)
    }
    if (postProcess.grainIntensity) {
      filters.push(`noise=c0s=${postProcess.grainIntensity}:allf=t`)
    }
    if (postProcess.saturation !== undefined) {
      filters.push(`eq=saturation=${postProcess.saturation}`)
    }
    if (postProcess.warmth !== undefined) {
      // Add warmth via color balance (red shadows, reduce blue)
      filters.push(`colorbalance=rs=${postProcess.warmth}:bs=${-postProcess.warmth * 2}`)
    }
  }

  const filterStr = filters.join(',')

  // Build FFmpeg command
  // NOTE: All inputs must come before output options
  const args: string[] = [
    '-i', `"${inputPath}"`,
    // Add silent audio source as second input (for videos without audio)
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    // Video filter chain
    '-vf', `"${filterStr}"`,
    // Output encoding
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-r', '30',
    // Use shortest input duration (the video, not infinite audio)
    '-shortest'
  ]

  // Add duration limit if specified
  if (maxDuration) {
    args.push('-t', String(maxDuration))
  }

  args.push('-y', `"${outputPath}"`)

  const cmd = `ffmpeg ${args.join(' ')}`
  console.log(`[conform] Running: ${cmd.slice(0, 100)}...`)

  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`[conform] Error: ${stderr}`)
        reject(new Error(`FFmpeg failed: ${error.message}`))
        return
      }

      // Measure actual duration from output file
      const duration = measureDuration(outputPath)
      const { width, height } = getVideoDimensions(outputPath)

      console.log(`[conform] Output: ${outputPath}`)
      console.log(`[conform] Duration: ${duration.toFixed(2)}s, ${width}x${height}`)

      resolve({
        path: outputPath,
        duration,
        width,
        height,
        codec: 'h264',
        audioCodec: 'aac'
      })
    })
  })
}

/**
 * Stitch multiple video clips together
 */
export async function stitchVideos(
  inputPaths: string[],
  outputPath: string
): Promise<ConformResult> {
  // Create concat file
  const concatFile = outputPath.replace('.mp4', '-concat.txt')
  const concatContent = inputPaths.map(p => `file '${p}'`).join('\n')
  fs.writeFileSync(concatFile, concatContent)

  const cmd = `ffmpeg -f concat -safe 0 -i "${concatFile}" -c copy -y "${outputPath}"`

  return new Promise((resolve, reject) => {
    exec(cmd, (error) => {
      // Clean up concat file
      fs.unlinkSync(concatFile)

      if (error) {
        reject(new Error(`Stitch failed: ${error.message}`))
        return
      }

      const duration = measureDuration(outputPath)
      const { width, height } = getVideoDimensions(outputPath)

      resolve({
        path: outputPath,
        duration,
        width,
        height,
        codec: 'h264',
        audioCodec: 'aac'
      })
    })
  })
}
