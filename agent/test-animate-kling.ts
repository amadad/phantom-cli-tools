/**
 * Test: Animate static Kunz image with Kling 2.5 Turbo Pro
 *
 * Input: auto-the-invisible-made-visible--instagram-feed.png
 * Output: 5s video animation
 */

import { config } from "dotenv";
import { join } from "path";

// Load .env from project root
config({ path: join(process.cwd(), "..", ".env") });

import Replicate from "replicate";
import { readFileSync, writeFileSync } from "fs";

const INPUT_IMAGE = join(process.cwd(), "..", "output", "images", "auto-the-invisible-made-visible--instagram-feed.png");
const OUTPUT_VIDEO = join(process.cwd(), "..", "output", "videos", "animated-invisible-visible.mp4");

async function main() {
  const replicate = new Replicate();

  // Read image and convert to base64 data URI
  const imageBuffer = readFileSync(INPUT_IMAGE);
  const base64 = imageBuffer.toString("base64");
  const dataUri = `data:image/png;base64,${base64}`;

  console.log("Input image:", INPUT_IMAGE);
  console.log("Image size:", (imageBuffer.length / 1024).toFixed(1), "KB");
  console.log();
  console.log("Sending to Kling 2.5 Turbo Pro...");
  console.log("Model: kwaivgi/kling-v2.5-turbo-pro");
  console.log("Duration: 5s | Aspect: 1:1");
  console.log();

  const startTime = Date.now();

  const output = await replicate.run(
    "kwaivgi/kling-v2.5-turbo-pro",
    {
      input: {
        prompt: "Subtle motion, typographic marks gently animate and shift, abstract data visualization coming alive, smooth organic movement, the text 'The invisible made visible' remains static and legible",
        start_image: dataUri,
        duration: 5,
        aspect_ratio: "1:1",
        negative_prompt: "blurry, distorted text, morphing letters, illegible, fast motion, jarring",
        guidance_scale: 0.5,
      }
    }
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Completed in ${elapsed}s`);
  console.log();

  // Ensure output directory exists
  const { mkdirSync, existsSync } = await import("fs");
  const outputDir = join(process.cwd(), "..", "output", "videos");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Handle different output types
  let videoBuffer: Buffer;

  if (typeof output === "string") {
    // URL to video - download it
    console.log("Video URL:", output);
    const response = await fetch(output);
    videoBuffer = Buffer.from(await response.arrayBuffer());
  } else if (output && typeof (output as any).getReader === "function") {
    // ReadableStream - consume it
    console.log("Receiving video stream...");
    const reader = (output as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    videoBuffer = Buffer.concat(chunks.map(c => Buffer.from(c)), totalLength);
  } else {
    console.log("Unexpected output type:", typeof output, output);
    return;
  }

  writeFileSync(OUTPUT_VIDEO, videoBuffer);
  console.log("Saved to:", OUTPUT_VIDEO);
  console.log("File size:", (videoBuffer.length / 1024 / 1024).toFixed(2), "MB");

  // Cost estimate
  console.log();
  console.log("Estimated cost: $0.35 (5s × $0.07/s)");
}

main().catch(console.error);
