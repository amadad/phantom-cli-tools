/**
 * Generate single hook across all platforms
 *
 * Hook: "Do you want me to tell you about my mom?"
 * Source: 50x viral multiplier, question category
 */

import { renderKunz, HOOK_PLATFORMS } from "./src/templates/kunz";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(process.cwd(), "..", "output", "images");

const PLATFORM_INFO: Record<string, { ratio: string; use: string }> = {
  "hook-instagram-feed": { ratio: "1:1", use: "Instagram/Facebook feed" },
  "hook-instagram-portrait": { ratio: "4:5", use: "Instagram feed (portrait)" },
  "hook-stories": { ratio: "9:16", use: "Stories/Reels/TikTok" },
  "hook-twitter": { ratio: "16:9", use: "Twitter/YouTube" },
  "hook-linkedin": { ratio: "1.91:1", use: "LinkedIn article" },
};

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("SINGLE HOOK → ALL PLATFORMS");
  console.log("═══════════════════════════════════════════════════════════");
  console.log();
  console.log('Hook: "Do you want me to tell you about my mom?"');
  console.log("Category: question | Multiplier: 50x | Theme: caregiving");
  console.log();
  console.log("───────────────────────────────────────────────────────────");

  for (const { name, platform, spec } of HOOK_PLATFORMS) {
    const info = PLATFORM_INFO[name];
    console.log();
    console.log(`${name} (${info.ratio})`);
    console.log(`  Platform: ${platform}`);
    console.log(`  Use: ${info.use}`);

    const buffer = await renderKunz(spec);
    const filename = `${name}.png`;
    writeFileSync(join(OUTPUT_DIR, filename), buffer);
    console.log(`  → ${filename}`);
  }

  console.log();
  console.log("───────────────────────────────────────────────────────────");
  console.log("Done. 5 platform variants generated.");
  console.log();
  console.log("Files:");
  for (const { name } of HOOK_PLATFORMS) {
    const info = PLATFORM_INFO[name];
    console.log(`  ${name}.png (${info.ratio}) - ${info.use}`);
  }
}

main().catch(console.error);
