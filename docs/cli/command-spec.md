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
- `--layout <name>` force layout (overlay, split, type-only, card, full-bleed)
- `--nano` use Gemini native single-shot poster generation
- `--pixel-sort` apply pixel sort glitch post-processing
- `--eyebrow "<text>"` override eyebrow label (defaults to pillar label or brand name)

Aliases: `finals`

Returns: `{ outputs: { twitter, instagram, story }, logoUsed, outputDir }`

**Nano mode**: Gemini generates image + typography + layout in one call. Pixel sort + grain + dither applied as post-processing with y-mask protecting the upper 35% (typography zone).

**Standard mode**: Layout selected deterministically from brand variants using topic-seeded hashing.

### `enqueue`

Add generated content to the brand queue.

```bash
npx tsx src/cli.ts enqueue <brand> --topic "<topic>" --copy <path> --image <path> [options]
```

Options:
- `--poster-dir <path>` directory with platform posters

`--copy` accepts `copy.json` (preferred) or `copy.md` (legacy fallback).

Returns: `{ queueId, brand, stage }`

## Convenience Wrapper

### `explore`

Chains: copy → image → poster → enqueue → notify.

```bash
npx tsx src/cli.ts explore <brand> "<topic>" [options]
```

Options:
- `--pro`
- `--quick`
- `--volume <name>` apply design zone overrides
- `--no-logo`
- `--nano` use Gemini native single-shot poster generation
- `--pixel-sort` apply pixel sort glitch post-processing
- `--texture [style]` use p5.brush texture instead of AI image (editorial, expressive, architectural, gestural, layered)
- `--gradient [preset]` use mesh gradient instead of AI image
- `--layout <name>` force layout (overlay, split, type-only, card, full-bleed)

Aliases: `gen`, `generate`

Returns: `{ brand, topic, mode, model, outputDir, selectedStyle, eval, queueId, outputs }`

## Pipeline Commands

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

## Utility Commands

### `review`

Open a visual review gallery for generated posters.

```bash
npx tsx src/cli.ts review [dir|latest]
```

Generates a self-contained HTML gallery with approve/reject buttons. Exports `review.json`.

### `pixel-sort`

Apply pixel sort glitch effect to an image.

```bash
npx tsx src/cli.ts pixel-sort <input> [output] [options]
```

Options:
- `--threshold=<n>` brightness threshold 0-1 (default: 0.3)
- `--streak=<n>` max sorted segment length in px (default: 180)
- `--intensity=<n>` blend factor 0-1 (default: 0.8)
- `--randomness=<n>` segment jitter 0-1 (default: 0.3)

Aliases: `sort`, `glitch`

### `texture`

Generate p5.brush textured backgrounds via Pinch Tab. Text-zone-aware — marks interact with headline placement.

```bash
npx tsx src/cli.ts texture <brand> [--style=<name>] [--size=<WxH>] [--seed=<n>] [--density=<level>] [--out=<path>]
npx tsx src/cli.ts texture --list
```

Options:
- `--style <name>` editorial, expressive, architectural, gestural, layered (default: editorial)
- `--size <WxH>` output size (default: 1200x675)
- `--seed <n>` deterministic seed
- `--density <level>` light, moderate, heavy (default: moderate)
- `--out <path>` output file path

Aliases: `tex`, `brush`

Returns: `{ imagePath, style, width, height }`

Requires Pinch Tab running locally (`pinchtab health`).

### `gradient`

Generate mesh gradient background images. Pure node-canvas, no external deps.

```bash
npx tsx src/cli.ts gradient <brand> [--preset=<name>] [--size=<WxH>] [--seed=<n>] [--out=<path>]
npx tsx src/cli.ts gradient --list
```

Aliases: `grad`, `mesh`

Returns: `{ imagePath, preset, width, height }`

### `brand`

```bash
npx tsx src/cli.ts brand init <name>
```

## Help

```bash
npx tsx src/cli.ts --help
npx tsx src/cli.ts <command> --help
npx tsx src/cli.ts help <command>
```
