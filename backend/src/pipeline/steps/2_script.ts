import { generateContentWithRetry } from '../gemini.js';
import { RetentionPlan } from './1.5_retention_director.js';

export interface DialogueTurn {
  speaker: string; // 'Byte' or 'Bug'
  text: string;
  emotion: string; // shocked, confused, explaining, confident, curious
  visualAction: string;
}

export interface ScriptOutput {
  title: string;
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
    title: { type: 'string' },
    hook: { type: 'string', description: "Opening dialogue turn spoken by the hook speaker. Must match the Retention Plan hook exactly." },
    dialogue: {
      type: 'array',
      description: "Dialogue turns mapping to the story progression (Hook -> Question -> Escalation -> Mystery -> Reveal -> Payoff -> CTA). Write a full and complete story that fully explains the concept and resolves the main tension. Total words in dialogue should be between 150 and 250 words for 60-120s duration.",
      items: {
        type: 'object',
        properties: {
          speaker: { type: 'string', enum: ['Byte', 'Bug'] },
          text: { type: 'string', description: "Dialogue spoken by the character. Short, punchy sentences." },
          emotion: { type: 'string', enum: ['shocked', 'confused', 'explaining', 'confident', 'curious'] },
          visualAction: { type: 'string', description: "Short description of what the character is doing visually, referencing the metaphor." }
        },
        required: ["speaker", "text", "emotion", "visualAction"]
      }
    },
    cta: { type: 'string', description: "Final closing call to action. Max 5-7 words." },
    duration: { type: 'number', description: "Estimated duration in seconds (should be between 60 and 120 seconds)." }
  },
  required: ["title", "hook", "dialogue", "cta", "duration"]
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

  const prompt = `You are an expert technical scriptwriter for YouTube Shorts.
Your task is to generate a conversational dialogue script between Byte (expert robot) and Bug (learner insect) explaining the topic: "${topic}".

STORY ENGINE BLUEPRINT (Strictly follow this):
---
Retention Plan Hook: "${retentionPlan.hook}"
Storyline Framework: "${retentionPlan.storyline}"
Viral Pattern: "${retentionPlan.viralPattern}"
Curiosity Loops: ${retentionPlan.curiosityLoops.join(', ')}
Reveals: ${retentionPlan.reveals.join(', ')}
Visual Metaphor Concept: "${retentionPlan.visualMetaphor.concept}" in environment "${retentionPlan.visualMetaphor.visualWorld}"
Mappings: ${JSON.stringify(retentionPlan.visualMetaphor.mapping)}
---

UNIVERSE RULES:
${universeRules || 'Byte explains tech; Bug asks questions; Both explore digital worlds.'}

RESEARCH CONTEXT:
---
${researchData}
---

${feedback ? `REVISION FEEDBACK: "${feedback}"` : ''}

Strict Scriptwriting Guidelines:
1. Target Audience: Software developers.
2. Hook: Must match the Retention Plan hook exactly. Spoken by the first speaker. No build-up.
3. Dialogue: Write a dialogue where Bug experiences a problem or asks the question, and Byte explains using the Visual Metaphor. Characters should interact, react, and demonstrate the concept visually rather than just talking.
4. Pacing & Word Count: Let the story unfold naturally and completely. Do not cut off abruptly after the first question. Ensure all curiosity loops are fully resolved and the concept is clearly understood before closing. Keep the total word count between 150 and 250 words (60 to 120 seconds duration). Avoid monologues; keep turns conversational.
5. CTA: Direct, specific call to action inviting keyword comments.

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
