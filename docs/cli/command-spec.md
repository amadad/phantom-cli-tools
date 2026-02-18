# CLI Command Spec

## Global Usage

```bash
npx tsx src/cli.ts <command> [options]
```

Global options:
- `--brand <name>` default brand for brand-aware commands
- `--json` machine-readable output
- `--quiet` suppress non-error output
- `--verbose` show extra diagnostics
- `--help` show help for a command

## Atomic Primitives

### `copy`

Generate platform copy for a topic with eval grading and retry.

```bash
npx tsx src/cli.ts copy <brand> "<topic>" [options]
```

Options:
- `--hook "<pattern>"` inject a specific hook pattern

Returns: `{ headline, twitter, linkedin, instagram, threads, imageDirection, eval, outputPath }`

Writes: `copy.md` (human) + `copy.json` (machine) to session dir.

### `image`

Generate a brand-consistent image for a topic.

```bash
npx tsx src/cli.ts image <brand> "<topic>" [options]
```

Options:
- `--pro` use Gemini 3 Pro model
- `--quick` skip moodboard, agent picks from refs
- `--style <name>` force specific style

Aliases: `img`

Returns: `{ imagePath, style, model, outputDir }`

### `poster`

Generate platform posters from image + headline.

```bash
npx tsx src/cli.ts poster <brand> --image <path> --headline "<text>" [options]
```

Options:
- `--no-logo` disable logo overlay

Aliases: `finals`

Returns: `{ outputs: { twitter, instagram, story }, logoUsed, outputDir }`

### `enqueue`

Add generated content to the brand queue.

```bash
npx tsx src/cli.ts enqueue <brand> --topic "<topic>" --copy <path> --image <path> [options]
```

Options:
- `--poster-dir <path>` directory with platform posters

`--copy` accepts `copy.json` (preferred) or `copy.md` (legacy fallback).

Returns: `{ queueId, brand, stage }`

### `grade`

Score content against the brand rubric.

```bash
npx tsx src/cli.ts grade <brand> "<text>"
```

Aliases: `eval`

Returns: `{ score, passed, dimensions, critique, hard_fails }`

## Convenience Wrapper

### `explore`

Chains: image → copy → grade → poster → enqueue → notify.

```bash
npx tsx src/cli.ts explore <brand> "<topic>" [options]
```

Options:
- `--pro`
- `--quick`
- `--style <name>`
- `--no-logo`

Aliases: `gen`, `generate`

Returns: `{ brand, topic, mode, model, outputDir, selectedStyle, eval, queueId, outputs }`

## Pipeline Commands

### `intel`

```bash
npx tsx src/cli.ts intel <brand> [options]
```

Options:
- `--skip-enrich`
- `--skip-detect`
- `--skip-extract`
- `--dry-run`

### `post`

```bash
npx tsx src/cli.ts post <brand> [options]
```

Options:
- `--platforms=twitter,linkedin`
- `--all`
- `--id=<id>`
- `--dry-run`

Aliases: `publish`

### `queue`

```bash
npx tsx src/cli.ts queue [list|show <id>] [brand]
```

Aliases: `q`

### `learn`

```bash
npx tsx src/cli.ts learn <brand>
```

Aliases: `learnings`

## Utility Commands

### `brand`

```bash
npx tsx src/cli.ts brand init <name>
```

### `video`

```bash
npx tsx src/cli.ts video <brand> <brief> [options]
```

Options:
- `--dry-run`
- `--skip-audio`
- `--provider=<name>`

### `brief`

```bash
npx tsx src/cli.ts brief <brand> [options]
```

Options:
- `--topic <text>`
- `--channel`
- `--dry-run`

### `blog`

```bash
npx tsx src/cli.ts blog <brand> "<topic>" [options]
```

Options:
- `--publish`
- `--dry-run`

## Help

```bash
npx tsx src/cli.ts --help
npx tsx src/cli.ts <command> --help
npx tsx src/cli.ts help <command>
```
