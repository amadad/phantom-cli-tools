/**
 * API client for Cloudflare Workers backend
 */

// Base URL for Workers API (empty string = same origin, works in production)
const API_URL = import.meta.env.VITE_API_URL || '';
const API_KEY = import.meta.env.VITE_API_KEY || '';

// Helper to get auth headers for protected endpoints
function getAuthHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(API_KEY && { 'Authorization': `Bearer ${API_KEY}` })
  };
}

export interface GuardrailsResult {
  passed: boolean;
  score: number;
  violations: string[];
  suggestions: string[];
  details: {
    specificity_score: number;
    cliche_score: number;
    has_cta: boolean;
    banned_phrases_found: string[];
  };
}

export interface GenerationResult {
  success: boolean;
  generationId?: string;
  copy?: {
    twitterText: string;
    twitterHashtags: string[];
    linkedinText: string;
    linkedinHashtags: string[];
    imageDescription: string;
  };
  visual?: {
    imageUrl: string;
    prompt: string;
    aesthetics: {
      mood: string;
      technique: string;
      subject: string;
      colorTone: string;
    };
  };
  guardrails?: GuardrailsResult;
  error?: string;
}

export interface PlatformContent {
  text: string;
  hashtags: string[];
  imageUrl?: string;
}

export interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
}

export interface BrandSummary {
  slug: string;
  name: string;
}

export interface BrandDetail {
  slug: string;
  name: string;
  voice: {
    tone: string;
    style: string;
    rules: string[];
  };
  visual: {
    palette: Record<string, string>;
    style: string;
    mood: string;
    avoid: string[];
  };
  platforms?: Record<string, any>;
}

export interface ScheduledPost {
  id: string;
  generation_id: string;
  brand_slug: string;
  platform: string;
  scheduled_for: string;
  status: string;
  created_at: string;
}

export interface ContentPoolItem {
  id: string;
  brand_slug: string;
  topic: string;
  angle: string;
  hook?: string;
  relevance: number;
  timeliness: string;
  status: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BRANDS
// ─────────────────────────────────────────────────────────────────────────────

export async function listBrands(): Promise<BrandSummary[]> {
  const res = await fetch(`${API_URL}/api/brands`);
  const data = await res.json();
  return data.brands || [];
}

export async function getBrand(slug: string): Promise<BrandDetail | null> {
  const res = await fetch(`${API_URL}/api/brands/${slug}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.brand;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate content (copy + image) for a topic
 */
export async function generateContent(topic: string, brand: string = 'givecare'): Promise<GenerationResult> {
  const res = await fetch(`${API_URL}/api/generate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ brandSlug: brand, topic })
  });

  const data = await res.json();

  if (!data.success) {
    return { success: false, error: data.error };
  }

  return {
    success: true,
    generationId: data.generationId,
    copy: data.copy,
    visual: data.visual
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT POOL (Research + Strategy)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get content pool items for a brand
 */
export async function getContentPool(brand: string, status?: string): Promise<ContentPoolItem[]> {
  const url = new URL(`${API_URL}/api/pool/${brand}`);
  if (status) url.searchParams.set('status', status);

  const res = await fetch(url.toString());
  const data = await res.json();
  return data.items || [];
}

/**
 * Run researcher to generate new content ideas
 */
export async function runResearch(brand: string, focusAreas?: string[]): Promise<{ success: boolean; ideasAdded?: number; error?: string }> {
  const res = await fetch(`${API_URL}/api/agents/research`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ brandSlug: brand, focusAreas })
  });

  return res.json();
}

/**
 * Run strategist to select best content from pool
 */
export async function runStrategy(brand: string, maxItems: number = 3): Promise<{ success: boolean; selected?: ContentPoolItem[]; error?: string }> {
  const res = await fetch(`${API_URL}/api/agents/select`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ brandSlug: brand, criteria: { maxItems } })
  });

  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLISHING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Publish content immediately to platforms
 */
export async function publishContent(
  generationId: string,
  platforms: string[] = ['twitter', 'linkedin'],
  brand: string = 'givecare'
): Promise<{ success: boolean; results: PublishResult[] }> {
  const res = await fetch(`${API_URL}/api/agents/post`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      generationId,
      brandSlug: brand,
      platforms,
      immediate: true
    })
  });

  return res.json();
}

/**
 * Schedule content for future publishing
 */
export async function schedulePost(
  generationId: string,
  brand: string,
  platforms: string[],
  scheduledFor: Date
): Promise<{ success: boolean; scheduled?: Array<{ platform: string; postId: string }>; error?: string }> {
  const res = await fetch(`${API_URL}/api/agents/post`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      generationId,
      brandSlug: brand,
      platforms,
      scheduledFor: scheduledFor.toISOString()
    })
  });

  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATIONS (History)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get recent generations for a brand
 */
export async function getGenerations(brand: string, limit: number = 20): Promise<any[]> {
  const res = await fetch(`${API_URL}/api/generations/${brand}?limit=${limit}`);
  const data = await res.json();
  return data.generations || [];
}

/**
 * Get a specific generation by ID
 */
export async function getGeneration(id: string): Promise<any | null> {
  const res = await fetch(`${API_URL}/api/generation/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.generation;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY FUNCTIONS (for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export async function refineCopy(sourceContent: string, brand: string): Promise<any> {
  // TODO: Implement via Workers if needed
  console.warn('refineCopy not yet implemented in Workers API');
  return { success: false, error: 'Not implemented' };
}

export async function refineImage(imagePrompt: string, brand: string): Promise<any> {
  // TODO: Implement via Workers if needed
  console.warn('refineImage not yet implemented in Workers API');
  return { success: false, error: 'Not implemented' };
}

export async function generateVideo(
  imageUrl: string,
  brand: string,
  motionIntensity: 'low' | 'medium' | 'high' = 'medium'
): Promise<any> {
  // TODO: Implement via Workers if needed
  console.warn('generateVideo not yet implemented in Workers API');
  return { success: false, error: 'Not implemented' };
}

export async function uploadYouTubeShort(
  videoPath: string,
  title: string,
  description: string,
  brand: string,
  options: { tags?: string[]; privacyStatus?: 'public' | 'private' | 'unlisted' } = {}
): Promise<any> {
  // TODO: Implement via Workers if needed
  console.warn('uploadYouTubeShort not yet implemented in Workers API');
  return { success: false, error: 'Not implemented' };
}

export async function getScheduledPosts(): Promise<ScheduledPost[]> {
  // TODO: Implement scheduled posts list endpoint
  return [];
}

export async function cancelScheduledPost(scheduleId: string): Promise<{ success: boolean; error?: string }> {
  // TODO: Implement cancel endpoint
  return { success: false, error: 'Not implemented' };
}
