import { generateContentWithRetry } from '../gemini.js';
import { ScriptOutput } from './2_script.js';
import { RetentionPlan } from './1.5_retention_director.js';
import { StylePack } from '../style_packs.js';

export interface CharacterSceneState {
  name: 'Byte' | 'Bug';
  emotion: string;
  action: string;
}

export interface SceneOutput {
  sceneNumber: number;
  storyBeat: 'hook' | 'question' | 'escalation' | 'mystery' | 'reveal' | 'payoff' | 'cta';
  template: 'visual-story' | 'code-card' | 'architecture-diagram' | 'comparison-card' | 'terminal-simulation' | 'stat-card' | 'timeline-card';
  environment: {
    name: string;
    description: string;
  };
  characters: CharacterSceneState[];
  camera: {
    shot: 'close_up' | 'medium' | 'wide' | 'overhead' | 'pov';
    motion: 'zoom_in' | 'zoom_out' | 'pan' | 'dolly' | 'static';
  };
  speaker: 'Byte' | 'Bug';
  dialogue: string;
  captionStyle: 'dialogue' | 'fact' | 'minimal' | 'none';
  templateProps?: {
    code?: string;
    language?: string;
    command?: string;
    output?: string;
    value?: string;
    label?: string;
    subtext?: string;
    leftTitle?: string;
    leftItems?: string[];
    rightTitle?: string;
    rightItems?: string[];
  };
  storyState?: {
    beat: string;
    speaker: string;
    dialogue: string;
  };
  renderState?: {
    characters: CharacterSceneState[];
    environment: {
      name: string;
      description: string;
    };
    camera: {
      shot: string;
      motion: string;
    };
    imageUrl?: string;
    imagePrompt?: string;
  };
}

export interface ScenePlannerOutput {
  scenes: SceneOutput[];
}

export interface ScenePlannerResult {
  planner: ScenePlannerOutput;
  inputTokens: number;
  outputTokens: number;
}

export const scenePlannerSchema: any = {
  type: 'object',
  properties: {
    scenes: {
      type: 'array',
      description: "List of scenes. Must produce between 5 and 20 scenes, mapping exactly to each dialogue turn in the script.",
      items: {
        type: 'object',
        properties: {
          sceneNumber: { type: 'number' },
          storyBeat: { type: 'string', enum: ['hook', 'question', 'escalation', 'mystery', 'reveal', 'payoff', 'cta'] },
          template: {
            type: 'string',
            enum: ['visual-story'],
            description: "Must always be 'visual-story' to ensure a consistent full-screen animated visual metaphor storyline without floating cards, frames, windows, or panels."
          },
          environment: {
            type: 'object',
            properties: {
              name: { type: 'string', description: "Environment name matching the visual metaphor." },
              description: { type: 'string', description: "Visual description of the environment occupying 80-90% of the screen. Technical concepts must map to concrete physical worlds." }
            },
            required: ["name", "description"]
          },
          characters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', enum: ['Byte', 'Bug'] },
                emotion: { type: 'string', description: "Emotion/expression, e.g. 'panic', 'confused', 'excited', 'focused'." },
                action: { type: 'string', description: "Action performing in the scene, e.g. 'running on a conveyor belt while packets fly overhead'." }
              },
              required: ["name", "emotion", "action"]
            }
          },
          camera: {
            type: 'object',
            properties: {
              shot: { type: 'string', enum: ['close_up', 'medium', 'wide', 'overhead', 'pov'] },
              motion: { type: 'string', enum: ['zoom_in', 'zoom_out', 'pan', 'dolly', 'static'] }
            },
            required: ["shot", "motion"]
          },
          speaker: { type: 'string', enum: ['Byte', 'Bug'] },
          dialogue: { type: 'string', description: "Exact dialogue spoken by the speaker in this scene." },
          captionStyle: {
            type: 'string',
            enum: ['dialogue', 'fact', 'minimal', 'none'],
            description: "Intelligent caption strategy: 'dialogue' for normal speech chunks, 'fact' for max 5-word summaries, 'minimal' for action/emotional scenes (only 2 words), 'none' for pure visual scenes."
          },
          templateProps: {
            type: 'object',
            description: "Optional properties for templates other than visual-story.",
            properties: {
              code: { type: 'string' },
              language: { type: 'string' },
              command: { type: 'string' },
              output: { type: 'string' },
              value: { type: 'string' },
              label: { type: 'string' },
              subtext: { type: 'string' },
              leftTitle: { type: 'string' },
              leftItems: { type: 'array', items: { type: 'string' } },
              rightTitle: { type: 'string' },
              rightItems: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        required: ["sceneNumber", "storyBeat", "template", "environment", "characters", "camera", "speaker", "dialogue", "captionStyle"]
      }
    }
  },
  required: ["scenes"]
};

export async function runScenePlanner(
  script: ScriptOutput,
  apiKey: string,
  retentionPlan: RetentionPlan,
  stylePack?: StylePack
): Promise<ScenePlannerResult> {
  if (!apiKey) {
    throw new Error('API key is not configured.');
  }

  const prompt = `You are a Scene Director for developer Shorts.
Your task is to act as the Gemini Scene Director, generating the visual blueprint storyboard scenes for each dialogue turn in the script.

SCRIPT DIALOGUE:
---
Title: ${script.title}
Hook: ${script.hook}
CTA: ${script.cta}
Dialogue Turns:
${script.dialogue.map((turn, i) => `Turn ${i + 1}: [${turn.speaker} - ${turn.emotion}] "${turn.text}" (Action: ${turn.visualAction})`).join('\n')}
---

RETENTION BLUEPRINT:
---
Storyline: ${retentionPlan.storyline}
Viral Pattern: ${retentionPlan.viralPattern}
Curiosity Loops: ${retentionPlan.curiosityLoops.join(', ')}
Reveals: ${retentionPlan.reveals.join(', ')}
Visual Metaphor Concept: "${retentionPlan.visualMetaphor.concept}" in environment "${retentionPlan.visualMetaphor.visualWorld}"
---

Style Pack context: ${stylePack ? JSON.stringify(stylePack) : 'cyberpunk'}

Scene Director Generation Rules:
1. Pixar/Zootopia Technology City Style: The environment must depict a vibrant, friendly, colorful animated cartoon technology city (like Zootopia, Pixar, or Big Hero 6). No cyberpunk, no generic futuristic AI art, no abstract holograms, and no sci-fi wallpaper backgrounds.
2. World Mapping Rules (Strictly map tech concepts to this city):
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
3. Concept is the Hero (Environment First): The visual environment representing the metaphor must dominate 80-90% of the scene. Characters (Byte & Bug) are tiny actors (occupying 5-10% of the screen) observing or reacting from the side. Do not place characters in the center of educational scenes.
4. One Concept & Cause-and-Effect per Frame: Every scene must have a clear focal point, one visible action, and an obvious cause-and-effect relationship (e.g. a Pod building collapses -> a Kubernetes repair crew rebuilds it -> Car traffic continues moving).
5. Pacing & Camera: Shot types (close_up, medium, wide, overhead) and motions (zoom_in, zoom_out, pan, dolly) must change with every scene to maintain viewer attention. No two consecutive scenes can share identical camera settings.
6. Dialogue Verbatim: Map each dialogue turn in the script to one scene. Set the dialogue field exactly matching the turn text. Keep dialogue short (max 12-15 words per scene) to support clean captions.
7. Intelligent Caption Strategy:
   - Dialogue moments: set captionStyle to 'dialogue' to show short caption chunks.
   - Important Facts: set captionStyle to 'fact' to show a short punchy fact (keep dialogue under 5 words).
   - Emotional Moments / Action Sequences: set captionStyle to 'minimal' or 'none' to let visuals carry the scene.
   - Generate videos as if they were animated short films, not slideshow presentations. Focus on visuals, expressions, and camera movement.

Return the result as a strict JSON structure matching the schema.`;

  const response = await generateContentWithRetry(apiKey, 'gemini-2.5-flash', prompt, scenePlannerSchema, 8192);

  try {
    const planner = JSON.parse(response.text) as ScenePlannerOutput;
    return {
      planner,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens
    };
  } catch (err) {
    console.error('Failed to parse scene planner output JSON:', response.text.slice(0, 500));
    throw err;
  }
}
