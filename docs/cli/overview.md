# CLI Design System Overview

Phantom Loom CLI is CLI-first. The command line is the primary interface for orchestration, content generation, and publishing. Every command returns structured JSON with `--json`, making the CLI a toolkit of composable primitives for agent orchestration.

## Principles

- **Composable primitives**: Each pipeline step is a standalone command. Agent orchestrates the sequence.
- **Predictable commands**: Command names are verbs (`copy`, `image`, `poster`, `enqueue`, `post`).
- **Global flags everywhere**: `--brand`, `--json`, `--quiet`, `--verbose` apply to any command.
- **Human + machine output**: Human-friendly output by default, structured JSON with `--json`.
- **Isolated failure**: Copy and image can fail independently. Each step writes to disk for checkpointing.

## Architecture

```
agent/src/cli/
├── index.ts        # Entrypoint, dispatch, error handling
├── registry.ts     # Command definitions + metadata
├── args.ts         # Shared argument parsing
├── types.ts        # CommandContext, CommandDefinition
└── errors.ts       # Exit codes + error formatting
```

## Invocation

```bash
npx tsx src/cli.ts <command> [options]
```

## Command Taxonomy

### Atomic Primitives
Each returns structured JSON with `--json`. Agent-composable.

- `copy` — generate platform copy + eval grading
- `image` — generate brand-consistent image (`--volume <zone>` — override brand default volume zone: mute/quiet/whisper/vocal/loud)
- `poster` — generate platform posters from image + headline
- `enqueue` — add content to brand queue
- `grade` — score content against rubric

### Convenience Wrapper
- `explore` — chains image → copy → grade → poster → enqueue

### Pipeline
- `intel` — weekly: scrape → outliers → hooks
- `post` — publish queue items to platforms
- `queue` — inspect queue items
- `learn` — aggregate eval log into learnings

### Utility
- `token` — check and refresh OAuth tokens
- `video` — generate short-form video
- `brand` — scaffold new brands
- `brief` — daily research digest
- `blog` — long-form blog post

## Shared Arg Parser

All commands use `cli/args.ts` for consistent argument parsing:

```typescript
import { extractBrandTopic } from '../cli/args'

const parsed = extractBrandTopic(args, ['style', 'hook']) // knownFlags = value-taking flags
// → { brand: "givecare", topic: "burnout", flags: { style: "s09" }, booleans: Set(["quick"]) }
```

See [command-spec.md](command-spec.md) for command details.
