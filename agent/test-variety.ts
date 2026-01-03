/**
 * Generate variety of designs to show system range
 */

import { DesignSpec } from "./src/templates/brand-system";
import { render } from "./src/templates/render";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(process.cwd(), "..", "output", "images");

// Diverse specs showing range of autonomous choices
const VARIETY_SPECS: Array<{ name: string; spec: DesignSpec }> = [
  {
    name: "urgent-stat",
    spec: {
      texts: [
        { content: "1 in 5", role: "display" },
        { content: "caregivers report high emotional stress", role: "caption" },
      ],
      logo: "bottom",
      vertical: "center",
      sizing: "impact",
      ratio: "1:1",
      rationale: "Fraction format hits harder than percentage. Logo bottom lets stat dominate.",
    },
  },
  {
    name: "gentle-question",
    spec: {
      texts: [
        { content: "What would you do with an extra hour today?", role: "headline" },
      ],
      logo: "top",
      vertical: "center",
      sizing: "intimate",
      ratio: "4:5",
      rationale: "Single question, no answer needed. Intimate sizing invites reflection. Portrait for scroll-stopping.",
    },
  },
  {
    name: "twitter-punch",
    spec: {
      texts: [
        { content: "Burnout isn't a badge of honor.", role: "headline" },
      ],
      logo: "bottom",
      vertical: "center",
      sizing: "impact",
      ratio: "16:9",
      rationale: "Sharp statement for Twitter. Impact sizing, logo recedes. Wide format fills timeline.",
    },
  },
  {
    name: "story-affirmation",
    spec: {
      texts: [
        { content: "You're doing better than you think.", role: "headline" },
        { content: "Really.", role: "body" },
      ],
      logo: "bottom",
      vertical: "spread",
      sizing: "balanced",
      ratio: "9:16",
      rationale: "Affirmation with emphasis word. Spread layout creates pause before 'Really.' Story format.",
    },
  },
  {
    name: "linkedin-insight",
    spec: {
      texts: [
        { content: "The average caregiver spends", role: "caption" },
        { content: "24 hours per week", role: "display" },
        { content: "on unpaid care work", role: "caption" },
      ],
      logo: "top",
      vertical: "center",
      sizing: "impact",
      ratio: "1.91:1",
      rationale: "Sandwiched stat for LinkedIn. Professional but impactful. Context above and below the number.",
    },
  },
  {
    name: "testimonial-raw",
    spec: {
      texts: [
        { content: '"Some days I forget to eat."', role: "headline" },
        { content: "— Anonymous caregiver", role: "caption" },
      ],
      logo: "bottom",
      vertical: "center",
      sizing: "intimate",
      ratio: "1:1",
      rationale: "Raw honesty needs space. Intimate sizing, anonymous attribution. Logo quiet at bottom.",
    },
  },
  {
    name: "challenge",
    spec: {
      texts: [
        { content: "Today's challenge:", role: "body" },
        { content: "Do one thing just for you.", role: "headline" },
      ],
      logo: "top",
      vertical: "spread",
      sizing: "balanced",
      ratio: "1:1",
      rationale: "Action prompt. Small label, bigger instruction. Spread creates breathing room.",
    },
  },
  {
    name: "reframe",
    spec: {
      texts: [
        { content: "Rest is not quitting.", role: "headline" },
        { content: "It's refueling.", role: "headline" },
      ],
      logo: "bottom",
      vertical: "center",
      sizing: "impact",
      ratio: "4:5",
      rationale: "Two-part reframe. Same size creates rhythm. Impact for boldness. Portrait for feed.",
    },
  },
];

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("Generating variety...\n");

  for (const { name, spec } of VARIETY_SPECS) {
    const { width, height } = {
      "1:1": { width: 1080, height: 1080 },
      "4:5": { width: 1080, height: 1350 },
      "16:9": { width: 1200, height: 675 },
      "1.91:1": { width: 1200, height: 628 },
      "9:16": { width: 1080, height: 1920 },
    }[spec.ratio]!;

    console.log(`${name} (${spec.ratio}, ${width}x${height})`);
    console.log(`  "${spec.texts[0].content.slice(0, 40)}..."`);
    console.log(`  ${spec.rationale}`);

    const buffer = await render(spec);
    const filename = `variety-${name}.png`;
    writeFileSync(join(OUTPUT_DIR, filename), buffer);
    console.log(`  → ${filename}\n`);
  }

  console.log("Done - 8 varied designs generated.");
}

main().catch(console.error);
