import { generateContentWithRetry } from '../gemini.js';
import { ScriptOutput } from './2_script.js';
import { RetentionPlan } from './1.5_retention_director.js';
import { StylePack } from '../style_packs.js';

export interface CharacterSceneState {
  name: 'Byte' | 'Bug';
  emotion: string;
  action: string;
  pose: string; // comic pose descriptor: e.g. "jumping with arms wide", "pointing dramatically", "head tilted confused"
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
              description: { type: 'string', description: "Visual description of the environment occupying 80-90% of the screen. Must describe comic animation style: strong outlines, vibrant flat gradients, speed lines, impact frames, halftone textures. No Pixar 3D." }
            },
            required: ["name", "description"]
          },
          characters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', enum: ['Byte', 'Bug'] },
                emotion: { type: 'string', enum: ['shocked', 'confused', 'curious', 'explaining', 'confident', 'sarcastic', 'dramatic', 'excited'], description: "Byte uses: shocked/confused/curious/excited. Bug uses: explaining/confident/sarcastic/dramatic." },
                action: { type: 'string', description: "Physical action the character is performing." },
                pose: { type: 'string', description: "Specific comic pose descriptor for dynamic body language. Examples: 'jumping with arms wide open', 'pointing dramatically with finger gun', 'head tilted to the side confused', 'leaning forward with confident grin', 'hands on head in shock', 'running with motion streaks', 'crashing through a wall'." }
              },
              required: ["name", "emotion", "action", "pose"]
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

  const prompt = `You are the Scene Director for the "Byte & Bug" developer Shorts channel.
Your task is to generate the visual blueprint storyboard for each dialogue turn in the script.

═══════════════════════════════════════════════════
BYTE & BUG CHARACTER ANIMATION RULES
═══════════════════════════════════════════════════

BYTE (Blue hoodie, black hair — THE CONFUSED LEARNER)
• ALWAYS looks shocked, curious, or confused
• NEVER stands still — every scene must show dynamic movement
• Pose examples: head tilted with question mark expression, hands on cheeks in shock, jumping back surprised, leaning toward Bug with curiosity, mouth wide open in disbelief

BUG (Red hoodie, bug antenna on hood — THE CONFIDENT EXPERT)
• ALWAYS energetic and expressive
• Uses big gestures, dramatic reveals, sarcastic lean-backs
• Pose examples: pointing dramatically into the camera, leaning forward with grin, arms wide open explaining, doing a mic drop, jumping up and crashing through environments

CHARACTER ANIMATION RULES (Apply to every scene):
1. Characters NEVER stand still. Every 1–2 seconds: change pose.
2. Use: head tilts, hand gestures, walking, jumping, pointing, running, looking around.
3. At least ONE "crashes through" or "zooms into" action per video (high-energy pattern interrupt).
4. Exaggerate ALL expressions. No subtle reactions — comic characters are LOUD.
5. Byte is in 40% of scenes reacting to what Bug says (shocked/confused faces are gold).
6. Bug is in 60% of scenes explaining and gesturing dramatically.

═══════════════════════════════════════════════════
VISUAL STYLE — MODERN COMIC ANIMATION (NOT PIXAR)
═══════════════════════════════════════════════════

Style: Technical 2D comic animation for software engineering education.
NOT superhero movie visuals. NOT city-swinging action. NOT Pixar. NOT realistic 3D. NOT generic AI art. NOT stock illustrations.

Required visual elements in environment descriptions:
• Strong bold outlines on technical objects: APIs, queues, databases, servers, packets, caches, terminals
• Clean flat-gradient colors from the selected style pack (no photorealistic lighting)
• Sparse halftone dot patterns in shadows, not noisy full-frame texture
• Speed lines / motion streaks for data flow, requests, failures, deploys, and latency
• Comic impact frames on technical reveals, outages, bottlenecks, or performance wins
• Architecture-diagram clarity: arrows, blocks, lanes, pipes, cylinders, server racks, dashboards with unreadable glyphs
• Bold contrast driven by the style pack palette
• Full-screen technical metaphor compositions, never floating cards or random city scenes

═══════════════════════════════════════════════════
RETENTION MOMENT RULES
═══════════════════════════════════════════════════

Every 5–8 seconds (roughly every 2-3 scenes), include ONE of:
• A surprise beat: unexpected reveal, shocking statistic shown visually
• A joke: Bug says something sarcastic, Byte reacts with exaggerated shock
• A visual reveal: camera crashes through an environment, zooms in dramatically
• A pattern interrupt: sudden close-up of a face, overhead shot, POV crash

At least ONE scene must use "close_up" + "zoom_in" to create an intense moment.
At least ONE scene must use a comedic crash/fall/explosion pose from Bug or Byte.

═══════════════════════════════════════════════════
SCRIPT TO VISUALIZE
═══════════════════════════════════════════════════

Title: ${script.title}
Hook: ${script.hook}
CTA: ${script.cta}
Dialogue Turns:
${script.dialogue.map((turn, i) => `Turn ${i + 1}: [${turn.speaker} — ${turn.emotion}] "${turn.text}" (Action: ${turn.visualAction})`).join('\n')}

RETENTION BLUEPRINT:
Storyline: ${retentionPlan.storyline}
Viral Pattern: ${retentionPlan.viralPattern}
Curiosity Loops: ${retentionPlan.curiosityLoops.join(', ')}
Reveals: ${retentionPlan.reveals.join(', ')}
Visual Metaphor: "${retentionPlan.visualMetaphor.concept}" in environment "${retentionPlan.visualMetaphor.visualWorld}"

Style Pack: ${stylePack ? JSON.stringify(stylePack) : 'vibrant_comic'}

═══════════════════════════════════════════════════
SCENE DIRECTOR RULES
═══════════════════════════════════════════════════

1. Map each dialogue turn to exactly ONE scene.
2. Environment must describe the COMIC ANIMATION style explicitly (not Pixar/3D).
3. Pacing & Camera: Shot types and motions MUST change every scene. No two consecutive scenes can share identical camera settings.
4. Dialogue verbatim: Set the dialogue field matching the turn text exactly.
5. Caption strategy:
   - 'dialogue': normal speech
   - 'fact': short punchy fact under 5 words (use for shocking reveals like "AWS CRASHED" or "47% SLOWER")
   - 'minimal': action sequences, emotional moments (2 words max)
   - 'none': pure visual impact scenes

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
