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

- `signal_packet` — workflow context and topic signal
- `brief` — brand-grounded creative brief
- `draft_set` — copy variants with headline, body, CTA
- `explore_grid` — 3x3 visual direction grid (fal.ai Flux / Gemini)
- `image_brief` — art direction for source image
- `source_image` — full-res hero image (API or canvas fallback)
- `asset_set` — per-platform composited assets (Twitter, Instagram, LinkedIn, etc.)
- `outline` — blog post structure (blog.post only)
- `article_draft` — longform markdown (blog.post only)
- `approval` — review decision with selected variant
- `delivery` — publish results with platform post URLs

### social.post pipeline

```
signal → brief → draft → explore (3x3 grid) → image (full-res) → render (per-platform)
```

The explore and image steps call fal.ai Flux Pro 1.1 when `FAL_KEY` is set, or Gemini when `GOOGLE_API_KEY` is set. Preferred model: `gemini-3.1-flash-image-preview`. Without either, explore is skipped and image falls back to deterministic canvas generation.

Each brand.yml includes an `image_prompt` field containing a complete generation directive with a `[SUBJECT]` slot that the pipeline fills per post. Brand-specific image prompts define the visual grammar (SCTY: damaged-reproduction process; GiveCare: grounded-fragment with single intervention).

### Brand pillars

Each brand defines content pillars in `brand.yml` with `perspective`, `signals`, `format`, and `frequency`. Pillars drive content strategy: the `signals` array lists topics to monitor, and the `perspective` field shapes how the brand responds to those signals.

### Step definitions

Workflow steps are defined in `runtime/src/runtime/steps.ts`. All steps are async. The `Runtime` class in `runtime.ts` orchestrates execution, artifact storage, and state transitions.

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
