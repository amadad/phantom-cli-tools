/**
 * Audio mixing with FFmpeg
 * Combines voice, background audio, and video
 */

import { exec, execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

export interface MixOptions {
  videoPath: string
  voicePath?: string
  backgroundPath?: string  // Room tone or music
  backgroundVolume?: number  // 0.0-1.0, default 0.25
  outputPath: string
  normalize?: boolean  // Apply loudness normalization
}

export interface MixResult {
  path: string
  duration: number
}

/**
 * Mix audio tracks with video
 */
export async function mixAudio(options: MixOptions): Promise<MixResult> {
  const {
    videoPath,
    voicePath,
    backgroundPath,
    backgroundVolume = 0.25,
    outputPath,
    normalize = false
  } = options

  console.log(`[mixer] Mixing audio...`)
  console.log(`[mixer] Video: ${videoPath}`)
  if (voicePath) console.log(`[mixer] Voice: ${voicePath}`)
  if (backgroundPath) console.log(`[mixer] Background: ${backgroundPath} (vol: ${backgroundVolume})`)

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Build FFmpeg command based on inputs
  let cmd: string

  if (voicePath && backgroundPath) {
    // Mix voice + background
    cmd = `ffmpeg -i "${videoPath}" -i "${voicePath}" -i "${backgroundPath}" \
      -filter_complex "[2:a]volume=${backgroundVolume}[bg];[1:a][bg]amix=inputs=2:duration=shortest[a]" \
      -map 0:v -map "[a]" \
      -c:v copy -c:a aac -b:a 128k \
      -shortest \
      -y "${outputPath}"`
  } else if (voicePath) {
    // Voice only
    cmd = `ffmpeg -i "${videoPath}" -i "${voicePath}" \
      -map 0:v -map 1:a \
      -c:v copy -c:a aac -b:a 128k \
      -shortest \
      -y "${outputPath}"`
  } else if (backgroundPath) {
    // Background only (trim to video length)
    cmd = `ffmpeg -i "${videoPath}" -i "${backgroundPath}" \
      -filter_complex "[1:a]volume=${backgroundVolume}[a]" \
      -map 0:v -map "[a]" \
      -c:v copy -c:a aac -b:a 128k \
      -shortest \
      -y "${outputPath}"`
  } else {
    // No audio - just copy video with silent audio
    cmd = `ffmpeg -i "${videoPath}" \
      -f lavfi -i anullsrc=r=44100:cl=stereo \
      -map 0:v -map 1:a \
      -c:v copy -c:a aac -b:a 128k \
      -shortest \
      -y "${outputPath}"`
  }

  // Clean up command (remove extra whitespace)
  cmd = cmd.replace(/\s+/g, ' ').trim()

  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`[mixer] Error: ${stderr}`)
        reject(new Error(`Mix failed: ${error.message}`))
        return
      }

      // Optionally normalize loudness
      if (normalize) {
        const normalizedPath = outputPath.replace('.mp4', '-normalized.mp4')
        const normCmd = `ffmpeg -i "${outputPath}" -af loudnorm=I=-14:TP=-1:LRA=11 -c:v copy -y "${normalizedPath}"`

        exec(normCmd, (normError) => {
          if (normError) {
            console.warn(`[mixer] Normalization failed, using unnormalized output`)
          } else {
            // Replace with normalized version
            fs.renameSync(normalizedPath, outputPath)
          }
        })
      }

      // Get duration
      const durationStr = execSync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${outputPath}"`,
        { encoding: 'utf-8' }
      )
      const duration = parseFloat(durationStr.trim())

      console.log(`[mixer] Output: ${outputPath} (${duration.toFixed(2)}s)`)

      resolve({
        path: outputPath,
        duration
      })
    })
  })
}

/**
 * Concatenate audio files
 */
export async function concatAudio(
  inputPaths: string[],
  outputPath: string
): Promise<string> {
  // Create concat file
  const concatFile = outputPath.replace(/\.\w+$/, '-concat.txt')
  const concatContent = inputPaths.map(p => `file '${p}'`).join('\n')
  fs.writeFileSync(concatFile, concatContent)

  const cmd = `ffmpeg -f concat -safe 0 -i "${concatFile}" -c copy -y "${outputPath}"`

  return new Promise((resolve, reject) => {
    exec(cmd, (error) => {
      // Clean up concat file
      if (fs.existsSync(concatFile)) {
        fs.unlinkSync(concatFile)
      }

      if (error) {
        reject(new Error(`Concat failed: ${error.message}`))
        return
      }

      resolve(outputPath)
    })
  })
}
