import { generateContentWithRetry } from '../gemini.js';
import { ScriptOutput } from './2_script.js';
import { SceneOutput } from './3_scene_planner.js';
import { RetentionPlan } from './1.5_retention_director.js';

export interface RetentionAuditOutput {
  retentionScore: number;
  hookStrength: number;
  curiosityLoopsMatch: number;
  revealsMatch: number;
  patternInterruptFrequency: number;
  visualComposition: number;
  issues: string[];
}

export interface RetentionAuditResult {
  auditor: RetentionAuditOutput;
  inputTokens: number;
  outputTokens: number;
}

export const retentionAuditorSchema: any = {
  type: 'object',
  properties: {
    retentionScore: { type: 'number', description: "Final retention score from 0 to 100 based on all categories." },
    hookStrength: { type: 'number', description: "Score from 0 to 20 assessing the hook punchiness." },
    curiosityLoopsMatch: { type: 'number', description: "Score from 0 to 20 checking if script and scenes address all curiosity loops." },
    revealsMatch: { type: 'number', description: "Score from 0 to 20 checking if visual reveals are executed correctly." },
    patternInterruptFrequency: { type: 'number', description: "Score from 0 to 20 evaluating if visual/camera changes happen every 5-8s." },
    visualComposition: { type: 'number', description: "Score from 0 to 20 evaluating character poses, emotions, and environment variety." },
    issues: {
      type: 'array',
      items: { type: 'string' },
      description: "List of specific structural problems found, e.g. ['weak hook', 'early reveal', 'low visual change frequency']."
    }
  },
  required: [
    "retentionScore",
    "hookStrength",
    "curiosityLoopsMatch",
    "revealsMatch",
    "patternInterruptFrequency",
    "visualComposition",
    "issues"
  ]
};

export async function runRetentionAudit(
  script: ScriptOutput,
  scenes: SceneOutput[],
  retentionPlan: RetentionPlan,
  apiKey: string
): Promise<RetentionAuditResult> {
  if (!apiKey) {
    throw new Error('API key is not configured.');
  }

  const prompt = `You are a senior technical video director auditing a storyboard scene plan for developer Shorts.
Your task is to calculate a retention score and audit the storyboard for visual variety and storytelling consistency.

STORYBOARD DATA:
---
Script Hook: "${script.hook}"
Retention Plan Blueprint:
- Hook: "${retentionPlan.hook}"
- Curiosity Loops: ${retentionPlan.curiosityLoops.join(', ')}
- Reveals: ${retentionPlan.reveals.join(', ')}
- Metaphor: "${retentionPlan.visualMetaphor.concept}" in "${retentionPlan.visualMetaphor.visualWorld}"

Generated Scenes storyboard:
${JSON.stringify(scenes)}
---

Scoring Rubric (Total 100 points, 20 points per category):
1. Hook Strength: Spoken hook matches the blueprint exactly, starts with immediate outcome (< 3s). (Max 20)
2. Curiosity Loops: The script/scenes build tension by keeping the loops active and resolving them in the correct beats. (Max 20)
3. Reveals Delivery: Storyboard contains the requested reveals in the correct beats, showing character reactions. (Max 20)
4. Pattern Interrupts: Camera shots, environments, or character emotions change every 5-8 seconds (every 2-3 scenes). Penalize scenes with identical layout/camera configurations consecutively. (Max 20)
5. Visual Composition: Image prompts are detailed, specifying character description, pose, emotion, environment details, and camera angle. (Max 20)

Output the scores and a list of specific issues in the requested JSON structure.`;

  const response = await generateContentWithRetry(apiKey, 'gemini-2.5-flash-lite', prompt, retentionAuditorSchema);

  try {
    const auditor = JSON.parse(response.text) as RetentionAuditOutput;
    return {
      auditor,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens
    };
  } catch (err) {
    console.error('Failed to parse retention audit output JSON:', response.text);
    throw err;
  }
}
