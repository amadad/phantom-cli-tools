/**
 * Animate: Particle Cloud with Traveling Focus
 *
 * 1. Generate particle cloud static image
 * 2. Send to Kling with focus-pull animation prompt
 */

import { config } from "dotenv";
import { join } from "path";
config({ path: join(process.cwd(), "..", ".env") });

import satori from "satori";
import sharp from "sharp";
import Replicate from "replicate";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

const ALEGREYA_PATH = join(
  process.cwd(),
  "node_modules/@fontsource/alegreya/files/alegreya-latin-400-normal.woff"
);
const LOGO_PATH = join(process.cwd(), "..", "public", "gc-logo.svg");

const P = {
  primary: "#1E1B16",
  secondary: "#3D3929",
  accent: "#5046E5",
  background: "#FDFBF7",
  midtone: "#7A7265",
};

function loadFonts() {
  return [{
    name: "Alegreya",
    data: readFileSync(ALEGREYA_PATH),
    weight: 400 as const,
    style: "normal" as const,
  }];
}

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Particle Cloud generator
function generateParticleCloud(seed: number) {
  const random = seededRandom(seed);
  const elements: any[] = [];

  // Dense tiny particles
  for (let i = 0; i < 200; i++) {
    const x = 60 + random() * 960;
    const y = 60 + random() * 960;
    const size = 2 + random() * 4;

    elements.push({
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: P.accent,
          opacity: 0.15 + random() * 0.25,
        },
      },
    });
  }

  // Few dramatic large circles
  for (let i = 0; i < 3; i++) {
    const x = 200 + random() * 680;
    const y = 200 + random() * 680;
    const size = 80 + random() * 120;

    elements.push({
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: P.accent,
          opacity: 0.04 + random() * 0.06,
        },
      },
    });
  }

  return elements;
}

function buildLayout() {
  const hook = "65 million\nAmericans\nprovide unpaid care";
  const lines = hook.split("\n");
  const vizElements = generateParticleCloud(42);

  const textElements = lines.map((line, i) => {
    const isEmphasis = i === 0 || i === lines.length - 1;
    return {
      type: "div",
      props: {
        style: {
          fontSize: isEmphasis ? 76 : 58,
          fontFamily: "Alegreya",
          color: isEmphasis ? P.accent : P.background,
          lineHeight: 1.1,
        },
        children: line,
      },
    };
  });

  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        backgroundColor: P.primary,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        position: "relative",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
            },
            children: vizElements,
          },
        },
        ...textElements,
      ],
    },
  };
}

async function addLogo(image: Buffer): Promise<Buffer> {
  try {
    const logoSvg = readFileSync(LOGO_PATH);
    let logoPng = await sharp(logoSvg).resize({ width: 140 }).png().toBuffer();

    // Tint for dark background
    logoPng = await sharp(logoPng)
      .negate({ alpha: false })
      .tint({ r: 253, g: 251, b: 247 })
      .png()
      .toBuffer();

    const logoMeta = await sharp(logoPng).metadata();
    const logoHeight = logoMeta.height || 60;

    return sharp(image)
      .composite([{ input: logoPng, top: 1080 - 60 - logoHeight, left: 60 }])
      .png()
      .toBuffer();
  } catch {
    return image;
  }
}

async function main() {
  const fonts = loadFonts();
  const outputDir = join(process.cwd(), "..", "output", "animations");

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Step 1: Generate static image
  console.log("Step 1: Generating particle cloud static image...\n");

  const layout = buildLayout();
  const svg = await satori(layout, { width: 1080, height: 1080, fonts });
  let png = await sharp(Buffer.from(svg)).png().toBuffer();
  png = await addLogo(png);

  const staticPath = join(outputDir, "particle-cloud-static.png");
  writeFileSync(staticPath, png);
  console.log(`Static image saved: ${staticPath}`);
  console.log(`Size: ${(png.length / 1024).toFixed(1)} KB\n`);

  // Step 2: Send to Kling for animation
  console.log("Step 2: Sending to Kling 2.5 Turbo Pro...\n");

  const replicate = new Replicate();
  const base64 = png.toString("base64");
  const dataUri = `data:image/png;base64,${base64}`;

  const prompt = `Subtle depth-of-field animation. Focus slowly travels between the three text lines - one line becomes sharp while the others become softly blurred. The indigo particles in the background drift very gently, floating slowly. The large blurred circles pulse subtly. Text always remains readable. Smooth seamless loop. Cinematic shallow depth of field effect. Calm, meditative pace.`;

  const negativePrompt = `fast motion, jarring, distorted text, illegible, morphing letters, glitch, shake, zoom, pan, camera movement`;

  console.log("Prompt:", prompt.substring(0, 80) + "...\n");
  console.log("Duration: 5s | Aspect: 1:1\n");

  const startTime = Date.now();

  const output = await replicate.run(
    "kwaivgi/kling-v2.5-turbo-pro",
    {
      input: {
        prompt,
        start_image: dataUri,
        duration: 5,
        aspect_ratio: "1:1",
        negative_prompt: negativePrompt,
        cfg_scale: 0.5,
      }
    }
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Kling completed in ${elapsed}s\n`);

  // Handle output
  let videoBuffer: Buffer;

  if (typeof output === "string") {
    console.log("Video URL:", output);
    const response = await fetch(output);
    videoBuffer = Buffer.from(await response.arrayBuffer());
  } else if (output && typeof (output as any).getReader === "function") {
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
    console.log("Unexpected output:", output);
    return;
  }

  const videoPath = join(outputDir, "particle-cloud-focus-pull.mp4");
  writeFileSync(videoPath, videoBuffer);

  console.log(`\nVideo saved: ${videoPath}`);
  console.log(`Size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\nEstimated cost: $0.35 (5s × $0.07/s)`);
}

main().catch(console.error);
