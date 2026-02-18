# CLI Output Contract

## Human Output (default)

Commands print human-friendly output with progress, summaries, and next steps.

## JSON Output (`--json`)

The CLI emits structured JSON for scripting and agent consumption.

### Envelope

```json
{
  "status": "ok",
  "command": "copy",
  "data": { ... }
}
```

For errors:

```json
{
  "status": "error",
  "command": "copy",
  "error": {
    "message": "GEMINI_API_KEY not set",
    "code": "missing_env"
  }
}
```

When `--json` is set, standard console output is suppressed. Only the JSON envelope is written to stdout.

### Example: copy

```json
{
  "status": "ok",
  "command": "copy",
  "data": {
    "headline": "Your brain is running 20 tabs",
    "twitter": { "text": "...", "hashtags": ["caregiving", "burnout"] },
    "linkedin": { "text": "...", "hashtags": ["caregiving", "mentalhealth"] },
    "instagram": { "text": "...", "hashtags": ["caregiving", "selfcare"] },
    "threads": { "text": "...", "hashtags": ["caregiving"] },
    "imageDirection": "Bold editorial portrait...",
    "eval": { "score": 84, "passed": true, "attempts": 0 },
    "outputPath": "/output/2026-02-18/caregiver-burnout/copy.md"
  }
}
```

### Example: image

```json
{
  "status": "ok",
  "command": "image",
  "data": {
    "imagePath": "/output/2026-02-18/caregiver-burnout-quick/selected.png",
    "style": "organic_texture",
    "model": "gemini-2.5-flash-image",
    "outputDir": "/output/2026-02-18/caregiver-burnout-quick"
  }
}
```

### Example: poster

```json
{
  "status": "ok",
  "command": "poster",
  "data": {
    "outputs": {
      "twitter": "/output/.../twitter.png",
      "instagram": "/output/.../instagram.png",
      "story": "/output/.../story.png"
    },
    "logoUsed": true,
    "outputDir": "/output/2026-02-18/poster-your-brain-is-running-20"
  }
}
```

### Example: enqueue

```json
{
  "status": "ok",
  "command": "enqueue",
  "data": {
    "queueId": "gen_1739900000000",
    "brand": "givecare",
    "stage": "review"
  }
}
```

### Example: queue list

```json
{
  "status": "ok",
  "command": "queue",
  "data": {
    "brand": "givecare",
    "items": [
      {
        "id": "gen_...",
        "stage": "review",
        "source": { "type": "manual", "topic": "...", "brandName": "givecare" },
        "content": { "topic": "..." },
        "createdAt": "2026-01-16T14:00:00.000Z",
        "updatedAt": "2026-01-16T14:00:00.000Z"
      }
    ]
  }
}
```

See [errors.md](errors.md) for exit codes and error formats.
