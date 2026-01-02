import type { Env, BrandProfile, Guardrails, GuardrailsResult } from '../types';

/**
 * Guardrails Agent
 *
 * Evaluates generated content against brand guardrails.
 * Returns pass/fail with specific violations and suggestions.
 */

// Specificity indicators - things that show substantive content
const SPECIFICITY_SIGNALS = [
  'givecareapp.com', 'assessment', 'benchmark', 'SMS', 'preprint',
  'summit', 'conference', 'speaking', 'panel', 'workshop',
  'github', 'code', 'open source', 'paper', 'research',
  'DM me', 'reach out', 'register', 'apply', 'join',
  'this week', 'today', 'releasing', 'launching', 'building'
];

// CTA patterns - calls to action
const CTA_PATTERNS = [
  /➡/,
  /DM me/i,
  /reach out/i,
  /register/i,
  /apply/i,
  /givecareapp\.com/i,
  /\[link\]/i,
  /join us/i,
  /learn more/i,
  /check out/i
];

// Generic cliche patterns
const CLICHE_PATTERNS = [
  /you got this/i,
  /stay strong/i,
  /believe in yourself/i,
  /one day at a time/i,
  /take it slow/i,
  /trust the process/i,
  /you're not alone/i,
  /we see you/i,
  /you're doing great/i,
  /keep going/i,
  /it gets better/i,
  /hang in there/i
];

/**
 * Rule-based evaluation (fast, no LLM call)
 * Catches obvious violations before LLM evaluation
 */
export function evaluateRules(
  content: { twitterText?: string; linkedinText?: string; imageDescription?: string },
  guardrails: Guardrails
): { passed: boolean; violations: string[]; bannedPhrases: string[] } {
  const violations: string[] = [];
  const bannedPhrases: string[] = [];

  const allText = [
    content.twitterText || '',
    content.linkedinText || '',
    content.imageDescription || ''
  ].join(' ').toLowerCase();

  // Check for banned phrases (hard stop)
  for (const phrase of guardrails.never.phrases) {
    if (allText.includes(phrase.toLowerCase())) {
      bannedPhrases.push(phrase);
      violations.push(`Contains banned phrase: "${phrase}"`);
    }
  }

  // Check for cliche patterns
  for (const pattern of CLICHE_PATTERNS) {
    if (pattern.test(allText)) {
      violations.push(`Contains cliche pattern: ${pattern.source}`);
    }
  }

  return {
    passed: bannedPhrases.length === 0,
    violations,
    bannedPhrases
  };
}

/**
 * Calculate specificity score (0-1)
 * Higher = more specific/substantive content
 */
export function calculateSpecificityScore(text: string): number {
  const textLower = text.toLowerCase();
  let matches = 0;

  for (const signal of SPECIFICITY_SIGNALS) {
    if (textLower.includes(signal.toLowerCase())) {
      matches++;
    }
  }

  // Normalize: 3+ signals = 1.0, 0 = 0.0
  return Math.min(1, matches / 3);
}

/**
 * Calculate cliche score (0-1)
 * Higher = more cliches detected
 */
export function calculateClicheScore(text: string): number {
  let matches = 0;

  for (const pattern of CLICHE_PATTERNS) {
    if (pattern.test(text)) {
      matches++;
    }
  }

  // Normalize: 3+ cliches = 1.0
  return Math.min(1, matches / 3);
}

/**
 * Check if content has a call to action
 */
export function hasCTA(text: string): boolean {
  for (const pattern of CTA_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Full guardrails evaluation (combines rules + LLM judgment)
 */
export async function evaluateContent(
  env: Env,
  brand: BrandProfile,
  content: {
    twitterText?: string;
    linkedinText?: string;
    imageDescription?: string
  }
): Promise<GuardrailsResult> {
  const guardrails = brand.guardrails;

  // If no guardrails defined, pass by default
  if (!guardrails) {
    return {
      passed: true,
      score: 1.0,
      violations: [],
      suggestions: [],
      details: {
        specificity_score: 1.0,
        cliche_score: 0,
        has_cta: true,
        banned_phrases_found: []
      }
    };
  }

  const allText = [
    content.twitterText || '',
    content.linkedinText || ''
  ].join(' ');

  // 1. Rule-based checks (fast)
  const ruleResult = evaluateRules(content, guardrails);

  // 2. Calculate scores
  const specificityScore = calculateSpecificityScore(allText);
  const clicheScore = calculateClicheScore(allText);
  const contentHasCTA = hasCTA(allText);

  const violations = [...ruleResult.violations];
  const suggestions: string[] = [];

  // 3. Check thresholds
  if (specificityScore < guardrails.thresholds.min_specificity_score) {
    violations.push(`Specificity score ${specificityScore.toFixed(2)} below threshold ${guardrails.thresholds.min_specificity_score}`);
    suggestions.push('Add specific mentions: tools, events, links, or concrete actions');
  }

  if (clicheScore > guardrails.thresholds.max_cliche_score) {
    violations.push(`Cliche score ${clicheScore.toFixed(2)} above threshold ${guardrails.thresholds.max_cliche_score}`);
    suggestions.push('Remove generic motivational language, be more specific');
  }

  if (guardrails.thresholds.require_cta && !contentHasCTA) {
    violations.push('Missing call to action');
    suggestions.push('Add a CTA: link, DM invitation, or question');
  }

  // 4. LLM-based judgment for nuanced evaluation (only if basic checks pass)
  let llmScore = 1.0;
  if (ruleResult.passed && violations.length <= 2) {
    const llmResult = await evaluateWithLLM(env, brand, content, guardrails);
    llmScore = llmResult.score;
    violations.push(...llmResult.violations);
    suggestions.push(...llmResult.suggestions);
  }

  // 5. Calculate final score
  const baseScore = (specificityScore * 0.4) + ((1 - clicheScore) * 0.3) + (contentHasCTA ? 0.3 : 0);
  const finalScore = baseScore * llmScore;

  // 6. Determine pass/fail
  const passed = ruleResult.bannedPhrases.length === 0 &&
                 finalScore >= 0.6 &&
                 violations.length <= 2;

  return {
    passed,
    score: finalScore,
    violations,
    suggestions,
    details: {
      specificity_score: specificityScore,
      cliche_score: clicheScore,
      has_cta: contentHasCTA,
      banned_phrases_found: ruleResult.bannedPhrases
    }
  };
}

/**
 * LLM-based nuanced evaluation
 * Catches things rules can't: tone, voice match, subtle issues
 */
async function evaluateWithLLM(
  env: Env,
  brand: BrandProfile,
  content: { twitterText?: string; linkedinText?: string; imageDescription?: string },
  guardrails: Guardrails
): Promise<{ score: number; violations: string[]; suggestions: string[] }> {

  const prompt = `You are a brand guardian for ${brand.name}. Evaluate this content against our guardrails.

CONTENT TO EVALUATE:
Twitter: ${content.twitterText || 'N/A'}
LinkedIn: ${content.linkedinText || 'N/A'}
Image concept: ${content.imageDescription || 'N/A'}

BRAND VOICE:
- Tone: ${brand.voice.tone}
- Style: ${brand.voice.style}

GUARDRAILS - What we PURSUE:
Voice: ${guardrails.pursue.voice.join(', ')}
Visual: ${guardrails.pursue.visual.join(', ')}

GUARDRAILS - What we REJECT:
Voice: ${guardrails.reject.voice.join(', ')}
Visual: ${guardrails.reject.visual.join(', ')}

Evaluate on these criteria:
1. Does the voice match our founder/builder tone (NOT wellness influencer)?
2. Is the content specific and substantive (mentions real things)?
3. Does it avoid empty affirmations and cliches?
4. Is the visual concept graphic design (not stock photography)?

Return JSON:
{
  "score": 0.0-1.0,
  "violations": ["specific issue 1", "specific issue 2"],
  "suggestions": ["how to fix 1", "how to fix 2"]
}

Be strict. Generic wellness content should score below 0.5.`;

  try {
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
      const result = JSON.parse(text);
      return {
        score: Math.max(0, Math.min(1, result.score || 0.5)),
        violations: result.violations || [],
        suggestions: result.suggestions || []
      };
    } catch {
      // Parse error, return neutral score
      return { score: 0.7, violations: [], suggestions: [] };
    }
  } catch (error) {
    console.error('[evaluateWithLLM] Error:', error);
    // API error, return neutral score
    return { score: 0.7, violations: [], suggestions: [] };
  }
}

/**
 * Regenerate content with guardrails feedback
 * Called when initial content fails evaluation
 */
export function buildRegenerationPrompt(
  originalPrompt: string,
  violations: string[],
  suggestions: string[]
): string {
  return `${originalPrompt}

⚠️ PREVIOUS ATTEMPT FAILED GUARDRAILS:
Violations:
${violations.map(v => `- ${v}`).join('\n')}

Suggestions:
${suggestions.map(s => `- ${s}`).join('\n')}

IMPORTANT: Address ALL violations in this attempt. Be MORE specific, avoid cliches, include a clear CTA.`;
}
