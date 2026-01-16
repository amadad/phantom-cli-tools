# CLI Output Contract

## Human Output (default)

Commands print human-friendly output with progress, summaries, and next steps.

## JSON Output (`--json`)

The CLI can emit structured JSON for scripting and CI.

### Envelope

```json
{
  "status": "ok",
  "command": "explore",
  "data": {}
}
```

For errors:

```json
{
  "status": "error",
  "command": "explore",
  "error": {
    "message": "GEMINI_API_KEY not set",
    "code": "missing_env"
  }
}
```

### Current Coverage

- The JSON envelope includes command-specific `data` payloads.
- When `--json` is set, standard console output is suppressed.

### Example: queue list

```json
{
  "status": "ok",
  "command": "queue",
  "data": {
    "brand": "<brand>",
    "items": [
      {
        "id": "gen_...",
        "stage": "review",
        "source": { "type": "manual", "topic": "...", "brandName": "<brand>" },
        "content": { "topic": "..." },
        "createdAt": "2026-01-16T14:00:00.000Z",
        "updatedAt": "2026-01-16T14:00:00.000Z"
      }
    ]
  }
}
```

See [errors.md](errors.md) for exit codes and error formats.
