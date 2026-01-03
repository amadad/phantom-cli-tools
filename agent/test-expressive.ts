/**
 * Test expressive layouts - more presence, less safe
 */

import { renderExpressive, BOLD_EXAMPLES } from "./src/templates/expressive";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(process.cwd(), "..", "output", "images");

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("Generating expressive layouts...\n");

  for (const { name, spec } of BOLD_EXAMPLES) {
    console.log(`${name}:`);
    console.log(`  texts: ${spec.texts.map(t => `"${t.content.slice(0, 20)}..." (${t.size}, ${t.align || 'center'})`).join(", ")}`);
    console.log(`  logo: ${spec.logo === "none" ? "none" : `${spec.logo.position}/${spec.logo.align}`}`);
    console.log(`  tension: ${spec.tension || "breathe"}`);

    const buffer = await renderExpressive(spec);
    const filename = `expressive-${name}.png`;
    writeFileSync(join(OUTPUT_DIR, filename), buffer);
    console.log(`  → ${filename}\n`);
  }

  console.log("Done.");
}

main().catch(console.error);
