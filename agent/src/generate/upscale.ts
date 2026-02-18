/**
 * Image upscaling via Replicate Real-ESRGAN
 */

/**
 * Upscale image using Replicate Real-ESRGAN (4x)
 * Returns original buffer if REPLICATE_API_TOKEN is not set
 */
export async function upscaleImage(imageBuffer: Buffer): Promise<Buffer> {
  const replicateToken = process.env.REPLICATE_API_TOKEN
  if (!replicateToken) {
    console.log('[upscale] No REPLICATE_API_TOKEN, skipping upscale')
    return imageBuffer
  }

  console.log('[upscale] Upscaling with Real-ESRGAN...')

  const Replicate = (await import('replicate')).default
  const replicate = new Replicate()
  const dataUri = `data:image/png;base64,${imageBuffer.toString('base64')}`

  try {
    const output = await replicate.run('nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa', {
      input: {
        image: dataUri,
        scale: 4,
        face_enhance: false
      }
    })

    const url = typeof output === 'string' ? output : (output as any)?.url?.() || output
    const response = await fetch(url as string)
    const resultBuffer = Buffer.from(await response.arrayBuffer())

    console.log('[upscale] Upscaled 4x')
    return resultBuffer
  } catch (e: any) {
    console.log(`[upscale] Upscale failed: ${e.message}, using original`)
    return imageBuffer
  }
}
