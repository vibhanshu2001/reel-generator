import { generateContentWithRetry } from '../gemini.js';
import { RetentionPlan } from './1.5_retention_director.js';

export interface DialogueTurn {
  speaker: string; // 'Byte' or 'Bug'
  text: string;
  emotion: string; // shocked, confused, explaining, confident, curious, sarcastic, dramatic
  visualAction: string;
}

export interface ScriptOutput {
  title: string;
  youtubeTitle?: string;
  youtubeDescription?: string;
  hook: string;
  dialogue: DialogueTurn[];
  cta: string;
  duration: number;
}

export interface ScriptGeneratorResult {
  script: ScriptOutput;
  inputTokens: number;
  outputTokens: number;
}

export const scriptSchema: any = {
  type: 'object',
  properties: {
    title: { type: 'string', description: "Internal working title for the short." },
    youtubeTitle: { type: 'string', description: "Final YouTube Shorts title. Under 70 characters, curiosity-driven, technical, no clickbait lies." },
    youtubeDescription: { type: 'string', description: "Final YouTube Shorts description. 2-4 concise lines explaining the topic, including 3-6 relevant hashtags." },
    hook: { type: 'string', description: "Opening dialogue turn spoken by the hook speaker. Must match the Retention Plan hook exactly." },
    dialogue: {
      type: 'array',
      description: "Dialogue turns mapping to the story progression (Hook -> Question -> Escalation -> Mystery -> Reveal -> Payoff -> CTA). Write a full and complete story that fully explains the concept and resolves the main tension. Total words in dialogue should be between 150 and 250 words for 60-120s duration.",
      items: {
        type: 'object',
        properties: {
          speaker: { type: 'string', enum: ['Byte', 'Bug'] },
          text: { type: 'string', description: "Dialogue spoken by the character. Short, punchy sentences. Max 12 words per turn." },
          emotion: { type: 'string', enum: ['shocked', 'confused', 'explaining', 'confident', 'curious', 'sarcastic', 'dramatic'] },
          visualAction: { type: 'string', description: "Short description of what the character is doing visually, using comic animation actions (jumping, pointing, running, falling, gesturing dramatically, tilting head, looking around)." }
        },
        required: ["speaker", "text", "emotion", "visualAction"]
      }
    },
    cta: { type: 'string', description: "Final closing call to action. Max 5-7 words." },
    duration: { type: 'number', description: "Estimated duration in seconds (should be between 60 and 120 seconds)." }
  },
  required: ["title", "youtubeTitle", "youtubeDescription", "hook", "dialogue", "cta", "duration"]
};

export async function runScriptGenerator(
  topic: string,
  researchData: string,
  apiKey: string,
  retentionPlan: RetentionPlan,
  universeRules?: string,
  feedback?: string
): Promise<ScriptGeneratorResult> {
  if (!apiKey) {
    throw new Error('API key is not configured.');
  }

  const prompt = `You are an expert technical scriptwriter for YouTube Shorts, writing for the "Byte & Bug" channel.

═══════════════════════════════════════════════════
BYTE & BUG CHARACTER BIBLE — FOLLOW STRICTLY
═══════════════════════════════════════════════════

BYTE — THE AUDIENCE SURROGATE
• Role: Asks questions. Learns things. Reacts emotionally. Represents the confused viewer.
• Appearance: Young human, blue hoodie, black hair, curious/confused expression.
• Personality: Curious, easily confused, shocked by revelations, relatable.
• Emotions to use: "shocked", "confused", "curious"
• Example lines: "Wait... what happens if AWS crashes?" / "Seriously?!" / "But... how does it know WHERE to go?"

BUG — THE TECH EXPERT & STORYTELLER
• Role: Explains concepts. Makes jokes. Creates chaos. Shows off knowledge dramatically.
• Appearance: Young human, red hoodie, small bug antenna on hood, confident grin.
• Personality: Confident, sarcastic, funny, dramatic, energetic.
• Emotions to use: "explaining", "confident", "sarcastic", "dramatic"
• Example lines: "Half the internet starts sweating." / "Hahaha... not even close." / "Let me show you."

═══════════════════════════════════════════════════
STORY STRUCTURE — EVERY VIDEO IS A CONVERSATION
═══════════════════════════════════════════════════

BAD: "Narrator explains AWS."
GOOD:
  Byte: "Wait... what happens if AWS crashes?"
  Bug: "Half the internet starts sweating."
  Byte: "Seriously?"
  Bug: "Let me show you."

Story Arc (strictly follow):
1. HOOK → Bug delivers shocking fact OR Byte asks the setup question (3 seconds, grabs attention)
2. QUESTION → Byte is confused, asks the core question
3. ESCALATION → Bug makes it more dramatic/chaotic (creates urgency)
4. MYSTERY → Byte asks deeper follow-up, reveals they don't fully understand
5. REVEAL → Bug explains the key insight dramatically
6. PAYOFF → Byte reacts with shock/awe, Bug delivers the memorable lesson
7. CTA → Direct developer call to action

═══════════════════════════════════════════════════
DIALOGUE & PACING RULES
═══════════════════════════════════════════════════

• Every turn: MAX 12 WORDS. Keep it punchy and conversational.
• Alternate speakers every turn. No monologues.
• Every 5–8 seconds: include a surprise, joke, or visual reveal moment.
• Bug should be sarcastic at least twice: e.g., "Oh wow, great observation." or "Shocking, I know."
• Byte should express shock with short outbursts: "What?!", "No way!", "Wait, seriously?"
• Characters NEVER stand still — every visualAction must describe movement:
  - Head tilts, hand gestures, jumping, pointing, running, looking around
  - At least one "crashes through" or "zooms into" action per video
• Important tech words (AWS, CRASHED, BILLIONS, INTERNET) should dominate in caption weight.
• YouTube metadata must be developer-focused:
  - youtubeTitle: under 70 characters, clear technical promise, curiosity gap, no vague hype.
  - youtubeDescription: 2-4 short lines, mention what the viewer learns, end with relevant hashtags.

═══════════════════════════════════════════════════
STORY ENGINE BLUEPRINT
═══════════════════════════════════════════════════
Topic: "${topic}"
Retention Plan Hook: "${retentionPlan.hook}"
Storyline Framework: "${retentionPlan.storyline}"
Viral Pattern: "${retentionPlan.viralPattern}"
Curiosity Loops: ${retentionPlan.curiosityLoops.join(', ')}
Reveals: ${retentionPlan.reveals.join(', ')}
Visual Metaphor: "${retentionPlan.visualMetaphor.concept}" in "${retentionPlan.visualMetaphor.visualWorld}"
Mappings: ${JSON.stringify(retentionPlan.visualMetaphor.mapping)}

UNIVERSE RULES:
${universeRules || 'Byte asks questions; Bug explains tech through chaotic comic adventures in digital worlds.'}

RESEARCH CONTEXT:
${researchData}

${feedback ? `REVISION FEEDBACK: "${feedback}"` : ''}

Return the result as a strict JSON structure matching the schema.`;

  const response = await generateContentWithRetry(apiKey, 'gemini-2.5-flash', prompt, scriptSchema);

  try {
    const script = JSON.parse(response.text) as ScriptOutput;
    return {
      script,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens
    };
  } catch (err) {
    console.error('Failed to parse script output JSON:', response.text);
    throw err;
  }
}

export const informativeScriptSchema: any = {
  type: 'object',
  properties: {
    title: { type: 'string', description: "Internal working title for the informative post." },
    youtubeTitle: { type: 'string', description: "Final title for the post. Under 70 characters, catchy, viral-optimized, no clickbait." },
    youtubeDescription: { type: 'string', description: "Detailed informative post caption. Should be 100-150 words of rich, engaging, complete explanations of the topic, broken down into readable paragraphs. End with 4-6 viral hashtags." },
    hook: { type: 'string', description: "The hook question/statement that will display at the top of the video. E.g. 'Why did childhood vaccines leave circular marks?' Max 15 words." },
    info: { type: 'string', description: "A very short, punchy answer/summary (1-2 sentences, max 20 words) to overlay at the bottom of the video. E.g. 'The scars are remnants of live vaccines like Smallpox or BCG administered under the skin.'" },
    imageSearchQuery: { type: 'string', description: "An optimized search term to find a relevant picture on Google Images. E.g. 'BCG vaccine scar arm close up'. Keep it concrete." },
    cta: { type: 'string', description: "Final closing call to action to show at the bottom or end of video. Max 6 words." },
    duration: { type: 'number', description: "Reel duration in seconds. Must be exactly 30." }
  },
  required: ["title", "youtubeTitle", "youtubeDescription", "hook", "info", "imageSearchQuery", "cta", "duration"]
};

export async function runInformativeScriptGenerator(
  topic: string,
  researchData: string,
  apiKey: string
): Promise<{ script: any; inputTokens: number; outputTokens: number }> {
  if (!apiKey) {
    throw new Error('API key is not configured.');
  }

  const prompt = `You are an expert content creator specializing in educational and viral social media reels (Instagram Reels, TikTok, YouTube Shorts).
Your goal is to write the copy for an informative "Spotlight" reel.

This format consists of:
1. A visual hook question/statement displayed at the top of the video.
2. A single high-quality image displayed in the center.
3. A very short, punchy summary answer (max 20 words) to overlay at the bottom of the video.
4. A detailed, highly engaging caption (100-150 words) that provides the full explanation, answering the hook question completely.

Topic: "${topic}"

RESEARCH CONTEXT:
${researchData}

Instructions:
1. Create a compelling hook question/statement. It should be intriguing and make users want to stop scrolling (e.g. "Why did vaccines we got as kids leave circular marks like this?"). Max 15 words.
2. Create a very short, punchy summary answer (max 20 words) to display as overlay text at the bottom of the video, answering the hook question briefly (e.g. "The scars are remnants of live vaccines administered intradermally.").
3. Write a detailed explanation caption (100-150 words). Break it down into 2-3 readable short paragraphs. Make it simple, clear, and highly informative. Add 4-6 viral tags at the end (e.g. #vaccine #medicalhistory #learnontiktok).
4. Generate a concrete search term for Google Images (e.g. "BCG vaccine scar on shoulder close up") that represents the visual topic. Do not include abstract terms, make it direct and searchable.
5. Set duration exactly to 30.

Return the result as a strict JSON structure matching the schema.`;

  const response = await generateContentWithRetry(apiKey, 'gemini-2.5-flash', prompt, informativeScriptSchema);

  try {
    const script = JSON.parse(response.text);
    return {
      script,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens
    };
  } catch (err) {
    console.error('Failed to parse informative script JSON:', response.text);
    throw err;
  }
}
