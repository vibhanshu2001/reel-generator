import { attentionPlanSchema } from '../prompts.js';
import { generateContentWithRetry } from '../gemini.js';
import { ScriptOutput } from './2_script.js';
import { AttentionPlan, normalizeAttentionPlan } from '../attention.js';

export interface AttentionDirectorResult {
  attentionPlan: AttentionPlan;
  inputTokens: number;
  outputTokens: number;
}

export async function runAttentionDirector(
  script: ScriptOutput,
  apiKey: string,
  feedback?: string
): Promise<AttentionDirectorResult> {
  if (!apiKey) {
    throw new Error('API key is not configured.');
  }

  const scriptBodyText = (script as any).body || (script.dialogue ? script.dialogue.map(t => `${t.speaker}: ${t.text}`).join('\n') : '');
  const prompt = `You are the Attention Director for a developer education YouTube Shorts pipeline.
Your only job is retention strategy. Do not choose visual templates. Decide why a developer keeps watching, what question remains open, where surprise happens, and when the promise is paid off.

SCRIPT:
Title: ${script.title}
Hook: ${script.hook}
Body: ${scriptBodyText}
CTA: ${script.cta}

${feedback ? `The previous attention strategy scored below threshold. Fix these issues before returning JSON: ${feedback}` : ''}

Return an AttentionPlan:
- hook.claim must be the first-frame reason to care.
- hook.curiosityGap must create a specific unanswered developer question.
- hook.visibleByFrame must be <= 30.
- beats must cover shock/problem, escalation or reveal, proof, payoff, and CTA.
- Every beat needs a viewerQuestion, surprise, and one pattern interrupt.
- Include at least 3 pattern interrupts across the plan.
- payoff.promise must match the curiosity gap and be delivered before the CTA.
- scoringTargets should be strict enough for a high-retention developer Short.`;

  const response = await generateContentWithRetry(apiKey, 'gemini-2.5-flash', prompt, attentionPlanSchema);

  try {
    const attentionPlan = normalizeAttentionPlan(JSON.parse(response.text) as AttentionPlan);
    return {
      attentionPlan,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens
    };
  } catch (err) {
    console.error('Failed to parse attention director output JSON:', response.text);
    throw err;
  }
}
