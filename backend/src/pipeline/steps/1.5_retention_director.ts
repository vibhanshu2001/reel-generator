import { generateContentWithRetry } from '../gemini.js';

export interface VisualMetaphor {
  concept: string;
  visualWorld: string;
  mapping: Record<string, string>;
}

export interface RetentionPlan {
  storyline: string;
  viralPattern: string;
  hook: string;
  curiosityLoops: string[];
  reveals: string[];
  patternInterrupts: string[];
  visualMetaphor: VisualMetaphor;
  predictedRetention: number;
}

export interface RetentionDirectorResult {
  plan: RetentionPlan;
  inputTokens: number;
  outputTokens: number;
}

export const retentionPlanSchema: any = {
  type: 'object',
  properties: {
    storyline: {
      type: 'string',
      enum: ['explainer', 'mystery', 'problem_solution', 'timeline', 'success_story', 'case_study', 'comparison', 'before_after', 'documentary', 'shocking_facts', 'rise_fall', 'custom']
    },
    viralPattern: {
      type: 'string',
      enum: ['myth_busting', 'hidden_truth', 'battle', 'race', 'countdown', 'unexpected_twist', 'before_after', 'survival_story', 'mystery_box']
    },
    hook: {
      type: 'string',
      description: "Immediate hook line for the first speaker. Must be a short punchy sentence (max 12 words) that grabs attention within 3 seconds. For Bug: a shocking tech fact or sarcastic revelation. For Byte: a relatable confused question. Do NOT start with 'Welcome', 'Have you ever wondered', or 'Today we will'. Examples: 'Half the internet just went offline. All because of one file.' or 'Wait... where does my message actually GO?'"
    },
    curiosityLoops: {
      type: 'array',
      items: { type: 'string' },
      description: "List of 2-3 unanswered questions to keep viewers curious. Frame as Byte would ask them: 'But wait, what happens when...?' or 'So where does it actually go?'"
    },
    reveals: {
      type: 'array',
      items: { type: 'string' },
      description: "List of 2-3 key reveal milestones that deliver payoffs. Frame as Bug's dramatic revelations."
    },
    patternInterrupts: {
      type: 'array',
      items: { type: 'string' },
      description: "List of visual overrides using comic animation style (e.g. 'Camera crashes through a router wall', 'Bug jumps into frame from offscreen', 'Byte's head explodes with shock lines', 'Extreme close-up of a flashing error screen')."
    },
    visualMetaphor: {
      type: 'object',
      properties: {
        concept: { type: 'string', description: "The technical concept to visualize." },
        visualWorld: { type: 'string', description: "The metaphor environment in comic animation style. Must be a dynamic, action-oriented world — NOT a static city. Examples: 'A chaotic mail sorting factory where packages race through tubes', 'A lightning-fast underground vault where memory cells glow and flicker'." },
        mapping: {
          type: 'object',
          description: "Key-value mappings of tech terms to visual things in the metaphor world. e.g. {'event': 'package on a conveyor belt', 'broker': 'sorting machine', 'consumer': 'delivery truck'}",
          properties: {}
        }
      },
      required: ["concept", "visualWorld", "mapping"]
    },
    predictedRetention: {
      type: 'number',
      description: "AI predicted 15-second retention percentage (0 to 100) based on hook and loops strength."
    }
  },
  required: [
    "storyline",
    "viralPattern",
    "hook",
    "curiosityLoops",
    "reveals",
    "patternInterrupts",
    "visualMetaphor",
    "predictedRetention"
  ]
};

export async function runRetentionDirector(
  topic: string,
  apiKey: string,
  seriesName?: string,
  seriesUniverseRules?: string,
  pastTopics: string[] = []
): Promise<RetentionDirectorResult> {
  if (!apiKey) {
    throw new Error('API key is not configured.');
  }

  const prompt = `You are the AI Retention Director for the "Byte & Bug" developer Shorts channel.
Your mission is to design a high-retention storyboard blueprint before the script is written.
We need to capture developers within 3 seconds and keep them watching for 60-120 seconds.

═══════════════════════════════════════════════════
THE BYTE & BUG UNIVERSE
═══════════════════════════════════════════════════

Every video is a CONVERSATION, not a lecture. Two characters explore tech together:

BYTE (blue hoodie, black hair) — The Audience Surrogate
• Asks the questions the viewer is already thinking
• Reacts with shock, curiosity, confusion
• The hook can be Byte asking the inciting question

BUG (red hoodie, bug antenna) — The Tech Expert
• Delivers shocking facts and sarcastic revelations
• Creates chaos and dramatic reveals
• The hook can be Bug dropping a shocking opening statement

CANONICAL EPISODE PATTERN:
Hook (Bug shocks OR Byte asks) → Byte questions → Bug escalates → Byte deeper confusion → Bug reveals → Byte awe/shock → CTA

═══════════════════════════════════════════════════
VISUAL STYLE REQUIREMENT
═══════════════════════════════════════════════════

All visual metaphors must be designed for MODERN 2D COMIC ANIMATION:
- Technical 2D comic aesthetic for developers: APIs, queues, databases, terminals, cloud blocks, data packets
- Dynamic action, speed lines, motion streaks, impact frames
- Comic panel energy — NOT Pixar 3D, NOT realistic renders
- The metaphor environment must be ACTION-ORIENTED (factory, race, vault, battlefield, obstacle course)
- Characters crash through environments, zoom across scenes, react with exaggerated comic expressions

═══════════════════════════════════════════════════
HOOK RULES
═══════════════════════════════════════════════════

The hook must:
1. State a pain, result, or massive shock within 3 seconds
2. Never start with: "Welcome", "Have you ever wondered", "Today we will", "In this video"
3. Be spoken naturally as Byte OR Bug dialogue (not narration)
4. Use concrete, visual language — not abstract concepts
5. Create immediate curiosity: the viewer MUST want to know what happens next

Topic: "${topic}"
Series Name: ${seriesName || 'Byte & Bug'}
Universe Rules: ${seriesUniverseRules || 'Byte asks; Bug explains; both explore digital worlds through chaotic comic adventures.'}
Past Topics in this Series: ${pastTopics.length > 0 ? pastTopics.join(', ') : 'None'}

Instructions:
1. Choose the single most effective storyline framework and viral pattern for this topic.
   - If past topics exist, choose a DIFFERENT pattern or angle to keep the series diverse.
2. Design 2-3 curiosity loops framed as Byte's questions.
3. Design 2-3 reveals framed as Bug's dramatic revelations.
4. Design 2-3 pattern interrupts in comic animation style (crashes, zooms, close-ups).
5. Establish a Visual Metaphor that maps technical components to a dynamic, action-oriented comic world.
6. Predict the retention rate.

Return the result as a strict JSON structure matching the schema.`;

  const response = await generateContentWithRetry(apiKey, 'gemini-2.5-flash', prompt, retentionPlanSchema);

  try {
    const plan = JSON.parse(response.text) as RetentionPlan;
    return {
      plan,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens
    };
  } catch (err) {
    console.error('Failed to parse retention director JSON output:', response.text);
    throw err;
  }
}
