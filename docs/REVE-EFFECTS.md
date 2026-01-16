# Reve Effects Guide

Based on your message about "effects with adjustable sliders for texture, light, or color," here's how to use Reve's effects in phantom-loom.

## How Reve Effects Work

Reve effects are **prompt-driven** rather than explicit API parameters. The model supports 27 visual styles and advanced image manipulation through natural language descriptions.

## Effect Categories

### 1. Texture Effects

```typescript
// Film grain
"Apply subtle 35mm film grain texture"
"Add heavy Super 8 film grain with visible emulsion"
"Smooth digital texture with minimal noise"

// Surface textures
"Canvas texture like an oil painting"
"Glossy magazine editorial finish"
"Matte paper texture with slight tooth"
```

### 2. Light Effects

```typescript
// Lighting adjustments
"Increase contrast with dramatic shadows"
"Soft diffused lighting like overcast day"
"Strong directional light from upper left"
"Warm golden hour lighting"
"Cool blue hour atmosphere"

// Advanced lighting
"Add lens flare from top right"
"Subtle vignette darkening edges"
"High-key bright lighting, minimal shadows"
"Low-key dramatic chiaroscuro lighting"
```

### 3. Color Effects

```typescript
// Color grading
"Cinematic teal and orange color grade"
"Desaturated muted pastel colors"
"Vibrant saturated colors like Fujifilm Velvia"
"Warm sepia tone"
"Cool blue color cast"

// Color corrections
"Increase warmth by +20%"
"Boost saturation in reds and oranges"
"Shift colors toward cooler tones"
```

### 4. Visual Treatments

```typescript
// Film stocks
"Kodak Portra 400 film aesthetic"
"Fujifilm Pro 400H soft colors"
"Kodak Ektar 100 vibrant saturation"
"Ilford HP5 black and white grain"

// Post-processing
"Professional color correction"
"Lifted blacks for vintage look"
"Crushed blacks for modern contrast"
"Faded film look with reduced contrast"
```

## Integration with Phantom Loom

### Method 1: Per-Brand Style Configuration

In `brands/<name>/<name>-brand.yml`:

```yaml
visual:
  image_direction:
    technique:
      - "Cinematic color grading with teal shadows and warm highlights"
      - "Subtle film grain texture"
      - "Professional color correction with lifted blacks"
```

### Method 2: Per-Image Type Effects

In `agent/src/generate/image.ts`, enhance prompts:

```typescript
case 'photo':
  return `Editorial fashion photography. Match the style, lighting, and mood of the reference image.

Scene: ${direction}

Style (from reference):
- Warm color tones, editorial lighting
- Empowered, confident mood - NOT sad or defeated
- Fashion editorial feel
- Shallow depth of field

Effects:
- Subtle film grain texture like Kodak Portra 400
- Professional color grading with warm highlights
- Soft vignette on edges

DO NOT include text or logos in the image.
${learningsContext}`
```

### Method 3: Runtime Effects via Explore Command

When generating content, pass effects in the topic:

```bash
npx tsx src/cli.ts explore <brand> \
  "Caregiver strength [cinematic teal-orange grade, film grain]"
```

## Reve vs Gemini Effects Comparison

| Feature | Gemini | Reve |
|---------|--------|------|
| Film grain | ⚠️ Inconsistent | ✓ Strong adherence |
| Color grading | ⚠️ Generic | ✓ Precise control |
| Typography | ❌ Poor | ✓ 98% accuracy |
| Style consistency | ⚠️ Variable | ✓ 27 distinct styles |
| Reference adherence | ⚠️ Loose | ✓ Strong |

## Testing Effects

Create a test script to compare effects:

```bash
cd agent

# Test 1: Film grain
IMAGE_PROVIDER=reve npx tsx src/cli.ts explore <brand> \
  "Professional caregiver [add 35mm film grain texture]"

# Test 2: Color grading
IMAGE_PROVIDER=reve npx tsx src/cli.ts explore <brand> \
  "Caregiver compassion [cinematic teal and orange color grade]"

# Test 3: Lighting
IMAGE_PROVIDER=reve npx tsx src/cli.ts explore <brand> \
  "Caregiver at work [warm golden hour lighting, soft shadows]"
```

## Effect Stacking

Reve handles multiple effects well:

```typescript
const effectStack = [
  "Kodak Portra 400 film aesthetic",
  "Warm golden hour lighting",
  "Subtle vignette",
  "Professional color correction",
  "Shallow depth of field"
].join(' + ')

// Use in prompt:
`${basePrompt}

Effects: ${effectStack}`
```

## 27 Visual Styles

Reve supports these distinct styles (use in prompts):

**Photography:**
- Photorealism
- Editorial
- Documentary
- Fashion
- Street photography

**Illustration:**
- Anime
- Conceptual art
- Digital painting
- Watercolor
- Oil painting

**Design:**
- Minimalist
- Geometric
- Abstract
- Poster design
- Vintage

**Cinematic:**
- Film noir
- Cyberpunk
- Sci-fi
- Fantasy
- Horror

**Experimental:**
- Glitch art
- Double exposure
- Collage
- Mixed media

## Advanced: Style + Effect Combinations

```typescript
// Documentary + grain
"Documentary street photography style. Add heavy film grain like Tri-X 400 pushed to 1600."

// Editorial + color grade
"Fashion editorial style. Apply teal shadows and warm skin tones color grade."

// Conceptual + texture
"Conceptual art style. Canvas texture with visible brushstrokes."
```

## Credit Costs

Based on testing:
- **Create** (no reference): ~18 credits
- **Remix** (with reference): ~30 credits

Effects don't increase cost - they're part of the prompt.

## Best Practices

1. **Be specific**: "Subtle film grain" vs "Add grain"
2. **Reference film stocks**: Reve knows Kodak, Fuji, Ilford
3. **Stack compatible effects**: Grain + color grade works well
4. **Test with reference images**: Remix endpoint preserves effects better
5. **Use learnings**: Track successful effect combos in `learnings.json`

## Next Steps

1. **Test effects with your brand styles**:
   ```bash
   cd agent
   IMAGE_PROVIDER=reve npx tsx test-reve.ts
   ```

2. **Compare with Gemini**:
   ```bash
   IMAGE_PROVIDER=gemini npx tsx src/cli.ts explore <brand> "topic"
   IMAGE_PROVIDER=reve npx tsx src/cli.ts explore <brand> "topic"
   ```

3. **Grade results and aggregate learnings**:
   ```bash
   npx tsx src/cli.ts grade <brand> "generated text"
   npx tsx src/cli.ts learn <brand>
   ```

4. **Iterate on best effects** in brand YAML
