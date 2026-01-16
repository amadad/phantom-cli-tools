---
name: image-gen
description: Generate brand-consistent images for phantom-loom social content. Use when (1) creating images for posts (polaroid, editorial, illustration styles), (2) removing backgrounds from generated images, (3) converting formats (PNG to WebP), (4) building image prompts from brand config. Covers Gemini generation, Replicate background removal, and sharp processing. Triggers on "generate image", "polaroid", "instax", "remove background", "webp", "social image".
---

# Image Generation

Generate on-brand images for phantom-loom content. Uses existing generation code - this skill provides prompt patterns and post-processing workflows.

## Quick Reference

### Models

| Model | Use | Cost | Notes |
|-------|-----|------|-------|
| `gemini-2.5-flash-image` | Drafts, iteration | Cheap | Text-only prompts |
| `gemini-3-pro-image-preview` | Final quality, style transfer | Expensive | Up to 6 reference images |
| `bria/remove-background` | Background removal | ~$0.01 | Via Replicate API |

### Aspect Ratios

| Ratio | Use Case |
|-------|----------|
| `1:1` | Instagram feed, default |
| `4:3` | Instax Wide polaroid |
| `9:16` | Stories, Reels, TikTok |
| `16:9` | Twitter, LinkedIn, YouTube |
| `4:5` | Instagram portrait |

### Output Paths

| Type | Location |
|------|----------|
| Generated images | `output/assets/` |
| Brand references | `brands/{brand}/styles/` |

---

## Prompt Structure

All image prompts follow this pattern:

```
FORMAT & FRAME:
- [dimensions, aspect ratio]
- [borders, background color]
- [rotation, wear, edge treatment]
- [what NOT to include - timestamps, text, etc.]

PHOTOGRAPHY STYLE:
- [lighting - flash, natural, studio]
- [grain, texture, color treatment]
- [aesthetic reference - editorial, documentary, etc.]

SCENE:
- [subject - who, what they're wearing]
- [action - what they're doing]
- [setting - where, time of day]
- [background elements - objects that tell story]
- [expression/mood - contemplative, joyful, etc.]

NOT:
- [explicit exclusions]
- [clichés to avoid]
- [aesthetic anti-patterns]
```

---

## Style Selection

Brand configs define reference styles in `visual.reference_styles`. Each style has:
- `mood_keywords` - triggers for automatic selection
- `style_description` - detailed generation instructions
- `images` - reference URLs for style transfer

**Read brand config first:**
```typescript
// Check brands/<brand>/<brand>-brand.yml → visual.reference_styles
// Match content topic against mood_keywords
```

Use the styles defined in your brand config.

---

## Workflows

### 1. Generate Image

Use existing functions from `agent/src/core/image.ts`:

```typescript
import { generateImage, generateImageWithReferences, saveImage } from './core/image'

// Text-only (cheap, fast)
const result = await generateImage(prompt, {
  aspectRatio: '4:3',
  preferExpensive: false
})

// With style transfer (quality)
const result = await generateImageWithReferences(prompt, [
  'https://example.com/ref1.jpg',
  '/path/to/local/ref2.png'
], {
  aspectRatio: '1:1',
  resolution: '2K'
})

// Save to disk
saveImage(result, 'output/assets/my-image.png')
```

### 2. Remove Background

Uses Replicate `bria/remove-background`. Requires `REPLICATE_API_TOKEN` in env.

```typescript
import { config } from 'dotenv'
import { readFile } from 'fs/promises'
import Replicate from 'replicate'

config({ path: '.env' })
const replicate = new Replicate()

// Load local file as data URI
const imageBuffer = await readFile(inputPath)
const dataUri = `data:image/png;base64,${imageBuffer.toString('base64')}`

// Remove background
const output = await replicate.run('bria/remove-background', {
  input: { image: dataUri }
})

// Fetch result
const url = (output as any).url()
const response = await fetch(url)
const resultBuffer = Buffer.from(await response.arrayBuffer())
```

### 3. Convert to WebP

Uses sharp for format conversion with quality control.

```typescript
import sharp from 'sharp'

// PNG to WebP with transparency
await sharp(inputBuffer)
  .webp({ quality: 90 })
  .toFile(outputPath)

// From file to file
await sharp('input.png')
  .webp({ quality: 90 })
  .toFile('output.webp')
```

### 4. Full Pipeline

Generate → Remove BG → Convert:

```typescript
// 1. Generate
const result = await generateImage(prompt, { aspectRatio: '4:3' })
saveImage(result, 'output/assets/temp.png')

// 2. Remove background
const imageBuffer = await readFile('output/assets/temp.png')
const dataUri = `data:image/png;base64,${imageBuffer.toString('base64')}`
const output = await replicate.run('bria/remove-background', { input: { image: dataUri } })
const noBgBuffer = Buffer.from(await (await fetch((output as any).url())).arrayBuffer())

// 3. Convert to webp
await sharp(noBgBuffer).webp({ quality: 90 }).toFile('output/assets/final.webp')
```

---

## Instax Wide / Polaroid Template

For authentic polaroid-style images:

```
FORMAT & FRAME:
- Full Instax Wide polaroid on solid background (#1E1B16)
- White border visible ALL sides, thicker at bottom
- Slightly rotated 2-3 degrees, casually placed
- Worn, slightly roughened edges - handled, kept in pocket
- NO date stamp, NO text overlay

PHOTOGRAPHY STYLE:
- Heavy visible film grain throughout
- Direct flash - harsh on-camera flash, slight overexposure
- Warm tungsten indoor lighting mixed with flash
- Slightly desaturated, warm color cast
- Authentic instant film look - imperfect, real

SCENE:
[Your subject description here]
- Include specific details: clothing, setting, time of day
- Background elements that tell a story
- Expression: thoughtful, present, NOT sad or exhausted

NOT:
- No clinical/hospital settings
- No sad or exhausted expressions
- No over-posed stock photo feel
- No elderly stereotypes
- No perfect lighting
```

---

## Brand Guardrails

Always check `brands/{brand}.yml` → `visual.avoid` before generating:

**<Brand> avoids:**
- Elderly hands holding tea
- Grandma in rocking chair
- Soft focus nostalgic scenes
- Clinical/hospital settings
- Stock photography martyrdom
- Sad caregiver imagery
- Pastel watercolors
- Gentle sunsets with quotes
- Anyone looking defeated
- Multigenerational hand-holding

---

## Existing Code Reference

| What | Location |
|------|----------|
| `generateImage()` | `agent/src/core/image.ts:64` |
| `generateImageWithReferences()` | `agent/src/core/image.ts:139` |
| `saveImage()` | `agent/src/core/image.ts:260` |
| `buildImagePrompt()` | `agent/src/core/brand.ts` |
| `selectReferenceStyle()` | `agent/src/core/brand.ts` |
| Reference styles | `brands/{brand}.yml` → `visual.reference_styles` |
| Style images | `brands/{brand}/styles/` |
| Types | `agent/src/core/types.ts` |

---

## Dependencies

Required in `agent/package.json`:
- `@google/genai` - Gemini image generation
- `replicate` - Background removal
- `sharp` - Image processing
- `dotenv` - Environment loading

Required env vars:
- `GEMINI_API_KEY`
- `REPLICATE_API_TOKEN`
