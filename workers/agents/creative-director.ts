import type { Env, BrandProfile, AestheticChoice, GuardrailsResult } from '../types';
import { evaluateContent, buildRegenerationPrompt } from './guardrails';

/**
 * Creative Director Agent (as function)
 *
 * Generates content (copy + image) for a topic.
 * Ensures visual variety while maintaining brand unity.
 */

// Common visual clichés to avoid
const CLICHES = [
  'person smiling at camera', 'hands holding', 'lightbulb',
  'puzzle pieces', 'handshake', 'team high five', 'person at laptop',
  'coffee and laptop', 'sunrise', 'mountain peak', 'road to horizon',
  'person looking stressed', 'helping elderly', 'medical professional',
  'heart hands', 'diverse group smiling', 'pointing at screen'
];

export async function createContent(
  env: Env,
  brandSlug: string,
  topic: string,
  poolItemId?: string,
  frame?: string  // Optional: 'announcement', 'weekly_update', 'event', 'partnership', 'thought'
): Promise<{
  success: boolean;
  generationId?: string;
  copy?: any;
  visual?: { imageUrl: string; prompt: string; aesthetics: AestheticChoice };
  guardrails?: GuardrailsResult;
  error?: string;
}> {
  // 1. Get brand
  const brand = await getBrand(env, brandSlug);
  if (!brand) {
    return { success: false, error: `Brand not found: ${brandSlug}` };
  }

  // 2. Get aesthetic history for variety
  const recentAesthetics = await getRecentAesthetics(env, brandSlug, 10);

  // 3. Generate copy (with optional frame) - with guardrails loop
  let copy = await generateCopy(env, brand, topic, frame);
  let guardrailsResult: GuardrailsResult | undefined;
  let attempts = 0;
  const maxAttempts = 2;

  // 3.5. Evaluate against guardrails (retry if failed)
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`[createContent] Guardrails evaluation attempt ${attempts}/${maxAttempts}`);

    guardrailsResult = await evaluateContent(env, brand, {
      twitterText: copy.twitterText,
      linkedinText: copy.linkedinText,
      imageDescription: copy.imageDescription
    });

    console.log(`[createContent] Guardrails result: passed=${guardrailsResult.passed}, score=${guardrailsResult.score.toFixed(2)}`);
    if (guardrailsResult.violations.length > 0) {
      console.log(`[createContent] Violations: ${guardrailsResult.violations.join(', ')}`);
    }

    if (guardrailsResult.passed) {
      break;
    }

    // If failed and we have attempts left, regenerate with feedback
    if (attempts < maxAttempts) {
      console.log(`[createContent] Regenerating with guardrails feedback...`);
      copy = await generateCopy(env, brand, topic, frame, {
        violations: guardrailsResult.violations,
        suggestions: guardrailsResult.suggestions
      });
    }
  }

  // Block content that fails guardrails after max attempts
  if (guardrailsResult && !guardrailsResult.passed) {
    console.error(`[createContent] Content BLOCKED: guardrails failed after ${maxAttempts} attempts. Score: ${guardrailsResult.score.toFixed(2)}`);
    return {
      success: false,
      error: `Content failed guardrails: ${guardrailsResult.violations.join('; ')}`,
      guardrails: guardrailsResult
    };
  }

  // 4. Create visual concept (avoiding clichés and recent aesthetics)
  const visual = await createVisualConcept(env, brand, topic, copy.imageDescription || topic, recentAesthetics);

  // Ensure we have valid aesthetics
  const aesthetics: AestheticChoice = visual.aestheticChoices || {
    mood: 'default',
    technique: 'standard',
    subject: 'scene',
    colorTone: 'natural'
  };

  // 4.5 Use brand design system if available, otherwise fall back to legacy style matching
  const designSystem = (brand.visual as any).design_system;
  let designChoice: DesignChoice | null = null;
  let matchedStyle: any = null;

  if (designSystem) {
    // New design system approach
    designChoice = selectDesignSystem(topic, designSystem);
    console.log('[createContent] Design system:', designChoice.treatment, '| Composition:', designChoice.compositionType, '| Logo:', designChoice.logoPosition);
  } else {
    // Legacy style matching
    const refStyles = brand.visual.reference_styles || [];
    matchedStyle = findMatchingStyle(topic, refStyles);
    console.log('[createContent] Matched style:', matchedStyle?.name, 'for topic:', topic.substring(0, 50));
  }

  // 5. Generate image
  console.log('[createContent] Generating image with prompt:', (visual.imagePrompt || topic).substring(0, 100));

  const imageResult = await generateImage(env, brand, visual.imagePrompt || topic, designChoice || matchedStyle);
  console.log('[createContent] generateImage result: model=', imageResult.model, 'hasData=', !!imageResult.imageData, 'dataLen=', imageResult.imageData?.length || 0);

  // 6. Upload to R2
  let imageUrl = '';
  if (imageResult.imageData) {
    try {
      imageUrl = await uploadToR2(env, imageResult.imageData, brandSlug);
      console.log('[createContent] Uploaded to R2:', imageUrl);
    } catch (uploadError: any) {
      console.error('[createContent] R2 upload failed:', uploadError.message);
      // Continue without image
    }
  } else {
    console.log('[createContent] No image data from generateImage, model:', imageResult.model);
  }

  // 7. Save generation to D1
  const generationId = await saveGeneration(env, brandSlug, {
    topic,
    poolItemId,
    ...copy,
    imageUrl,
    imagePrompt: visual.imagePrompt || topic,
    imageModel: imageResult.model,
    referenceStyle: imageResult.styleName || matchedStyle?.name || aesthetics.mood
  });

  // 8. Save aesthetic history
  await saveAestheticHistory(env, brandSlug, generationId, aesthetics);

  // 9. Mark pool item as used (if applicable)
  if (poolItemId) {
    await markPoolItemUsed(env, poolItemId);
  }

  return {
    success: true,
    generationId,
    copy,
    visual: {
      imageUrl,
      prompt: visual.imagePrompt || topic,
      aesthetics
    },
    guardrails: guardrailsResult
  };
}

async function getBrand(env: Env, slug: string): Promise<BrandProfile | null> {
  const result = await env.DB.prepare(
    'SELECT * FROM brands WHERE slug = ?'
  ).bind(slug).first<any>();

  if (!result) return null;

  return {
    name: result.name,
    slug: result.slug,
    guardrails: result.guardrails ? JSON.parse(result.guardrails) : undefined,
    voice: {
      tone: result.voice_tone || '',
      style: result.voice_style || '',
      rules: JSON.parse(result.voice_rules || '[]'),
      frames: JSON.parse(result.voice_frames || 'null'),
      avoid_phrases: JSON.parse(result.voice_avoid_phrases || '[]')
    },
    visual: {
      palette: JSON.parse(result.visual_palette || '{}'),
      style: result.visual_style || '',
      mood: result.visual_mood || '',
      avoid: JSON.parse(result.visual_avoid || '[]'),
      image_direction: JSON.parse(result.visual_image_direction || 'null'),
      reference_styles: JSON.parse(result.visual_reference_styles || '[]'),
      image_generation: JSON.parse(result.visual_image_generation || 'null'),
      design_system: JSON.parse(result.visual_design_system || 'null')
    },
    platforms: JSON.parse(result.platforms || '{}')
  };
}

async function getRecentAesthetics(env: Env, brandSlug: string, limit: number): Promise<AestheticChoice[]> {
  const results = await env.DB.prepare(
    'SELECT mood, technique, subject, color_tone FROM aesthetic_history WHERE brand_slug = ? ORDER BY created_at DESC LIMIT ?'
  ).bind(brandSlug, limit).all<any>();

  return (results.results || []).map(r => ({
    mood: r.mood,
    technique: r.technique,
    subject: r.subject,
    colorTone: r.color_tone
  }));
}

async function generateCopy(
  env: Env,
  brand: BrandProfile,
  topic: string,
  frame?: string,
  guardrailsFeedback?: { violations: string[]; suggestions: string[] }
) {
  const voiceRules = brand.voice.rules.map(r => `- ${r}`).join('\n');
  const twitterConfig = brand.platforms?.twitter || { max_chars: 280, hashtags: 3 };
  const linkedinConfig = brand.platforms?.linkedin || { max_chars: 3000, hashtags: 5 };

  // Get frame-specific guidance if available
  const voiceConfig = brand.voice as any;
  const frames = voiceConfig?.frames || {};
  const avoidPhrases = voiceConfig?.avoid_phrases || [];
  const selectedFrame = frame ? frames[frame] : null;

  // Build frame guidance
  let frameGuidance = '';
  if (selectedFrame) {
    frameGuidance = `
═══════════════════════════════════════════════════════════════
POST TYPE: ${frame?.toUpperCase().replace('_', ' ')}
═══════════════════════════════════════════════════════════════
${selectedFrame.description}

STRUCTURE:
${selectedFrame.structure}

EXAMPLE:
${selectedFrame.example}
`;
  }

  // Build avoid phrases list
  const avoidList = avoidPhrases.length > 0
    ? `\nNEVER USE THESE PHRASES:\n${avoidPhrases.map((p: string) => `- "${p}"`).join('\n')}`
    : '';

  const prompt = `You are writing as ${brand.name}'s founder—a builder shipping real tools, not an inspirational influencer.

TOPIC: ${topic}

BRAND VOICE:
- Tone: ${brand.voice.tone}
- Style: ${brand.voice.style}
- Rules:
${voiceRules}

═══════════════════════════════════════════════════════════════
VOICE EXAMPLES (match this exactly):
═══════════════════════════════════════════════════════════════

GOOD LinkedIn (founder voice):
"Every major women's-health disparity has a shadow variable no one models: caregiving load. Once you surface that variable, the outcomes stop looking mysterious.

Ali Madad, founder of GiveCare, will speak at the HITLAB Fall Summit 2025...

His talk, Invisible Care, Visible Health: Reframing Family Caregiving as a Core Women's Health Issue, will run on December 3, 2025."

GOOD LinkedIn (update style):
"Some weeks feel like a cross-section of a bigger shift.
Caregiving, aging, AI, policy, and safety—once treated as separate domains—aren't quite converging yet.

But they need to. And I find myself working in the seams. This week:

➡ Heading to FamTech.org event on The Future of Work & Care
➡ Flying to Atlanta for AgeTech Connect Summit
➡ Finalizing GiveCare updates (including open source SDOH)

If you're in NYC or ATL and want to talk care systems, DM me."

GOOD LinkedIn (announcement):
"Today we're releasing two preprints to close out National Family Caregivers Month

🩶 GiveCare: an SMS-first AI assistant that turns any phone into 24/7 caregiver support
🩶 InvisibleBench: the first benchmark for longitudinal AI safety in caregiving

Our goal: make every caregiving interaction safer for families, clinicians, and the AI ecosystem itself.

➡ Free assessments: givecareapp.com/assessment
➡ Code + instruments: [link]"

BAD (generic influencer garbage - NEVER write like this):
"You can't pour from an empty cup. So stop trying. It's okay to take a break. Your care matters. And so do YOU."

BAD (empty affirmations):
"Saying 'no' isn't selfish. It's self-respect. You're allowed to protect your boundaries."

═══════════════════════════════════════════════════════════════
KEY RULES:
═══════════════════════════════════════════════════════════════
- Write as a FOUNDER building tools, not a wellness influencer
- Be SPECIFIC: mention real things (assessments, benchmarks, tools, events)
- Use ➡ arrows for lists of updates/links
- Use 🩶 for feature announcements
- NO empty affirmations ("You're allowed to...", "Your peace matters")
- NO dramatic one-word lines for emotional effect
- Reference real GiveCare things: SMS assistant, assessments, AI safety, benchmarks
- End with action: link, DM invitation, or question
- Hashtags go at the END, not woven in
${avoidList}
${frameGuidance}
${guardrailsFeedback ? `
⚠️ PREVIOUS ATTEMPT FAILED GUARDRAILS - FIX THESE ISSUES:
Violations:
${guardrailsFeedback.violations.map(v => `- ${v}`).join('\n')}

How to fix:
${guardrailsFeedback.suggestions.map(s => `- ${s}`).join('\n')}

IMPORTANT: Address ALL violations. Be MORE specific, avoid cliches, include a clear CTA.
` : ''}
Generate content for:
- Twitter: max ${twitterConfig.max_chars} chars, ${twitterConfig.hashtags} hashtags
- LinkedIn: max ${linkedinConfig.max_chars} chars, ${linkedinConfig.hashtags} hashtags

Also write an image description for a GRAPHIC DESIGN visual (poster, illustration, typography - not photography).

Respond in JSON (use \\n for line breaks):
{
  "twitterText": "...",
  "twitterHashtags": ["...", "...", "..."],
  "linkedinText": "...",
  "linkedinHashtags": ["...", "...", "...", "...", "..."],
  "imageDescription": "graphic design concept, 2-3 sentences"
}`;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  const data = await response.json() as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

async function createVisualConcept(
  env: Env,
  brand: BrandProfile,
  topic: string,
  imageDescription: string,
  recentAesthetics: AestheticChoice[]
) {
  // Check for clichés
  const descLower = imageDescription.toLowerCase();
  const hasCliche = CLICHES.some(c => descLower.includes(c));

  // Get recent aesthetic patterns to avoid
  const recentMoods = [...new Set(recentAesthetics.map(a => a.mood))].join(', ');
  const recentTechniques = [...new Set(recentAesthetics.map(a => a.technique))].join(', ');

  // Get brand's detailed image direction
  const imageDir = brand.visual.image_direction;
  const refStyles = brand.visual.reference_styles || [];

  // Find matching reference style based on topic keywords
  const topicLower = topic.toLowerCase();
  const matchingStyle = refStyles.find(style =>
    style.mood_keywords?.some((kw: string) => topicLower.includes(kw.toLowerCase()))
  );

  // Find matching scene template
  const sceneTemplates = imageDir?.scene_templates || {};
  let matchingTemplate = '';
  for (const [key, template] of Object.entries(sceneTemplates)) {
    if (topicLower.includes(key) || key.split('_').some(word => topicLower.includes(word))) {
      matchingTemplate = template as string;
      break;
    }
  }

  const prompt = `You are a Creative Director for ${brand.name}. Your job is to create BOLD, UNEXPECTED visuals that NEVER look like stock photography.

TOPIC: ${topic}
INITIAL CONCEPT (probably too literal, reimagine it): ${imageDescription}
${hasCliche ? '⚠️ CLICHÉ DETECTED - This concept is FORBIDDEN. Create something unexpected.' : ''}

═══════════════════════════════════════════════════════════════
BRAND VISUAL IDENTITY (FOLLOW THIS STRICTLY):
═══════════════════════════════════════════════════════════════
Style: ${brand.visual.style}
Mood: ${brand.visual.mood}
Palette: Primary ${brand.visual.palette.primary}, Secondary ${brand.visual.palette.secondary}

SUBJECTS TO USE:
${imageDir?.subjects?.map((s: string) => `• ${s}`).join('\n') || 'Abstract, bold, unexpected'}

TECHNIQUES TO USE:
${imageDir?.technique?.map((t: string) => `• ${t}`).join('\n') || 'High contrast, dramatic'}

EMOTIONS TO CONVEY:
${imageDir?.emotions?.join(', ') || brand.visual.mood}

${matchingTemplate ? `SCENE TEMPLATE FOR THIS TOPIC:\n${matchingTemplate}` : ''}

${matchingStyle ? `MATCHING REFERENCE STYLE: "${matchingStyle.name}"
Description: ${matchingStyle.description}
Visual mode: ${matchingStyle.visual_mode || 'editorial'}` : ''}

═══════════════════════════════════════════════════════════════
ABSOLUTELY FORBIDDEN (DO NOT USE):
═══════════════════════════════════════════════════════════════
${brand.visual.avoid.map(a => `❌ ${a}`).join('\n')}
❌ Literal interpretations of the topic
❌ People sitting at tables talking
❌ Generic holiday scenes
❌ Stock photography aesthetics
❌ Soft focus, pastel, "inspirational" garbage

RECENTLY USED (rotate away from): ${recentMoods || 'none'}, ${recentTechniques || 'none'}

═══════════════════════════════════════════════════════════════
CREATE THE IMAGE PROMPT:
═══════════════════════════════════════════════════════════════
Generate a prompt for GRAPHIC DESIGN / ILLUSTRATION (NOT photography):

STYLE OPTIONS (pick one):
- Bold typography composition with the message as the visual
- Modernist poster design (flat shapes, geometric, like Kamekura or Muller-Brockmann)
- Abstract organic texture (like a close-up of cells, bark, or geological formations)
- Vintage flat color illustration (like 1960s cookbook or travel poster art)
- Surreal collage with cut-out shapes and bold color blocks

NEVER DESCRIBE:
- A person standing/sitting/posing
- Dramatic lighting on a figure
- Someone in nature/water/mountains
- Photorealistic anything
- "A figure" or "A woman" or "A silhouette"

GOOD EXAMPLES:
- "Bold orange typography on dark brown: 'REST' in oversized serif, with geometric shapes"
- "Flat color illustration of hands releasing birds, vintage poster style"
- "Abstract cellular texture in warm orange tones, organic growth pattern"
- "Modernist eye symbol with concentric circles, red and gold palette"

Return JSON:
{
  "imagePrompt": "describe graphic design/illustration, NOT a photo",
  "aestheticChoices": {
    "mood": "specific mood from brand emotions",
    "technique": "specific technique (typography/illustration/texture/poster)",
    "subject": "the graphic element, NOT a person",
    "colorTone": "specific color approach"
  }
}`;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  const data = await response.json() as any;

  // Check for API errors
  if (data.error) {
    console.error('[createVisualConcept] Gemini API error:', JSON.stringify(data.error));
    return {
      imagePrompt: imageDescription,
      aestheticChoices: { mood: 'default', technique: 'standard', subject: 'scene', colorTone: 'natural' }
    };
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  console.log('[createVisualConcept] Raw response length:', text.length, 'preview:', text.substring(0, 200));

  if (!text || text.length < 10) {
    console.error('[createVisualConcept] Empty or too short response');
    return {
      imagePrompt: imageDescription,
      aestheticChoices: { mood: 'default', technique: 'standard', subject: 'scene', colorTone: 'natural' }
    };
  }

  try {
    const parsed = JSON.parse(text);
    // Validate the parsed object has required fields
    if (!parsed.imagePrompt || typeof parsed.imagePrompt !== 'string') {
      console.error('[createVisualConcept] Parsed JSON missing imagePrompt, got:', Object.keys(parsed));
      return {
        imagePrompt: imageDescription,
        aestheticChoices: parsed.aestheticChoices || { mood: 'default', technique: 'standard', subject: 'scene', colorTone: 'natural' }
      };
    }
    console.log('[createVisualConcept] Success, imagePrompt:', parsed.imagePrompt.substring(0, 100));
    return parsed;
  } catch (e) {
    console.log('[createVisualConcept] Parse error, trying regex extract');
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const extracted = JSON.parse(match[0]);
        if (extracted.imagePrompt) {
          console.log('[createVisualConcept] Regex extracted imagePrompt:', extracted.imagePrompt.substring(0, 100));
          return extracted;
        }
      } catch (e2) {
        console.log('[createVisualConcept] Regex parse also failed');
      }
    }
    return {
      imagePrompt: imageDescription,
      aestheticChoices: { mood: 'default', technique: 'standard', subject: 'scene', colorTone: 'natural' }
    };
  }
}

/**
 * Fetches a reference image and converts it to base64
 */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    console.log('[fetchImageAsBase64] Fetching:', url);
    const response = await fetch(url);
    if (!response.ok) {
      console.error('[fetchImageAsBase64] Failed to fetch:', response.status);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    console.log('[fetchImageAsBase64] Got', base64.length, 'chars of base64');
    return base64;
  } catch (error: any) {
    console.error('[fetchImageAsBase64] Error:', error.message);
    return null;
  }
}

/**
 * Brand Design System - picks composition type, treatment, and logo position
 */
interface DesignChoice {
  compositionType: string;
  treatment: 'illustration' | 'photo_treatment' | 'typography';
  treatmentConfig: any;
  logoPosition: string;
  referenceUrl: string;
}

function selectDesignSystem(topic: string, designSystem: any): DesignChoice {
  const topicLower = topic.toLowerCase();

  // 1. Determine which treatment based on topic keywords
  let treatment: 'illustration' | 'photo_treatment' | 'typography' = 'illustration';
  let treatmentConfig = designSystem?.illustration;
  let referenceUrl = treatmentConfig?.reference || '';

  // Check typography keywords
  const typoKeywords = designSystem?.typography?.use_for || [];
  for (const kw of typoKeywords) {
    if (topicLower.includes(kw)) {
      treatment = 'typography';
      treatmentConfig = designSystem?.typography;
      referenceUrl = treatmentConfig?.reference || '';
      break;
    }
  }

  // Check photo keywords (if not already typography)
  if (treatment !== 'typography') {
    const photoKeywords = designSystem?.photo_treatment?.use_for || [];
    for (const kw of photoKeywords) {
      if (topicLower.includes(kw)) {
        treatment = 'photo_treatment';
        treatmentConfig = designSystem?.photo_treatment;
        referenceUrl = treatmentConfig?.reference || '';
        break;
      }
    }
  }

  // 2. Pick composition type based on treatment and weights
  const compositions = designSystem?.compositions || [];
  let compositionType = 'illustration_full';
  if (compositions.length > 0) {
    // Weighted random selection
    const totalWeight = compositions.reduce((sum: number, c: any) => sum + (c.weight || 10), 0);
    let rand = Math.random() * totalWeight;
    for (const comp of compositions) {
      rand -= (comp.weight || 10);
      if (rand <= 0) {
        compositionType = comp.type;
        break;
      }
    }
  }

  // 3. Random logo position
  const logoPositions = designSystem?.logo_positions || ['bottom-right'];
  const logoPosition = logoPositions[Math.floor(Math.random() * logoPositions.length)];

  console.log('[selectDesignSystem] Treatment:', treatment, '| Composition:', compositionType, '| Logo:', logoPosition);

  return {
    compositionType,
    treatment,
    treatmentConfig,
    logoPosition,
    referenceUrl
  };
}

/**
 * Legacy: Finds the best matching reference style based on topic keywords
 */
function findMatchingStyle(topic: string, referenceStyles: any[]): any | null {
  const topicLower = topic.toLowerCase();

  // Score each style by keyword matches
  let bestStyle = null;
  let bestScore = 0;

  for (const style of referenceStyles) {
    const keywords = style.mood_keywords || [];
    let score = 0;
    for (const keyword of keywords) {
      if (topicLower.includes(keyword.toLowerCase())) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestStyle = style;
    }
  }

  // If no matches, pick a random non-portrait style (prefer graphic design)
  if (!bestStyle) {
    const graphicStyles = referenceStyles.filter(s =>
      !s.name.includes('portrait') && !s.name.includes('beauty')
    );
    if (graphicStyles.length > 0) {
      bestStyle = graphicStyles[Math.floor(Math.random() * graphicStyles.length)];
    } else {
      bestStyle = referenceStyles[0];
    }
  }

  console.log('[findMatchingStyle] Topic:', topic.substring(0, 50), '-> Style:', bestStyle?.name, 'Score:', bestScore);
  return bestStyle;
}

async function generateImage(
  env: Env,
  brand: BrandProfile,
  prompt: string,
  styleOrDesign?: any
): Promise<{ imageData: string | null; model: string; styleName?: string }> {
  console.log('[generateImage] Starting with prompt:', prompt.substring(0, 200));

  try {
    const parts: any[] = [];

    // Get config from brand
    const imageConfig = brand.visual.image_generation || {} as any;
    const aspectRatio = imageConfig.default_aspect_ratio || '1:1';
    const resolution = imageConfig.default_resolution || '2K';
    const logoUrl = imageConfig.logo_url || null;
    const logoText = imageConfig.logo_text || brand.name;

    // Fetch logo
    let logoBase64: string | null = null;
    if (logoUrl) {
      logoBase64 = await fetchImageAsBase64(logoUrl);
      if (logoBase64) console.log('[generateImage] Fetched logo');
    }

    // Check if this is a DesignChoice (new system) or legacy style
    const isDesignSystem = styleOrDesign?.compositionType !== undefined;
    let referenceUrl = '';
    let styleDescription = '';
    let logoPosition = 'bottom-right';
    let compositionType = '';

    if (isDesignSystem) {
      const design = styleOrDesign as DesignChoice;
      referenceUrl = design.referenceUrl;
      styleDescription = design.treatmentConfig?.style_description || '';
      logoPosition = design.logoPosition;
      compositionType = design.compositionType;
      console.log('[generateImage] Design system:', design.treatment, '| Logo:', logoPosition);
    } else if (styleOrDesign?.images?.[0]) {
      // Legacy style
      referenceUrl = styleOrDesign.images[0];
      styleDescription = styleOrDesign.style_description || '';
      console.log('[generateImage] Legacy style:', styleOrDesign.name);
    }

    // Build logo position instruction
    const logoPositionMap: Record<string, string> = {
      'bottom-right': 'Position logo in the bottom-right corner',
      'bottom-left': 'Position logo in the bottom-left corner',
      'top-right': 'Position logo in the top-right corner',
      'integrated': 'Integrate logo INTO the composition as a design element',
      'centered-bottom': 'Position logo centered at the bottom'
    };
    const logoPositionInstruction = logoPositionMap[logoPosition] || logoPositionMap['bottom-right'];

    // Fetch reference image if available
    let referenceBase64: string | null = null;
    if (referenceUrl) {
      referenceBase64 = await fetchImageAsBase64(referenceUrl);
    }

    if (referenceBase64) {
      // Add reference image FIRST
      const mimeType = referenceUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';
      parts.push({ inlineData: { mimeType, data: referenceBase64 } });

      // Add logo as second image
      if (logoBase64) {
        parts.push({ inlineData: { mimeType: 'image/png', data: logoBase64 } });
      }

      // Build composition-aware prompt
      let compositionInstruction = '';
      if (compositionType === 'illustration_with_type') {
        compositionInstruction = 'Add BOLD TYPOGRAPHY overlaid on the illustration - a short powerful word or phrase related to the concept.';
      } else if (compositionType === 'photo_with_illustration') {
        compositionInstruction = 'Create a duotone photo with flat illustration elements (shapes, plants, vessels) overlaid on top.';
      } else if (compositionType === 'typography_poster') {
        compositionInstruction = 'Make TYPOGRAPHY the primary visual - the words ARE the design. Minimal imagery.';
      }

      const styleTransferPrompt = `Generate a NEW IMAGE in the EXACT artistic style of the FIRST reference image.

${styleDescription}

BRAND LOGO:
The SECOND image is the logo. ${logoPositionInstruction}.
Keep it legible but integrated with the design aesthetic.

${compositionInstruction ? `COMPOSITION: ${compositionInstruction}` : ''}

CONCEPT TO VISUALIZE:
${prompt}

CRITICAL:
- Match the EXACT visual style of the reference
- This is GRAPHIC DESIGN, not photography
- NO photorealistic AI clichés`;

      parts.push({ text: styleTransferPrompt });
    } else {
      // Fallback without reference
      const fallbackPrompt = `Create a graphic design image:

${styleDescription || 'Vintage flat illustration style with dark brown background, flat colors (lilac, lime, orange, pink), simplified shapes.'}

Include "${logoText}" logo. ${logoPositionInstruction}.

CONCEPT: ${prompt}

STYLE: Graphic design, NOT photography. Flat colors, no gradients.`;

      parts.push({ text: fallbackPrompt });
    }

    // Use Gemini 3 Pro Preview for image generation
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio,
            imageSize: resolution
          }
        }
      })
    });

    const data = await response.json() as any;
    console.log('[generateImage] Gemini 3 Pro response status:', response.status);
    console.log('[generateImage] Gemini 3 Pro response keys:', Object.keys(data || {}));

    // Check for errors
    if (data.error) {
      console.error('[generateImage] Gemini 3 Pro error:', JSON.stringify(data.error));
      // Fall through to fallback
    } else {
      const responseParts = data.candidates?.[0]?.content?.parts || [];
      console.log('[generateImage] Response parts count:', responseParts.length);

      for (const part of responseParts) {
        if (part.inlineData?.data) {
          console.log('[generateImage] Got image data, length:', part.inlineData.data.length);
          return {
            imageData: part.inlineData.data,
            model: 'gemini-3-pro-image-preview',
            styleName: isDesignSystem ? (styleOrDesign as DesignChoice).treatment : styleOrDesign?.name
          };
        }
        if (part.text) {
          console.log('[generateImage] Got text response:', part.text.substring(0, 100));
        }
      }
    }

    // Fallback to Gemini 2.0 Flash (text prompt only, no style transfer)
    console.log('[generateImage] Gemini 3 Pro returned no image, falling back to Gemini 2.0 Flash...');
    const fallbackPrompt = `Create a bold graphic design poster for: ${prompt}

Style: Flat colors, geometric shapes, limited palette (orange #FF9F1C, brown #54340E, cream)
Include brand text: "${logoText}"
NO photography, NO photorealism, NO gradients
Think: Japanese modernist poster or vintage illustration`;

    const fallbackResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fallbackPrompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT']
        }
      })
    });

    const fallbackData = await fallbackResponse.json() as any;
    const fallbackParts = fallbackData.candidates?.[0]?.content?.parts || [];

    for (const part of fallbackParts) {
      if (part.inlineData?.data) {
        return { imageData: part.inlineData.data, model: 'gemini-2.0-flash-exp-fallback' };
      }
    }

    return { imageData: null, model: 'none' };
  } catch (error) {
    console.error('Image generation failed:', error);
    return { imageData: null, model: 'error' };
  }
}

function buildFallbackPrompt(concept: string, styleDescription: string, logoText: string, logoStyle: string): string {
  return `Create a graphic design image with these specifications:

${styleDescription}

BRAND WATERMARK:
Include "${logoText}" in the design.
Style: ${logoStyle}

CONCEPT TO VISUALIZE:
${concept}

CRITICAL:
- This is GRAPHIC DESIGN, not photography
- NO photorealistic scenes or people
- NO AI "dramatic lighting" effects
- Match the style description exactly`;
}

async function uploadToR2(env: Env, base64Data: string, brandSlug: string): Promise<string> {
  const filename = `${brandSlug}/${Date.now()}-${crypto.randomUUID()}.png`;

  console.log('[uploadToR2] Starting upload, base64 length:', base64Data?.length || 0);

  if (!base64Data || base64Data.length < 100) {
    console.error('[uploadToR2] Invalid base64 data - too short or empty');
    throw new Error('Invalid image data');
  }

  try {
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('[uploadToR2] Decoded to', bytes.length, 'bytes, uploading to', filename);

    await env.R2.put(filename, bytes, {
      httpMetadata: {
        contentType: 'image/png'
      }
    });

    const url = `${env.R2_PUBLIC_URL}/${filename}`;
    console.log('[uploadToR2] Upload complete:', url);
    return url;
  } catch (error: any) {
    console.error('[uploadToR2] Failed:', error.message);
    throw error;
  }
}

async function saveGeneration(env: Env, brandSlug: string, data: any): Promise<string> {
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO generations (
      id, brand_slug, topic, pool_item_id,
      twitter_text, twitter_hashtags, linkedin_text, linkedin_hashtags,
      image_description, image_url, image_prompt, image_model, reference_style,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated')
  `).bind(
    id,
    brandSlug,
    data.topic,
    data.poolItemId || null,
    data.twitterText || null,
    JSON.stringify(data.twitterHashtags || []),
    data.linkedinText || null,
    JSON.stringify(data.linkedinHashtags || []),
    data.imageDescription || null,
    data.imageUrl || null,
    data.imagePrompt || null,
    data.imageModel || null,
    data.referenceStyle || null
  ).run();

  return id;
}

async function saveAestheticHistory(env: Env, brandSlug: string, generationId: string, aesthetics: AestheticChoice): Promise<void> {
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO aesthetic_history (id, brand_slug, generation_id, mood, technique, subject, color_tone)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    brandSlug,
    generationId,
    aesthetics.mood,
    aesthetics.technique,
    aesthetics.subject,
    aesthetics.colorTone
  ).run();
}

async function markPoolItemUsed(env: Env, poolItemId: string): Promise<void> {
  await env.DB.prepare(
    'UPDATE content_pool SET status = ?, updated_at = ? WHERE id = ?'
  ).bind('used', new Date().toISOString(), poolItemId).run();
}
