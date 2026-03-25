# Loom Runtime Architecture

## Purpose

Loom is a brand communications runtime. It turns brand foundations and workflow input into reviewable communication artifacts.

## Workflows

- `social.post`
- `blog.post`
- `outreach.touch`
- `respond.reply`

## Artifact Flow

Every workflow emits typed artifacts:

- `signal_packet`
- `brief`
- `draft_set`
- `asset_set`
- `outline`
- `article_draft`
- `approval`
- `delivery`

## State

- SQLite stores runs and artifact indexes.
- Artifact payloads are written to `state/artifacts/`.
- Blog publishes export Markdown to `state/exports/`.
- `state/` is runtime-generated and not meant to be committed.

## Public Commands

- `brand`
- `run`
- `review`
- `publish`
- `inspect`
- `retry`
- `ops`
