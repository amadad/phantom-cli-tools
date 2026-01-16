# CLI Errors

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Runtime error |
| 2 | Usage error (unknown command, bad args) |
| 3 | Configuration error (missing env, invalid config) |

## JSON Error Shape

```json
{
  "status": "error",
  "command": "explore",
  "error": {
    "message": "GEMINI_API_KEY not set",
    "code": "missing_env",
    "details": {
      "env": "GEMINI_API_KEY"
    }
  }
}
```
