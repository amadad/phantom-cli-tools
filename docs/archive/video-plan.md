# Video Generation Pipeline for Phantom-Loom

## Summary

Add video generation capabilities with two workflows:
1. **Generate** - Topic → image → animate → voice + music → short
2. **Repurpose** - Existing video → transcribe → extract story → new clips

Target: **YouTube Shorts only** (9:16 / 1080x1920 / <60s) - expand to other platforms later

---

## Critical API Constraints

### Kling 2.5 (Replicate)
- **aspect_ratio is IGNORED when start_image is provided**
- Must generate source image in 9:16 (1080x1920) upfront
- Inputs: `prompt`, `start_image`, `duration` (5 or 10), `negative_prompt`

### Runway Gen-3 (image_to_video)
- Requires header `X-Runway-Version: 2024-11-06`
- **Vertical ratio is 720:1280, NOT 1080:1920**
- Must add post-generation transcode step to upscale to 1080x1920
- Accepts: HTTPS URLs, `runway://` upload URIs, or `data:` URIs

### Luma Dream Machine
- **Requires public image URL in `keyframes.frame0`**
- Must upload to CDN (R2/S3) before calling API
- Does not accept local file paths or base64

---

## Architecture

```
agent/src/video/
├── index.ts              # Main exports + orchestration
├── conform.ts            # POST-GENERATION: normalize to canonical 1080x1920 H.264/AAC
├── providers/
│   ├── index.ts          # Provider factory + INPUT MODE abstraction
│   ├── replicate.ts      # Kling 2.5 (accepts URL or uploaded file ref)
│   ├── runway.ts         # Gen-3 (HTTPS URL, runway:// URI, or data: URI)
│   └── luma.ts           # Dream Machine (REQUIRES public HTTPS URL)
├── audio/
│   ├── index.ts          # Audio orchestration
│   ├── tts.ts            # ElevenLabs voice synthesis
│   ├── music.ts          # Suno (unstable - behind provider interface)
│   └── mixer.ts          # FFmpeg mixing with proper codec handling
├── transcribe.ts         # Whisper (segment-level or word-level)
├── extract-story.ts      # LLM extracts story beats (tolerates segment-only timing)
└── clip.ts               # FFmpeg video clipping
```

---

## Provider Abstraction (Critical Addition)

```typescript
// agent/src/video/providers/index.ts

export type InputMode =
  | 'local_path'      // Can accept file path directly
  | 'public_url'      // Requires HTTPS URL (must upload first)
  | 'data_uri'        // Accepts base64 data: URI
  | 'upload_uri'      // Requires platform-specific upload (runway://)

export interface VideoProvider {
  name: string
  inputModes: InputMode[]  // What this provider accepts

  // Normalize input: if provider needs URL but we have file, upload first
  prepareInput(input: string | Buffer): Promise<string>

  generateFromImage(
    preparedInput: string,  // Already normalized via prepareInput()
    prompt: string,
    options: VideoGenerationOptions
  ): Promise<RawVideoResult>
}

export interface VideoGenerationOptions {
  duration: 5 | 10
  motionStyle: 'subtle' | 'moderate' | 'dynamic'
  negativePrompt?: string
  // NOTE: aspectRatio removed - we enforce 9:16 at image gen step
}

export interface RawVideoResult {
  buffer: Buffer
  reportedDuration: number  // Provider-reported, do not trust
  width: number
  height: number
  provider: string
}
```

**Provider input modes:**
| Provider | Accepts |
|----------|---------|
| Replicate/Kling | `public_url`, file upload via Replicate client |
| Runway | `public_url`, `data_uri`, `upload_uri` (runway://) |
| Luma | `public_url` only (must upload to CDN) |

---

## Conform Step (Mandatory)

After every provider returns, run `conform.ts` to produce canonical output:

```typescript
// agent/src/video/conform.ts

export interface ConformOptions {
  inputPath: string
  outputPath: string
  targetWidth: 1080
  targetHeight: 1920
  maxDuration?: number  // Hard trim if exceeded
}

export interface ConformResult {
  path: string
  duration: number      // MEASURED via ffprobe, not provider-reported
  width: 1080
  height: 1920
  codec: 'h264'
  audioCodec: 'aac'
}

export async function conformVideo(options: ConformOptions): Promise<ConformResult> {
  // FFmpeg command:
  // ffmpeg -i input.mp4 \
  //   -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1" \
  //   -c:v libx264 -preset fast -crf 23 \
  //   -c:a aac -b:a 128k \
  //   -pix_fmt yuv420p \
  //   -movflags +faststart \
  //   -r 30 \
  //   -t ${maxDuration} \
  //   output.mp4

  // Then measure duration with ffprobe:
  // ffprobe -v quiet -show_entries format=duration -of csv=p=0 output.mp4
}
```

**Guarantees:**
- 1080x1920 (scale + letterbox if needed)
- H.264 video, AAC audio (even if silent)
- yuv420p pixel format
- +faststart for streaming
- Constant 30fps
- Duration measured via ffprobe

---

## Implementation Phases

### Phase 1: Core Video Generation

**Files to create:**
- `agent/src/video/index.ts` - Main orchestration
- `agent/src/video/conform.ts` - Post-generation normalization
- `agent/src/video/providers/index.ts` - Provider interface + input mode handling
- `agent/src/video/providers/replicate.ts` - Kling 2.5 implementation
- `agent/src/commands/video.ts` - CLI command

**Files to modify:**
- `agent/src/core/types.ts` - Add QueueItem.video field
- `agent/src/generate/image.ts` - Add 9:16 ratio support for video source images
- `agent/src/cli.ts` - Add 'video' command case

**Critical Phase 1 requirements:**
1. Generate source image in 9:16 (1080x1920) for Kling compatibility
2. After Kling returns, run conform step to produce canonical short.mp4
3. Measure duration with ffprobe, store in QueueItem.video.duration

**New CLI:**
```bash
npx tsx src/cli.ts video <brand> "<topic>" [--provider=replicate]
```

**Flow:**
```
Topic
  │
  ├─→ generateImage(ratio: '9:16')  # CRITICAL: 1080x1920 source
  │         │
  │         └─→ upscale (optional)
  │
  ├─→ provider.prepareInput(imagePath)  # Upload if needed
  │
  ├─→ provider.generateFromImage()  # Kling animation
  │         │
  │         └─→ RawVideoResult (unknown dimensions)
  │
  └─→ conformVideo()  # MANDATORY: normalize to 1080x1920 H.264/AAC
          │
          ├─→ ffprobe duration  # MEASURED, not reported
          │
          └─→ queue (short.mp4)
```

---

### Phase 2: Audio Pipeline

**Files to create:**
- `agent/src/video/audio/tts.ts` - Cartesia SDK (@cartesia/cartesia-js, sonic-3)
- `agent/src/video/audio/music.ts` - Skip v1 (use royalty-free folder or silence)
- `agent/src/video/audio/mixer.ts` - FFmpeg mixing with proper spec

**Mixing command (corrected):**
```bash
# Apply volume to music BEFORE amix, use -shortest, explicit aac codec
ffmpeg -i video.mp4 -i voice.mp3 -i music.mp3 \
  -filter_complex "[2:a]volume=0.3[music];[1:a][music]amix=inputs=2:duration=shortest[a]" \
  -map 0:v -map "[a]" \
  -c:v copy -c:a aac -b:a 128k \
  -shortest \
  output.mp4
```

**Optional loudness normalization:**
```bash
# After mixing, normalize to -14 LUFS for platform compliance
ffmpeg -i mixed.mp4 -af loudnorm=I=-14:TP=-1:LRA=11 -c:v copy output.mp4
```

**Music provider abstraction:**
```typescript
// Suno is unstable - treat as optional dependency
export interface MusicProvider {
  name: string
  available: boolean  // Check at runtime
  generate(options: MusicOptions): Promise<MusicResult>
}

// Fallback: use royalty-free library if Suno unavailable
```

---

### Phase 3: Additional Providers

**Files to create:**
- `agent/src/video/providers/runway.ts`
- `agent/src/video/providers/luma.ts`

**Runway implementation notes:**
- Output is 720:1280 for vertical - conform step upscales to 1080:1920
- Accepts HTTPS URLs, data: URIs, or runway:// upload URIs
- Header: `X-Runway-Version: 2024-11-06`

**Luma implementation notes:**
- Requires public HTTPS URL in `keyframes.frame0`
- Must upload image to R2/S3 first in `prepareInput()`
- Use existing R2 integration from `agent/src/core/r2.ts`

---

### Phase 4: Repurpose Flow

**Files to create:**
- `agent/src/video/transcribe.ts` - Whisper transcription
- `agent/src/video/extract-story.ts` - LLM story extraction
- `agent/src/video/clip.ts` - FFmpeg clipping
- `agent/src/commands/repurpose.ts` - CLI command

**Whisper timestamp granularity:**
```typescript
// OpenAI speech-to-text supports timestamp_granularities[]
// Can return word-level OR segment-level timestamps

export interface TranscribeOptions {
  granularity: 'word' | 'segment'  // word = tight cuts, segment = coarse
}

// extract-story.ts must tolerate segment-only timing
// If word-level unavailable, use segment boundaries for clips
```

**New CLI:**
```bash
npx tsx src/cli.ts repurpose <brand> <source-video> [--clips=3] [--granularity=segment]
```

---

### Phase 5: Eval & Learnings (Optional)

- `agent/src/eval/video-grader.ts`
- Extend `agent/src/eval/learnings.ts`

---

## Queue Item Extension

```typescript
export interface QueueItem {
  // ... existing fields
  video?: {
    url: string              // Path to CONFORMED short.mp4
    duration: number         // MEASURED via ffprobe, not provider-reported
    aspectRatio: '9:16'      // Always 9:16 after conform
    width: 1080
    height: 1920
    provider: string
    sourceImage?: string
    hasAudio: boolean
    audioConfig?: {
      voiceId?: string
      musicStyle?: string
    }
  }
  content: {
    // ... existing
    youtube?: {
      title: string
      description: string
      tags: string[]
    }
  }
}
```

---

## Brand Config Extension

```yaml
video:
  voice:
    provider: cartesia
    model_id: "sonic-english"
    voice_id: "3580e947-2e33-446a-81e7-e69fb55d0a63"  # or per-brand
    speed: 1.0

  music:
    provider: mureka
    style: "minimalist piano, Philip Glass arpeggios, prepared piano like Hauschka, contemplative strings, Nico Muhly textures, sparse and repetitive"
    duration: 30             # seconds
    volume_ratio: 0.25       # Subtle underscore, not competing with voice

  generation:
    primary_provider: replicate
    fallback_provider: luma
    default_duration: 5
    motion_style: subtle
    # NOTE: aspect_ratio removed - always 9:16, enforced at image gen
```

---

## Environment Variables

```bash
# Phase 1 (already have REPLICATE_API_TOKEN)
# none new

# Phase 2
CARTESIA_API_KEY=
CARTESIA_VOICE_ID=
# MUREKA_API_KEY=       # Skip v1 - too expensive

# Phase 3
RUNWAY_API_KEY=
LUMA_API_KEY=

# R2 for Luma uploads (may already exist)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

---

## Verification

**Phase 1:**
```bash
cd agent
npx tsx src/cli.ts video <brand> "AI agents in production"

# Verify:
# 1. Source image is 1080x1920 (9:16)
# 2. short.mp4 exists in output/YYYY-MM-DD/
# 3. ffprobe short.mp4 shows: 1080x1920, h264, aac
# 4. QueueItem.video.duration matches ffprobe output
```

**Phase 2:**
```bash
npx tsx src/cli.ts video <brand> "AI agents" --with-audio

# Verify:
# 1. Audio is mixed (voice audible over music)
# 2. No clipping artifacts
# 3. Duration matches video length (-shortest worked)
```

---

## Key Files to Reference

| File | Purpose |
|------|---------|
| `agent/src/commands/explore.ts` | Pattern for commands (image gen + eval + queue) |
| `agent/src/generate/image.ts` | Image generation - add 9:16 ratio support |
| `agent/src/core/r2.ts` | R2 upload for Luma provider |
| `agent/src/publish/youtube-direct.ts` | YouTube upload API |
| `brands/<brand>/<brand>-brand.yml` | Complex brand config example |

---

## Data Flow Diagrams

### Generate Flow (Phase 1+2)

```
Topic
  │
  ├─→ classify (content type)
  │
  ├─→ generateCopy() ──→ script for TTS
  │
  ├─→ generateImage(ratio: '9:16') ──→ base image (1080x1920)
  │         │
  │         └─→ upscale (optional)
  │                 │
  │                 └─→ provider.prepareInput() ──→ upload if needed
  │                         │
  │                         └─→ animate (Kling/Runway/Luma)
  │                                 │
  │                                 └─→ conformVideo() ──→ 1080x1920 H.264/AAC
  │
  ├─→ generateVoice() ──→ voice.mp3
  │
  ├─→ generateMusic() ──→ music.mp3 (optional)
  │
  └─→ mixAudio() ──→ final short.mp4
          │
          └─→ queue (stage: review)
```

### Repurpose Flow (Phase 4)

```
Source Video
  │
  ├─→ ffmpeg extract audio
  │         │
  │         └─→ Whisper transcribe ──→ segments with timestamps
  │                     │
  │                     └─→ Gemini extract story beats
  │                             │
  │                             └─→ [{ start, end, hook, summary }]
  │
  ├─→ for each story beat:
  │     │
  │     ├─→ clip source video (ffmpeg)
  │     │
  │     ├─→ generate new script (Gemini)
  │     │
  │     ├─→ TTS voice (ElevenLabs)
  │     │
  │     ├─→ generate filler images (gaps)
  │     │
  │     └─→ composite final video
  │             │
  │             └─→ conformVideo() ──→ 1080x1920 H.264/AAC
  │
  └─→ queue (stage: review)
```
