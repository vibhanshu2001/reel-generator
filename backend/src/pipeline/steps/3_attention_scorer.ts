import { AttentionPlan, AttentionScore, ATTENTION_SCORE_THRESHOLD } from '../attention.js';
import { ScriptOutput } from './2_script.js';

export interface AttentionScorerResult {
  scorer: AttentionScore;
  inputTokens: number;
  outputTokens: number;
}

export function scoreAttentionPlan(script: ScriptOutput, plan: AttentionPlan): AttentionScore {
  const hookStrength = scoreHook(script, plan);
  const curiosityGap = scoreCuriosity(plan);
  const surprisePotential = scoreSurprise(plan);
  const patternInterruptFrequency = scorePatternInterrupts(plan);
  const payoffQuality = scorePayoff(plan);
  const ctaFit = scoreCta(script, plan);
  const score = Math.round(
    hookStrength * 0.2 +
    curiosityGap * 0.18 +
    surprisePotential * 0.16 +
    patternInterruptFrequency * 0.16 +
    payoffQuality * 0.2 +
    ctaFit * 0.1
  );
  const feedback = buildFeedback({
    score,
    hookStrength,
    curiosityGap,
    surprisePotential,
    patternInterruptFrequency,
    payoffQuality,
    ctaFit,
    pass: score >= ATTENTION_SCORE_THRESHOLD,
    feedback: ''
  });

  return {
    score,
    hookStrength,
    curiosityGap,
    surprisePotential,
    patternInterruptFrequency,
    payoffQuality,
    ctaFit,
    pass: score >= ATTENTION_SCORE_THRESHOLD,
    feedback
  };
}

export async function runAttentionScorer(
  script: ScriptOutput,
  plan: AttentionPlan
): Promise<AttentionScorerResult> {
  return {
    scorer: scoreAttentionPlan(script, plan),
    inputTokens: 0,
    outputTokens: 0
  };
}

function scoreHook(script: ScriptOutput, plan: AttentionPlan): number {
  let score = 0;
  const claim = plan.hook?.claim || '';
  if (claim.length >= 18) score += 20;
  if (/\b(slower|faster|break|bug|mistake|cost|latency|crash|leak|scale|10x|x)\b/i.test(claim)) score += 28;
  if (plan.hook.visibleByFrame <= 30) score += 24;
  if (sharesMeaning(claim, script.hook)) score += 18;
  if (!/^(have you ever|let'?s talk|in this video|today we)/i.test(claim)) score += 10;
  return clamp(score);
}

function scoreCuriosity(plan: AttentionPlan): number {
  const gap = plan.hook?.curiosityGap || '';
  let score = gap.length >= 25 ? 34 : 12;
  if (/\b(why|how|what|which|hidden|instead|actually|until|unless)\b/i.test(gap)) score += 26;
  if (plan.beats.some((beat) => beat.viewerQuestion.length >= 18)) score += 22;
  if (plan.payoff.promise && relatedWords(gap, plan.payoff.promise) >= 1) score += 18;
  return clamp(score);
}

function scoreSurprise(plan: AttentionPlan): number {
  const strongBeats = plan.beats.filter((beat) => beat.surprise.length >= 12);
  const roles = new Set(plan.beats.map((beat) => beat.role));
  let score = Math.min(50, strongBeats.length * 13);
  if (roles.has('shock')) score += 12;
  if (roles.has('reveal') || roles.has('proof')) score += 16;
  if (roles.has('payoff')) score += 12;
  if (plan.beats.length >= 4) score += 10;
  return clamp(score);
}

function scorePatternInterrupts(plan: AttentionPlan): number {
  const interrupts = plan.beats.map((beat) => beat.patternInterrupt).filter(Boolean);
  const uniqueInterrupts = new Set(interrupts);
  const target = Math.max(1, plan.scoringTargets.minPatternInterrupts || 3);
  let score = Math.min(70, (interrupts.length / target) * 55);
  score += Math.min(30, uniqueInterrupts.size * 10);
  return clamp(score);
}

function scorePayoff(plan: AttentionPlan): number {
  let score = 0;
  if (plan.payoff.promise.length >= 20) score += 34;
  if (plan.payoff.deliveredByScene > 0) score += 18;
  if (plan.beats.some((beat) => beat.role === 'payoff')) score += 24;
  if (relatedWords(plan.hook.curiosityGap, plan.payoff.promise) >= 1) score += 24;
  return clamp(score);
}

function scoreCta(script: ScriptOutput, plan: AttentionPlan): number {
  let score = 45;
  if (script.cta.length <= 70) score += 20;
  if (/\b(follow|save|share|comment|try|ship|debug|system design|dev)\b/i.test(script.cta)) score += 20;
  if (plan.beats.some((beat) => beat.role === 'cta')) score += 15;
  return clamp(score);
}

function buildFeedback(score: AttentionScore): string {
  const issues: string[] = [];
  if (score.hookStrength < 75) issues.push('Make the hook claim more concrete and visible by frame 30.');
  if (score.curiosityGap < 75) issues.push('Create a sharper curiosity gap that asks a specific developer question.');
  if (score.patternInterruptFrequency < 75) issues.push('Add at least three varied pattern interrupts.');
  if (score.payoffQuality < 75) issues.push('Tie the payoff directly to the original curiosity gap before CTA.');
  if (score.surprisePotential < 75) issues.push('Add shock, reveal/proof, and payoff beats with non-obvious surprises.');
  return issues.length ? issues.join(' ') : `Attention plan passes at ${score.score}/100.`;
}

function sharesMeaning(a: string, b: string): boolean {
  return relatedWords(a, b) >= 2;
}

function relatedWords(a: string, b: string): number {
  const stop = new Set(['this', 'that', 'with', 'from', 'your', 'will', 'into', 'when', 'then', 'than', 'the', 'and', 'for']);
  const wordsA = tokenize(a).filter((word) => !stop.has(word));
  const wordsB = new Set(tokenize(b).filter((word) => !stop.has(word)));
  return wordsA.filter((word) => wordsB.has(word)).length;
}

function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) || [];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
