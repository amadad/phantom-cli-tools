/**
 * Test Instax Social Template with Brand Assets
 *
 * Generates social hook images using:
 * - Electric Cream palette (#FFFCF5 bg, #54340E text)
 * - Alegreya typography
 * - OpenAI-style logo
 * - Large polaroids cropping off edges for dynamism
 */

import { config } from "dotenv";
import { join } from "path";
config({ path: join(process.cwd(), "..", ".env") });

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { generateInstaxSocial, generateHookSet, type CropPosition } from "./src/templates/instax-social";

const OUTPUT_DIR = join(process.cwd(), "..", "output", "instax-brand");

// Use specific Instax polaroid images with transparent backgrounds
const POLAROID_IMAGES = [
  join(process.cwd(), "..", "output", "nano-banana-style", "feature-checkin-nobg.png"),
  join(process.cwd(), "..", "output", "nano-banana-style", "feature-resources-nobg.png"),
  join(process.cwd(), "..", "output", "nano-banana-style", "feature-tracking-nobg.png"),
];

// Hook content
const HOOKS = [
  {
    headline: "The invisible labor of caregiving",
    subtext: "What 53 million Americans experience daily",
  },
  {
    headline: "Hours no one sees",
    subtext: "The work that falls to family",
  },
  {
    headline: "Joy in the journey",
    subtext: "Finding meaning in care",
  },
];

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("Instax Social Template - Brand Test\n");
  console.log("Brand: Electric Cream palette");
  console.log("Typography: Alegreya serif");
  console.log("Logo: OpenAI-style wordmark\n");

  // Verify polaroid images exist
  const polaroidFiles = POLAROID_IMAGES.filter(f => existsSync(f));
  if (polaroidFiles.length === 0) {
    console.log("ERROR: No polaroid images found at expected paths.");
    console.log("Expected:");
    POLAROID_IMAGES.forEach(p => console.log(`  ${p}`));
    process.exit(1);
  }
  console.log(`Using ${polaroidFiles.length} Instax polaroid images\n`);

  // Generate variations for each hook
  const cropPositions: CropPosition[] = ["crop-right", "crop-bottom", "crop-top-right"];

  for (let i = 0; i < HOOKS.length; i++) {
    const hook = HOOKS[i];
    const polaroidPath = polaroidFiles[i % polaroidFiles.length];

    console.log(`\nHook ${i + 1}: "${hook.headline}"`);
    console.log(`  Polaroid: ${polaroidPath.split("/").pop()}`);

    for (const cropPos of cropPositions) {
      const startTime = Date.now();

      try {
        const buffer = await generateInstaxSocial({
          polaroidPath,
          headline: hook.headline,
          subtext: hook.subtext,
          cropPosition: cropPos,
          ratio: "1:1",
          rotation: cropPos === "crop-bottom" ? 0 : -3,
          scale: cropPos === "crop-bottom" ? 1.1 : 1.0,
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const filename = `hook-${i + 1}-${cropPos}.png`;
        writeFileSync(join(OUTPUT_DIR, filename), buffer);
        console.log(`  ✓ ${cropPos} → ${filename} (${elapsed}s, ${(buffer.length / 1024).toFixed(0)} KB)`);
      } catch (err: any) {
        console.log(`  ✗ ${cropPos}: ${err.message}`);
      }
    }
  }

  // Also generate 4:5 and 9:16 variants for the first hook
  console.log("\nGenerating ratio variants for hook 1...");
  const ratios = ["4:5", "9:16"] as const;
  for (const ratio of ratios) {
    try {
      const buffer = await generateInstaxSocial({
        polaroidPath: polaroidFiles[0],
        headline: HOOKS[0].headline,
        subtext: HOOKS[0].subtext,
        cropPosition: "crop-right",
        ratio,
        rotation: -3,
        scale: 1.0,
      });

      const filename = `hook-1-${ratio.replace(":", "x")}.png`;
      writeFileSync(join(OUTPUT_DIR, filename), buffer);
      console.log(`  ✓ ${ratio} → ${filename}`);
    } catch (err: any) {
      console.log(`  ✗ ${ratio}: ${err.message}`);
    }
  }

  console.log(`\nSaved to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
