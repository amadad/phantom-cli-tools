/**
 * Test Kunz-inspired layered grid system
 */

import { renderKunz, KUNZ_EXAMPLES } from "./src/templates/kunz";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(process.cwd(), "..", "output", "images");

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("Generating Kunz-inspired layouts...\n");
  console.log("Dual grid system: 6-column (A) + 5-column (B) overlay\n");

  for (const { name, spec } of KUNZ_EXAMPLES) {
    console.log(`${name}:`);
    console.log(`  rows: ${spec.rows.length} elements`);
    console.log(`  shapes: ${spec.shapes?.length || 0} geometric forms`);
    console.log(`  grid cols: ${spec.rows.map(r => r.col).join(", ")}`);

    const buffer = await renderKunz(spec);
    const filename = `kunz-${name}.png`;
    writeFileSync(join(OUTPUT_DIR, filename), buffer);
    console.log(`  → ${filename}\n`);
  }

  console.log("Done.");
}

main().catch(console.error);
