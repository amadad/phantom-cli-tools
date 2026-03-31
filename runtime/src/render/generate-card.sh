#!/usr/bin/env bash
set -euo pipefail

# Usage: generate-card.sh --brand givecare --type hero-stat --content "..." [--volume quiet] [--eyebrow "CARE ECONOMY"]
# Outputs: PNG to state/cards/<timestamp>.png

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Parse args
BRAND="" CARD_TYPE="hero-stat" CONTENT="" VOLUME="quiet" EYEBROW="" OUTPUT=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --brand) BRAND="$2"; shift 2 ;;
    --type) CARD_TYPE="$2"; shift 2 ;;
    --content) CONTENT="$2"; shift 2 ;;
    --volume) VOLUME="$2"; shift 2 ;;
    --eyebrow) EYEBROW="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

[[ -z "$BRAND" ]] && echo "Error: --brand required" && exit 1
[[ -z "$CONTENT" ]] && echo "Error: --content required" && exit 1

BRAND_DIR="$ROOT/brands/$BRAND"
BRAND_YAML="$BRAND_DIR/brand.yml"
LEARNINGS="$BRAND_DIR/learnings.json"
LOGO="$BRAND_DIR/logo.png"

[[ ! -f "$BRAND_YAML" ]] && echo "Error: $BRAND_YAML not found" && exit 1

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUT_DIR="$ROOT/state/cards"
mkdir -p "$OUT_DIR"
[[ -z "$OUTPUT" ]] && OUTPUT="$OUT_DIR/${BRAND}-${CARD_TYPE}-${TIMESTAMP}.png"

# Build the prompt-writer instruction
LEARNINGS_BLOCK=""
[[ -f "$LEARNINGS" ]] && LEARNINGS_BLOCK="$(cat "$LEARNINGS")"

PAST_PROMPTS=""
if [[ -f "$LEARNINGS" ]]; then
  PAST_PROMPTS=$(python3 -c "
import json, sys
data = json.load(open('$LEARNINGS'))
history = data.get('prompt_history', [])
# Get last 3 successful prompts
good = [h for h in history if h.get('score', 0) >= 7][-3:]
for h in good:
  print('---')
  print('Score:', h.get('score'))
  print(h.get('prompt', '')[:500])
" 2>/dev/null || true)
fi

cat > /tmp/card-prompt-writer.txt << WRITER_END
You are writing an image generation prompt for Google Gemini (gemini-3.1-flash-image-preview).

BRAND CONFIG:
$(cat "$BRAND_YAML")

VISUAL SYSTEM LEARNINGS:
${LEARNINGS_BLOCK}

CARD TYPE: ${CARD_TYPE}
VOLUME: ${VOLUME}
EYEBROW: ${EYEBROW}

CONTENT:
${CONTENT}

${PAST_PROMPTS:+PAST SUCCESSFUL PROMPTS (learn from these):
$PAST_PROMPTS}

TASK: Write a Gemini image generation prompt for a 1200x1200 social card.

Be EXTREMELY specific about:
- Exact hex colors for EVERY element (pull from brand palette + volume range in learnings)
- Exact text to render, word for word, correctly spelled
- Font descriptions that Gemini can approximate (e.g. "warm humanist serif like Alegreya" not just "serif")
- Body text MUST be described as "clean geometric sans-serif like Inter" — NOT serif
- Positioning (top-left, bottom-right, etc.) with approximate pixel values
- The eyebrow label in small caps geometric sans-serif (like Gabarito)
- What NOT to include (be explicit)

The brand mark text "GIVECARE" goes bottom-left in bold geometric sans-serif (Gabarito-style), small.

Follow the composition rules from the learnings: left-aligned, asymmetric, 60/40 content/space split, one dominant element.

Output ONLY the Gemini prompt. No explanation, no markdown.
WRITER_END

echo "Step 1: Claude writing Gemini prompt..."
cat /tmp/card-prompt-writer.txt | claude --print --model sonnet 2>/dev/null > /tmp/gemini-prompt.txt
echo "  Prompt: $(wc -c < /tmp/gemini-prompt.txt) bytes"

# Step 2: Gemini renders
echo "Step 2: Gemini rendering..."
LOGO_ARG=""
[[ -f "$LOGO" ]] && LOGO_ARG="$LOGO"

cd "$ROOT/runtime"
npx tsx -e "
import { readFileSync, writeFileSync } from 'fs'
import { GoogleGenAI } from '@google/genai'

const prompt = readFileSync('/tmp/gemini-prompt.txt', 'utf8')
const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
if (!key) { console.error('No GEMINI_API_KEY'); process.exit(1) }

async function main() {
  const client = new GoogleGenAI({ apiKey: key })
  const parts: any[] = []

  const logoPath = '${LOGO_ARG}'
  if (logoPath) {
    const logoData = readFileSync(logoPath)
    parts.push({ inlineData: { mimeType: 'image/png', data: logoData.toString('base64') } })
    parts.push({ text: 'This is the brand logo. Place it small at bottom-left.\n\n' + prompt })
  } else {
    parts.push({ text: prompt })
  }

  const response = await client.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: [{ role: 'user', parts }],
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  })

  const rParts = response.candidates?.[0]?.content?.parts ?? []
  const imagePart = rParts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))
  if (!imagePart?.inlineData?.data) {
    console.error('Gemini returned no image')
    process.exit(1)
  }

  writeFileSync('${OUTPUT}', Buffer.from(imagePart.inlineData.data, 'base64'))
  console.log('  Rendered: ${OUTPUT}')
}

main()
" 2>&1

# Step 3: Claude evaluates (reads image file from path in prompt)
echo "Step 3: Claude evaluating..."

EVAL_RESULT=$(claude --print --model sonnet "Score this social media card image at $OUTPUT against the brand system.

BRAND PALETTE: background #FDF9EC, text #3D1600, accent #FF9F00
CARD TYPE: ${CARD_TYPE}, VOLUME: ${VOLUME}, EYEBROW: ${EYEBROW}

Score 1-10:
- palette_match: Colors correct?
- typography_feel: Headline warm humanist serif? Body clean geometric sans? NOT same font.
- composition: Left-aligned? Asymmetric? Negative space?
- text_accuracy: Words spelled correctly?
- editorial_quality: High-end editorial feel?
- texture: Subtle warmth/grain or flat digital?

Output ONLY valid JSON: {\"score\": N, \"pass\": true/false, \"feedback\": [\"...\"], \"what_worked\": [\"...\"]}" 2>/dev/null || echo '{"score": 0, "pass": false, "feedback": ["eval failed"]}')

# Extract just the JSON from Claude's response (it sometimes wraps in markdown)
EVAL_JSON=$(echo "$EVAL_RESULT" | python3 -c "
import sys, json, re
raw = sys.stdin.read()
# Find JSON object in response
m = re.search(r'\{[^{}]*\}', raw, re.DOTALL)
if m:
    try:
        d = json.loads(m.group())
        print(json.dumps(d))
    except: print(json.dumps({'score':0,'pass':False,'feedback':['parse error'],'what_worked':[]}))
else:
    print(json.dumps({'score':0,'pass':False,'feedback':['no json found'],'what_worked':[]}))
" 2>/dev/null || echo '{"score":0,"pass":false,"feedback":["eval failed"],"what_worked":[]}')

echo "  Eval: $EVAL_JSON"

SCORE=$(echo "$EVAL_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('score',0))" 2>/dev/null || echo "0")

# Save to learnings
echo "$EVAL_JSON" > /tmp/card-eval.json
python3 << PYEND
import json

data = json.load(open('$LEARNINGS'))
prompt_text = open('/tmp/gemini-prompt.txt').read()
eval_data = json.load(open('/tmp/card-eval.json'))

data['prompt_history'].append({
    'timestamp': '${TIMESTAMP}',
    'card_type': '${CARD_TYPE}',
    'volume': '${VOLUME}',
    'score': eval_data.get('score', 0),
    'prompt': prompt_text[:1000],
    'eval': eval_data
})
data['prompt_history'] = data['prompt_history'][-20:]
json.dump(data, open('$LEARNINGS', 'w'), indent=2)
print('  Saved to learnings.json')
PYEND

# Retry loop if score < 7
if [[ "$SCORE" -lt 7 ]]; then
  echo "  Score $SCORE < 7. Retrying with feedback..."
  FEEDBACK=$(echo "$EVAL_JSON" | python3 -c "import sys,json; print('\n'.join(json.load(sys.stdin).get('feedback',[])))" 2>/dev/null)

  for ATTEMPT in 2 3; do
    echo ""
    echo "  Retry $ATTEMPT/3..."

    # Rewrite prompt with feedback
    cat > /tmp/card-retry-prompt.txt << RETRY_END
You previously wrote a Gemini image prompt that scored $SCORE/10. Here's the feedback:
$FEEDBACK

Here's the prompt that failed:
$(cat /tmp/gemini-prompt.txt)

Rewrite the prompt to fix these issues. Keep everything that worked. Fix what didn't.
Output ONLY the revised Gemini prompt. No explanation.
RETRY_END

    cat /tmp/card-retry-prompt.txt | claude --print --model sonnet 2>/dev/null > /tmp/gemini-prompt.txt
    echo "    Revised prompt: $(wc -c < /tmp/gemini-prompt.txt) bytes"

    # Re-render
    cd "$ROOT/runtime"
    OUTPUT="${OUTPUT%.png}-r${ATTEMPT}.png"
    npx tsx -e "
import { readFileSync, writeFileSync } from 'fs'
import { GoogleGenAI } from '@google/genai'

const prompt = readFileSync('/tmp/gemini-prompt.txt', 'utf8')
const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

async function main() {
  const client = new GoogleGenAI({ apiKey: key! })
  const parts: any[] = []
  const logoPath = '${LOGO_ARG}'
  if (logoPath) {
    parts.push({ inlineData: { mimeType: 'image/png', data: readFileSync(logoPath).toString('base64') } })
    parts.push({ text: 'Brand logo. Place small at bottom-left.\n\n' + prompt })
  } else {
    parts.push({ text: prompt })
  }
  const response = await client.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: [{ role: 'user', parts }],
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  })
  const rParts = response.candidates?.[0]?.content?.parts ?? []
  const imagePart = rParts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))
  if (!imagePart?.inlineData?.data) { console.error('No image'); process.exit(1) }
  writeFileSync('${OUTPUT}', Buffer.from(imagePart.inlineData.data, 'base64'))
  console.log('    Rendered: ${OUTPUT}')
}
main()
" 2>&1

    # Re-eval
    EVAL_RESULT=$(claude --print --model sonnet "Score this social media card image at $OUTPUT against brand palette #FDF9EC/#3D1600/#FF9F00, card type ${CARD_TYPE}, volume ${VOLUME}. Score 1-10. Output ONLY JSON: {\"score\": N, \"pass\": bool, \"feedback\": [\"...\"], \"what_worked\": [\"...\"]}" 2>/dev/null || echo '{"score":0}')
    EVAL_JSON=$(echo "$EVAL_RESULT" | python3 -c "
import sys, json, re
raw = sys.stdin.read()
m = re.search(r'\{[^{}]*\}', raw, re.DOTALL)
if m:
    try: d = json.loads(m.group()); print(json.dumps(d))
    except: print(json.dumps({'score':0,'pass':False,'feedback':['parse error']}))
else: print(json.dumps({'score':0,'pass':False,'feedback':['no json']}))" 2>/dev/null)

    SCORE=$(echo "$EVAL_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('score',0))" 2>/dev/null || echo "0")
    echo "    Score: $SCORE"

    # Save retry to learnings
    echo "$EVAL_JSON" > /tmp/card-eval.json
    python3 << PYEND2
import json
data = json.load(open('$LEARNINGS'))
prompt_text = open('/tmp/gemini-prompt.txt').read()
eval_data = json.load(open('/tmp/card-eval.json'))
data['prompt_history'].append({
    'timestamp': '${TIMESTAMP}',
    'card_type': '${CARD_TYPE}',
    'volume': '${VOLUME}',
    'score': eval_data.get('score', 0),
    'prompt': prompt_text[:1000],
    'eval': eval_data,
    'attempt': $ATTEMPT
})
data['prompt_history'] = data['prompt_history'][-20:]
json.dump(data, open('$LEARNINGS', 'w'), indent=2)
PYEND2

    if [[ "$SCORE" -ge 7 ]]; then
      echo "    Pass. Stopping."
      break
    fi
    FEEDBACK=$(echo "$EVAL_JSON" | python3 -c "import sys,json; print('\n'.join(json.load(sys.stdin).get('feedback',[])))" 2>/dev/null)
  done
fi

echo ""
echo "Done: $OUTPUT (score: $SCORE)"
