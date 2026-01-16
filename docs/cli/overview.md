# CLI Design System Overview

Phantom Loom CLI is CLI-first. The command line is the primary interface for orchestration, content generation, and publishing. The CLI design system defines a consistent interaction model, command taxonomy, and output contract so every command feels cohesive and scriptable.

## Principles

- **Predictable commands**: Command names are verbs (`intel`, `explore`, `post`, `queue`).
- **Global flags everywhere**: `--brand`, `--json`, `--quiet`, `--verbose` apply to any command.
- **Human + machine output**: Human-friendly output by default, structured JSON with `--json`.
- **No surprises**: Clear usage hints, consistent exit codes, and safe defaults.

## Architecture

```
agent/src/cli/
├── index.ts        # Entrypoint, dispatch, error handling
├── registry.ts     # Command definitions + metadata
├── flags.ts        # Global flags and parsing
├── output.ts       # Output helpers, help formatting
├── errors.ts       # Exit codes + error formatting
└── schemas.ts      # JSON output contracts
```

## Invocation

Use the CLI via tsx:

```bash
npx tsx src/cli.ts <command> [options]
```

## Command Taxonomy

Core commands reflect the pipeline:

- `intel` → outliers + hooks
- `explore` → generate copy + images
- `grade` → score content
- `learn` → aggregate eval log
- `post` → publish queue items
- `queue` → inspect queue
- `video` → generate shorts
- `brand` → scaffold new brands

See [command-spec.md](command-spec.md) for command details.
