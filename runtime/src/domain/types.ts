export type WorkflowName =
  | 'social.post'
  | 'blog.post'
  | 'outreach.touch'
  | 'respond.reply'

export type SocialPlatform =
  | 'twitter'
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'threads'

export type RunStatus =
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'published'

export type ArtifactType =
  | 'signal_packet'
  | 'brief'
  | 'draft_set'
  | 'explore_grid'
  | 'image_brief'
  | 'source_image'
  | 'asset_set'
  | 'outline'
  | 'article_draft'
  | 'approval'
  | 'delivery'

export type StepName =
  | 'signal'
  | 'brief'
  | 'draft'
  | 'explore'
  | 'image'
  | 'render'
  | 'outline'
  | 'publish'
  | 'review'

export interface BrandAudience {
  id: string
  summary: string
}

export interface BrandOffer {
  id: string
  summary: string
}

export interface BrandPlaybook {
  id: string
  trigger: string
  approach: string
}

export interface BrandContentType {
  id: string
  description: string
  elements: string
  camera?: string
}

export interface BrandFoundation {
  id: string
  name: string
  positioning: string
  audiences: BrandAudience[]
  offers: BrandOffer[]
  proofPoints: string[]
  voice: {
    tone: string
    style: string
    do: string[]
    dont: string[]
  }
  channels: {
    social: { objective: string }
    blog: { objective: string }
    outreach: { objective: string }
    respond: { objective: string }
  }
  handles?: Partial<Record<SocialPlatform, string>>
  visual: {
    logo?: string
    palette: {
      background: string
      primary: string
      accent: string
    }
    typography?: {
      headline?: string
      body?: string
      accent?: string
    }
    style?: string
    composition?: string[]
    texture?: string[]
    contentTypes?: BrandContentType[]
    negative?: string[]
    motif?: string
    imageStyle?: string
    imagePrompt?: string
    layout?: string
  }
  responsePlaybooks: BrandPlaybook[]
  outreachPlaybooks: BrandPlaybook[]
}

export interface RunRecord {
  id: string
  workflow: WorkflowName
  brand: string
  status: RunStatus
  input: Record<string, unknown>
  currentStep: StepName
  createdAt: string
  updatedAt: string
  parentRunId?: string
}

export interface ArtifactRecord {
  id: string
  runId: string
  type: ArtifactType
  step: StepName
  path: string
  createdAt: string
  data: Record<string, unknown>
}

export interface RunDetails {
  run: RunRecord
  artifacts: ArtifactRecord[]
}

export interface ReviewInput {
  decision: 'approve' | 'reject'
  note?: string
  selectedVariantId?: string
}

export interface RetryInput {
  fromStep: StepName
}

export interface RunWorkflowInput {
  workflow: WorkflowName
  brand: string
  input: Record<string, unknown>
}

export interface PublishInput {
  dryRun?: boolean
  platforms?: SocialPlatform[]
}
