/**
 * Style Transfer with Nano Banana (Replicate)
 *
 * Uses google/nano-banana on Replicate for style transfer.
 * Applies rayogram/hyperreal aesthetic to GiveCare content.
 */

import { config } from "dotenv";
import { join } from "path";
config({ path: join(process.cwd(), "..", ".env") });

import Replicate from "replicate";
import { writeFileSync, mkdirSync, existsSync } from "fs";

const OUTPUT_DIR = join(process.cwd(), "..", "output", "nano-banana-style");

// Style reference URLs
const STYLE_REFS = [
  "https://pbs.twimg.com/media/G46250hWwAA0Dg3?format=jpg&name=large",
  "https://pbs.twimg.com/media/G5QQFPGX0AA5Ute?format=jpg&name=large",
  "https://pbs.twimg.com/media/G5g9ploWoAAxNjI?format=jpg&name=4096x4096",
];

// Instax Mini format - careful framing for crop zones
const CONTENT_PROMPTS = [
  {
    name: "hero-polaroids",
    prompt: `3 Instax Mini photos scattered casually, shot from above. White borders thicker at bottom. Content: Black woman laughing with elderly mother, Asian kids doing homework, steaming coffee mug. FRAMING: photos clustered in TOP-LEFT, all edges fully visible. Space at bottom-right for crop. Flash, grain, candid.`,
  },
  {
    name: "feature-checkin",
    prompt: `Single large Instax Mini photo fills 90% of frame. White border thicker at bottom. Content: woman on couch texting, lamp glow. FRAMING: photo positioned in RIGHT side of frame - full right edge and top edge visible, LEFT edge and BOTTOM can be cropped. Flash, grain.`,
  },
  {
    name: "feature-resources",
    prompt: `Single large Instax Mini photo fills 90% of frame. White border thicker at bottom. Content: kitchen table overhead with papers, laptop, coffee, glasses. FRAMING: photo positioned in RIGHT side - full right edge and top visible, LEFT and BOTTOM can crop. Flash, grain.`,
  },
  {
    name: "feature-tracking",
    prompt: `Single large Instax Mini photo fills 90% of frame. White border thicker at bottom. Content: open journal, handwritten notes, pen, window light. FRAMING: photo positioned RIGHT side - full right and top edges visible, LEFT and BOTTOM can crop. Flash, grain.`,
  },
];

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("Nano Banana Style Transfer Test\n");
  console.log("Model: google/nano-banana on Replicate\n");
  console.log(`Style references: ${STYLE_REFS.length} URLs\n`);

  const replicate = new Replicate();

  for (const content of CONTENT_PROMPTS) {
    console.log(`Generating: ${content.name}`);
    console.log(`  "${content.prompt.substring(0, 60)}..."\n`);

    const startTime = Date.now();

    try {
      const input = {
        prompt: `Match the exact style of the reference photos. ${content.prompt}`,
        image_input: STYLE_REFS,
        aspect_ratio: "4:3",  // Closer to Instax Mini proportions
      };

      const output = await replicate.run("google/nano-banana", { input });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      // Handle output (FileOutput or URL)
      let imageBuffer: Buffer;

      if (output && typeof (output as any).url === "function") {
        const url = (output as any).url();
        console.log(`  URL: ${url}`);
        const response = await fetch(url);
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
      } else if (typeof output === "string") {
        const response = await fetch(output);
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        console.log(`  Unexpected output type: ${typeof output}\n`);
        continue;
      }

      const filename = `${content.name}.png`;
      writeFileSync(join(OUTPUT_DIR, filename), imageBuffer);
      console.log(`  ✓ ${elapsed}s → ${filename} (${(imageBuffer.length / 1024).toFixed(0)} KB)\n`);
    } catch (err: any) {
      console.log(`  ✗ Error: ${err.message}\n`);
    }
  }

  console.log(`\nSaved to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
