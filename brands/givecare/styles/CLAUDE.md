# GiveCare Reference Styles

This directory contains reference images used for Gemini's style transfer feature.
When generating images, Gemini can use up to 6 reference images to maintain visual consistency.

## Required Images

Add PNG images matching these filenames (referenced in `givecare.yml`):

### warm_documentary (family connection moments)
- `warm_doc_01.png` - Intimate family moment, golden hour lighting
- `warm_doc_02.png` - Hands touching, supportive gesture
- `warm_doc_03.png` - Multi-generational scene, warm tones

### quiet_solitude (peaceful alone time)
- `solitude_01.png` - Person by window, contemplative
- `solitude_02.png` - Cozy reading corner, soft light

### hands_detail (close-up textures)
- `hands_01.png` - Weathered hands holding mug
- `hands_02.png` - Hands arranging flowers or writing

### nature_gentle (botanical elements)
- `nature_01.png` - Single flower in window light
- `nature_02.png` - Plant on shelf, soft focus

### watercolor_concept (illustrative style)
- `watercolor_01.png` - Soft watercolor illustration example

## Image Guidelines

- **Resolution**: Minimum 1024x1024, recommended 2048x2048
- **Format**: PNG preferred (supports transparency)
- **Style**: Should exemplify the GiveCare visual identity:
  - Soft natural lighting
  - Muted warm color palette (#FF9F1C primary, #54340E secondary)
  - Documentary/editorial photography feel
  - Shallow depth of field
  - Negative space for text overlay

## How It Works

1. When generating an image, the system analyzes the topic/prompt
2. Mood keywords are matched to reference styles
3. Selected reference images are sent to Gemini alongside the text prompt
4. Gemini uses the reference images for style transfer, maintaining brand consistency

## Sourcing Reference Images

Options for obtaining reference images:
1. **Curate existing brand assets** - Best for consistency
2. **Generate with Gemini** - Use prompts like the scene_templates in givecare.yml
3. **Stock photography** - Filter for editorial/documentary style
4. **AI upscale** - Enhance lower-res brand images

The more on-brand your reference images are, the more consistent your generated content will be.
