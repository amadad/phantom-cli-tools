# Video Techniques Reference

Collected from AI video production courses and experimentation.

## Frame Extraction for Continuity

For longer videos with multiple segments, extract last frame of each clip to use as source for the next transition:

```bash
# Extract last frame
ffmpeg -sseof -1 -i scene-1.mp4 -frames:v 1 last-frame.png

# Use last-frame.png as source image for next Kling generation
```

This creates seamless transitions between segments without jarring cuts.

## Motion Prompt Patterns

**Minimal prompts often work better:**
```
girl doing simple TikTok dance fit check happy shaky camera
```

**For portraits/static shots:**
```
static camera, locked off, subtle breathing, slight head movement
```

**Specify direction explicitly** to prevent backwards motion:
```
walking forward left to right, train passing through frame left to right
```

## Aesthetic Prompt Patterns

### iPhone/Authentic Style
For casual, realistic-looking content:
```
Shot as a casual iPhone snapshot, mildly overexposed, slightly off-center
framing, imperfect composition, subtle motion blur from handheld,
authentic careless mobile phone quality, vertical format
```

### Wong Kar-wai/Christopher Doyle Style
For cinematic emotional content:
```
Wong Kar-wai style, Christopher Doyle cinematography
Bold saturated colors - electric blue, hot pink, amber
Frame within frame composition, reflections layered on reflections
Soft focus throughout, halation on highlights, nothing digitally sharp
```

Film references that work: Chungking Express, In the Mood for Love, 2046, Happy Together

## Character Consistency (for series)

1. Generate initial character image with Gemini/Imagen
2. Upload to Google Whisk → get detailed description
3. Combine original prompt + Whisk description into "core character prompt"
4. Include visual AND audio descriptions for voice consistency
5. Reuse core prompt across all videos in series

## Sound Design

Layer these for immersion:
- **Voice** - TTS (Cartesia, 11Labs)
- **Sound effects** - 11Labs sound effects generator (cooking pots, ambient noise, footsteps)
- **Background music** - Suno for custom, or platform music for social

## Cost Optimization

| Provider | Model | Cost | Use Case |
|----------|-------|------|----------|
| FAL/Replicate | Kling 2.1 Standard | $0.25/5s, $0.50/10s | Testing, budget |
| FAL/Replicate | Kling 2.1 Pro | $0.45/5s | Quality |
| Google | Imagen 4 | $0.04/image | Source images |
| Flow | VO3 Fast | 20 credits | Prompt testing |
| Flow | VO3 Quality | 100 credits | Final renders |

**Pattern:** Test on cheap/fast models first, run quality only on validated prompts.

## Metrics That Matter (for social)

- **Average watch time** - aim for 80%+ retention
- **Swipe rate** - lower is better (people not swiping away)
- **Shares** - critical for viral spread (aim for shares ≈ likes)
- **Comments** - engagement signal

## Prompt Structure (VO3 with dialogue)

For videos with speaking characters:

1. **Scene description** - setting, character, action
2. **Dialogue** - what they say (avoid hyphens, can trigger captions)
3. **Performance direction** - emotional tone, delivery style
4. **Camera/style notes** - shot type, movement, lighting

## Horizontal Montage

Images parallel to narration, not literal illustration:
- Narration: "Shopping, cooking, cleaning, laundry"
- Image: Train crossing, cars waiting (evokes waiting/isolation without being literal)

Creates interpretive space - viewer brings their own meaning.
