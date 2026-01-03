/**
 * Test: Flux Pro - Rayogram Hyperreal Aesthetic
 *
 * Surreal + photorealistic, ethereal, Man Ray inspired
 * Objects with impossible clarity in dreamlike compositions
 */

import { config } from "dotenv";
import { join } from "path";
config({ path: join(process.cwd(), "..", ".env") });

import Replicate from "replicate";
import { writeFileSync, mkdirSync, existsSync } from "fs";

const OUTPUT_DIR = join(process.cwd(), "..", "output", "rayogram-hyperreal");

// Rayogram hyperreal prompts based on user's schema
const PROMPTS = [
  {
    name: "kitchen-night",
    prompt: `Rayogram-inspired hyperreal photograph. Kitchen counter at night, single light source casting impossible shadows. Pill organizer casting elongated geometric shadow. Phone face-down, its dark rectangle a void. Glass of water refracting light into spectral bands. Ethereal, dreamlike clarity. Every surface texture hyperreal - wood grain, plastic ridges, glass condensation. Near-black shadows with electric blue light bleeding at edges. Surreal stillness. No people visible but presence implied. Man Ray meets medical still life. 8K detail.`,
  },
  {
    name: "hallway-motion",
    prompt: `Rayogram hyperreal photograph. Dim hallway, door ajar at end with warm light spilling through. Blurred motion trace of figure passing - ethereal, ghostlike, translucent. Keys hanging on wall hook cast sharp geometric shadows. Unopened mail on small table. The blur is the only evidence of human presence. Hyperreal textures on wallpaper, wood floor grain visible. Surreal lighting - shadows fall in impossible directions. Near-black and warm brown palette with hints of electric blue in the motion blur. Dreamlike, liminal space. 8K clarity on still objects.`,
  },
  {
    name: "objects-evidence",
    prompt: `Rayogram-inspired still life. Hyperreal close-up of caregiving evidence: notebook with handwritten notes (illegible but textured), reading glasses casting prismatic shadows, medication schedule printed on paper, pen mid-roll. Arranged like a crime scene photograph but ethereal. Impossible depth of field - everything sharp. Light source from above creating Man Ray-style photogram shadows. Objects float slightly above surface, casting disconnected shadows. Near-black background, objects in warm tan and brown, electric blue light leak on edges. Surreal, sacred, invisible labor made visible. 8K macro detail.`,
  },
  {
    name: "shadow-presence",
    prompt: `Rayogram hyperreal photograph. Empty bedroom corner, morning light through blinds casting geometric stripe shadows. Unmade bed edge visible. Shadow of standing figure on wall - but no figure in frame. The shadow is sharp, hyperreal, more present than any person. Warm brown and tan fabrics, near-black shadows. Electric blue tint in the light stripes. Ethereal stillness, quiet persistence. Texture of linen, wood nightstand grain, dust particles in light beams all hyperreal. Surreal, liminal, Man Ray photogram aesthetic. 8K.`,
  },
];

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const replicate = new Replicate();

  console.log("Testing Flux Pro 1.1 - Rayogram Hyperreal Aesthetic\n");
  console.log("Style: Surreal + photorealistic, ethereal, Man Ray inspired\n");

  for (let i = 0; i < PROMPTS.length; i++) {
    const { name, prompt } = PROMPTS[i];
    console.log(`${i + 1}. ${name}`);
    console.log(`   "${prompt.substring(0, 60)}..."\n`);

    const startTime = Date.now();

    try {
      const output = await replicate.run(
        "black-forest-labs/flux-1.1-pro",
        {
          input: {
            prompt,
            aspect_ratio: "1:1",
            output_format: "png",
            safety_tolerance: 2,
          }
        }
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      // Handle output (URL or stream)
      let imageBuffer: Buffer;

      if (typeof output === "string") {
        const response = await fetch(output);
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } else if (output && typeof (output as any).getReader === "function") {
        const reader = (output as ReadableStream<Uint8Array>).getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        imageBuffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
      } else {
        console.log(`   Unexpected output: ${typeof output}\n`);
        continue;
      }

      const filename = `${i + 1}-${name}.png`;
      writeFileSync(join(OUTPUT_DIR, filename), imageBuffer);

      console.log(`   ✓ ${elapsed}s → ${filename} (${(imageBuffer.length / 1024).toFixed(0)} KB)\n`);
    } catch (err) {
      console.log(`   ✗ Error: ${err}\n`);
    }
  }

  console.log(`\nSaved to: ${OUTPUT_DIR}`);
  console.log(`Estimated cost: ~$0.20 (4 images × $0.05)`);
}

main().catch(console.error);
