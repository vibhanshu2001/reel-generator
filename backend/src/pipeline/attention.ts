export type PatternInterrupt = 'zoom' | 'silence' | 'counter' | 'visual_swap' | 'code_reveal' | 'sound_hit';

export interface AttentionPlan {
  version: 1;
  hook: {
    claim: string;
    curiosityGap: string;
    visibleByFrame: number;
  };
  beats: Array<{
    id: string;
    role: 'shock' | 'problem' | 'escalation' | 'reveal' | 'proof' | 'payoff' | 'cta';
    viewerQuestion: string;
    surprise: string;
    patternInterrupt: PatternInterrupt;
  }>;
  payoff: {
    promise: string;
    deliveredByScene: number;
  };
  scoringTargets: {
    minHookStrength: number;
    minCuriosityGap: number;
    minPatternInterrupts: number;
    minPayoffQuality: number;
  };
}

export interface AttentionScore {
  score: number;
  hookStrength: number;
  curiosityGap: number;
  surprisePotential: number;
  patternInterruptFrequency: number;
  payoffQuality: number;
  ctaFit: number;
  pass: boolean;
  feedback: string;
}

export const ATTENTION_SCORE_THRESHOLD = 75;

export function normalizeAttentionPlan(plan: AttentionPlan): AttentionPlan {
  return {
    ...plan,
    version: 1,
    beats: plan.beats.map((beat, index) => ({
      ...beat,
      id: beat.id || `beat-${index + 1}`
    })),
    scoringTargets: {
      minHookStrength: plan.scoringTargets?.minHookStrength ?? 16,
      minCuriosityGap: plan.scoringTargets?.minCuriosityGap ?? 16,
      minPatternInterrupts: plan.scoringTargets?.minPatternInterrupts ?? 3,
      minPayoffQuality: plan.scoringTargets?.minPayoffQuality ?? 16
    }
  };
}
