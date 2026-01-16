# Reve API Integration

Phantom Loom now supports **Reve AI** as an alternative image generation provider alongside Gemini.

## Setup

Add your Reve API key to the environment:

```bash
export REVE_API_KEY="papi.0442672e-2302-45d3-8c3c-d7da0aefc257.edKGRUzU73X7tTku43bhRokeMX4_tKJm"
```

Add to your `~/.zshrc` to persist:
```bash
echo 'export REVE_API_KEY="papi.0442672e-2302-45d3-8c3c-d7da0aefc257.edKGRUzU73X7tTku43bhRokeMX4_tKJm"' >> ~/.zshrc
source ~/.zshrc
```

## Testing

Run the test script to verify Reve integration:

```bash
cd agent
npx tsx test-reve.ts
```

This will test:
1. **Create endpoint** - Text-to-image generation
2. **Remix endpoint** - Style transfer with reference images

## Usage

### Option 1: Use Reve as primary provider (Gemini fallback)

```bash
export IMAGE_PROVIDER=reve
npx tsx src/cli.ts explore <brand> "topic"
```

### Option 2: Use Gemini as primary provider (Reve fallback)

```bash
export IMAGE_PROVIDER=gemini  # or leave unset
npx tsx src/cli.ts explore <brand> "topic"
```

### Option 3: Configure per-brand

In your brand YAML file (`brands/<name>/<name>-brand.yml`):

```yaml
visual:
  image_generation:
    provider: reve  # or 'gemini'
    default_aspect_ratio: 3:4
    max_reference_images: 3
```

## How It Works

### Provider Architecture

```
agent/src/generate/
├── providers/
│   ├── index.ts      # Provider interface
│   ├── gemini.ts     # Gemini provider
│   └── reve.ts       # Reve provider (create + remix)
├── image.ts          # Main generation logic
└── classify.ts       # Image type classification
```

### Reve Capabilities

| Endpoint | Use Case | Reference Images |
|----------|----------|------------------|
| `/v1/image/create` | Text-to-image | No |
| `/v1/image/remix` | Style transfer, effects | Yes (1-3 images) |

### Image Type Mapping

| Type | Reference Image | Endpoint Used |
|------|----------------|---------------|
| `photo` | ✓ ref_13_style09.png | remix |
| `poster` | ✓ ref_08_style04.png | remix |
| `abstract` | ✓ ref_09_style05.png | remix |
| `video` | ✗ (prompt only) | create |

### Aspect Ratio Support

Reve supports: `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `9:16`, `16:9`

Unsupported ratios are mapped:
- `4:5` → `4:3`
- `5:4` → `4:3`
- `21:9` → `16:9`

## Credits Tracking

Reve API responses include credit usage:

```typescript
{
  creditsUsed: 126000,
  creditsRemaining: 874000,
  requestId: 'rsid-...'
}
```

Monitor your usage in the console output:
```
[reve] Credits: 126000 used, 874000 remaining
```

## Fallback Behavior

1. Try primary provider (set via `IMAGE_PROVIDER` env var)
2. If unavailable or fails, try secondary provider
3. If all fail, return null

Example fallback order:
- `IMAGE_PROVIDER=reve` → Try Reve → Fallback to Gemini
- `IMAGE_PROVIDER=gemini` → Try Gemini → Fallback to Reve
- No env var → Try Gemini → Fallback to Reve

## Effects Testing

Reve supports various effects through the remix endpoint. Test different prompts:

```typescript
// Cinematic effects
"Apply cinematic color grading with high contrast and film grain"

// Artistic styles
"Transform into oil painting style with visible brushstrokes"

// Technical adjustments
"Enhance with professional color correction and soft vignette"
```

The remix endpoint is particularly powerful for:
- Typography adherence (great for poster templates)
- Style transfer from reference images
- Non-ASCII character rendering (CJK, emoji)

## Troubleshooting

### "REVE_API_KEY not set"
```bash
echo $REVE_API_KEY  # Should output your key
source ~/.zshrc     # If just added to .zshrc
```

### "Reve provider not available"
- Check API key is set correctly
- Verify key format: `papi.<uuid>.<token>`

### "Content policy violation"
- Reve flagged the prompt
- Try rephrasing or removing specific terms

### "All providers failed"
- Check both `REVE_API_KEY` and `GEMINI_API_KEY` are set
- Review error logs for specific failures

## API Documentation

Official docs (limited): https://api.reve.com/console/docs

Community examples: https://github.com/reve-ai/reve-ai-examples
