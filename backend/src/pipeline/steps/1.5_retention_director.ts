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
      description: "Immediate first-sentence hook. Must state a pain, result, or massive outcome inside 3 seconds. e.g. 'Kafka doesn't actually store files the way you think.'"
    },
    curiosityLoops: {
      type: 'array',
      items: { type: 'string' },
      description: "List of 2-3 unanswered questions to keep viewers curious (e.g. 'If Redis stores everything in memory, what happens when the power cuts?')"
    },
    reveals: {
      type: 'array',
      items: { type: 'string' },
      description: "List of 2-3 key reveal milestones that deliver payoffs."
    },
    patternInterrupts: {
      type: 'array',
      items: { type: 'string' },
      description: "List of visual overrides (e.g. 'A giant database grid pulses red', 'Camera shifts to extreme close up of a code card')."
    },
    visualMetaphor: {
      type: 'object',
      properties: {
        concept: { type: 'string', description: "The technical concept to visualize." },
        visualWorld: { type: 'string', description: "The metaphor environment, e.g. 'A conveyor belt shipping boxes', 'A crowded vault door'." },
        mapping: {
          type: 'object',
          description: "Key-value mappings of tech terms to visual things, e.g. {'event': 'shipping box', 'broker': 'conveyor belt'}",
          properties: {} // Open properties map
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

  const prompt = `You are the AI Retention Director for a developer Shorts channel.
Your mission is to analyze the topic and design a high-retention storyboard blueprint before the script is written.
We need to capture developers within 3 seconds and keep them watching for 30-40 seconds.

Topic: "${topic}"
Series Name: ${seriesName || 'Default Series'}
Universe Rules: ${seriesUniverseRules || 'None'}
Past Topics in this Series: ${pastTopics.length > 0 ? pastTopics.join(', ') : 'None'}

Instructions:
1. Choose the single most effective storyline framework and viral pattern that makes this topic look like an exciting, visual story.
   - If past topics exist, choose a DIFFERENT pattern or angle than what was used previously if possible, to keep the series diverse.
2. Draft an immediate hook (max 12 words) that doesn't say "Welcome" or "Have you ever wondered". State the outcome/shock.
3. Design 2-3 curiosity loops (questions that stay open) and 2-3 reveals.
4. Establish a Visual Metaphor that maps the technical components of the topic to a concrete physical cartoon technology city (Pixar/Zootopia style) using these exact infrastructure mappings:
   - Request -> Car
   - Traffic / Data Flow -> Cars moving on roads
   - Service -> Highway
   - Pod -> Building
   - Container -> Shop
   - Node -> City District
   - Load Balancer -> Traffic Junction
   - Deployment -> Construction Blueprint
   - Kubernetes -> City Infrastructure System
   - Database -> Warehouse
   - Cache -> Local Convenience Store
   - Queue -> Waiting Lane
   - API Gateway -> City Gate
   - Microservice -> Specialized Building
5. Predict the retention rate.

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
