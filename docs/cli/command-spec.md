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

## Commands

### `intel`

```bash
npx tsx src/cli.ts intel <brand> [options]
```

Options:
- `--skip-enrich`
- `--skip-detect`
- `--skip-extract`
- `--dry-run`

### `explore`

```bash
npx tsx src/cli.ts explore <brand> "<topic>" [options]
```

Options:
- `--pro`
- `--quick`
- `--style <name>`
- `--no-logo`

Aliases: `gen`, `generate`

### `video`

```bash
npx tsx src/cli.ts video <brand> <brief> [options]
```

Options:
- `--dry-run`
- `--skip-audio`
- `--provider=<name>`

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

### `grade`

```bash
npx tsx src/cli.ts grade <brand> "<text>"
```

Aliases: `eval`

### `learn`

```bash
npx tsx src/cli.ts learn <brand>
```

Aliases: `learnings`

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
