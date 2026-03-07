# CLI Command Spec

## Global Usage

```bash
npx tsx src/cli.ts <command> [options]
```

Global options:
- `--brand <name>` default brand for brand-aware commands
- `--json` machine-readable output
- `--quiet` suppress non-error output
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

Generate a brand-consistent image for a topic. Prompt-only — no reference images needed. Brand visual config (`visual.image` + `visual.prompt_system`) drives the aesthetic.

```bash
npx tsx src/cli.ts image <brand> "<topic>" [options]
```

Options:
- `--pro` use Gemini 3 Pro model
- `--quick` skip upscale
- `--knockout` remove background — output transparent PNG
- `--volume <name>` override volume profile

Aliases: `img`

Returns: `{ imagePath, style, model, outputDir }`

### `poster`

Generate platform posters from image + headline.

```bash
npx tsx src/cli.ts poster <brand> --image <path> --headline "<text>" [options]
```

Options:
- `--no-logo` disable logo overlay
- `--no-image` type-only mode (no content image)
- `--volume <name>` apply design zone overrides

Aliases: `finals`

Returns: `{ outputs: { twitter, instagram, story }, logoUsed, outputDir }`

Layout is selected deterministically from brand variants (`visual.variants` + fallback `visual.layouts`) using topic-seeded hashing.

### `visual spectrum`

Evaluate the brand visual space by sweeping profile/layout/style permutations and labelling each point as pass/fail.

```bash
npx tsx src/cli.ts visual spectrum <brand> [options]
```

Options:
- `--profiles <a,b,c>` filter which design profiles to sweep
- `--layouts <split,overlay,type-only,card,full-bleed>`
- `--density <relaxed|moderate|tight>`
- `--alignment <center|left|asymmetric>`
- `--background <light|dark|warm>`
- `--ratio <landscape|portrait|story|square|wide>`
- `--no-image` evaluate only type-only points
- `--render` generate rendered preview cards
- `--render-limit <number>` max points for preview (default 24)
- `--render-dir <path>` write preview files into this directory
- `--render-headline "<text>"` optional headline prefix in rendered cards
- `--serve` host the gallery on `127.0.0.1` for live side-by-side review
- `--serve-port <port>` override server port (default `4173`)
- `--open` open the preview index in your browser
- `--min-contrast <number>` default `4.5`
- `--max-logo-image-overlap <number>` default `0.08`
- `--max-logo-text-overlap <number>` default `0.05`
- `--max-text-image-overlap <number>` default `0.6`
- `--min-text-area <number>` default `0.03`
- `--max-text-area <number>` default `0.65`
- `--min-image-area <number>` default `0.14`
- `--max-logo-area <number>` default `0.18`
- `--seed <text>` stable seed for deterministic IDs/rotation

Returns: `{ brand, ratio, topicSeed, accepted, rejected, thresholds, preview?, points }`

When `--render` is enabled (or `--serve` is used), `preview` is added:
- `outputDir`: directory containing rendered PNGs and `index.html`
- `indexPath`: absolute path to the HTML gallery
- `annotationsPath`: absolute path to `annotations.json` seed file
- `count`: number of rendered cards
- `points`: compact metadata for each rendered point (`profile`, `id`, `label`, `fileName`, `verdict`, `failedChecks`, `manual` default `unrated`)

Gallery interaction:
- thumbs:
  - `👍 Keep` and `👎 Skip` label points manually
  - `↺ Reset` clears a point label
- filter chips: all, auto in/out, manual keep/skip/unrated
- thumbs write back to the running preview server via `POST /__feedback`; the server immediately persists updates into `annotations.json` while you review
- `Copy labeled JSON` and `Download labels` output a review payload in the same schema as `annotations.json`
- When `--serve` is active, the page polls `annotations.json` for updates and reloads for fresh renders.

Each point includes:
- `verdict`: `"in"` or `"out"`
- `label`: stable trace label (`"<profile> | <layout> | <density> | <alignment> | <background>"`)
- `failedChecks`: failed rule keys for quick filtering
- `checks`: named rule checks with pass/fail + observed value + threshold
- `metrics`: geometric and contrast values for tracing why a point failed

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
- `--volume <name>` apply design zone overrides
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
