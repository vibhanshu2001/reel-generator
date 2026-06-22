// Schemas typed as 'any' to bypass typing bugs in the @google/generative-ai SDK (v0.13.0) 
// where nested schemas are incorrectly typed as requiring 'properties' even for non-object types.

// Schema for Script Generation step
export const scriptSchema: any = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    hook: { type: 'string', description: "Immediate first-second hook for developers. Must state the pain/result up front, e.g. 'This Node.js mistake can make your API 10x slower.' No build-up." },
    body: { type: 'string', description: "Core explanation of the technical concept. Direct, punchy, high-information density." },
    cta: { type: 'string', description: "Short developer-focused closing call to action. Max 5-7 words." },
    duration: { type: 'number', description: "Estimated spoken duration in seconds. Should target 30-40 seconds." }
  },
  required: ["title", "hook", "body", "cta", "duration"]
};

// Schema for Scene Planner step
export const scenePlannerSchema: any = {
  type: 'object',
  properties: {
    scenes: {
      type: 'array',
      description: "List of scenes. MUST produce between 6 and 12 scenes. Each scene covers 2 to 3.5 seconds of narration.",
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          text: { type: 'string', maxLength: 120, description: "Narration text for this scene (1-2 short sentences, max 15 words)." },
          template: { 
            type: 'string', 
            description: "The name of the visual template component to use.",
            enum: ["architecture-diagram", "code-card", "comparison-card", "terminal-simulation", "stat-card", "timeline-card"] 
          },
          templateData: {
            type: 'object',
            description: "Attributes parsed by the selected template React component. Must match the specified template structure and include v2.1 attention/style metadata.",
            properties: {
              attentionBeatId: {
                type: 'string',
                description: "ID of the attention beat this scene pays off, e.g. beat-1."
              },
              stylePack: {
                type: 'string',
                description: "Selected style pack for this scene.",
                enum: ["terminal", "cyberpunk", "infographic", "minimal"]
              },
              assets: {
                type: 'array',
                description: "AssetUniverse IDs used by this scene.",
                items: { type: 'string' }
              },
              reactionTag: {
                type: 'string',
                description: "Optional GIPHY sticker reaction tag for maximum 2 scenes (hook reveal or payoff only). Choose one of: 'mind blown', 'this is fine', 'wait what', 'no way', 'sheesh', 'lets go', 'crying', 'fire'. Leave empty for most scenes."
              },
              metaphor: {
                type: 'object',
                description: "Selected visual metaphor mapping for the concept.",
                properties: {
                  concept: { type: 'string' },
                  visualWorld: { type: 'string' },
                  mapping: {
                    type: 'object',
                    properties: {}
                  }
                }
              },
              // Code Card template fields
              language: { type: 'string', description: "Programming language for code-card: e.g. typescript, javascript, python, rust, go, bash" },
              code: { type: 'string', description: "Short code snippet to display inside code-card. Prefer 3-6 lines so the renderer can zoom aggressively." },
              highlightLines: { 
                type: 'array', 
                description: "Array of 1-indexed line numbers to highlight inside code-card",
                items: { type: 'number' } 
              },
              badLines: {
                type: 'array',
                description: "Optional 1-indexed lines that should pulse red because they show the mistake.",
                items: { type: 'number' }
              },
              goodLines: {
                type: 'array',
                description: "Optional 1-indexed lines that should pulse green because they show the fix.",
                items: { type: 'number' }
              },
              environment: {
                type: 'string',
                description: "Optional visual environment override for any template.",
                enum: ["neon", "terminal", "architecture", "benchmark", "editor", "counter"]
              },
              
              // Comparison Card and Architecture Diagram fields
              title: { type: 'string', description: "Title of the card (used in comparison-card, architecture-diagram, timeline-card)" },
              
              // Comparison Card specific fields
              headers: { 
                type: 'array', 
                description: "Headers for the comparison-card table, e.g. ['Feature', 'Postgres', 'Redis']",
                items: { type: 'string' } 
              },
              rows: { 
                type: 'array', 
                description: "Rows of the comparison-card table, e.g. [['Speed', '40ms', '0.2ms'], ['RAM', 'No', 'Yes']]",
                items: { 
                  type: 'array', 
                  items: { type: 'string' } 
                } 
              },
              
              // Terminal Simulation specific fields
              command: { type: 'string', maxLength: 80, description: "Command typed inside terminal-simulation, e.g. 'redis-cli GET user:100'" },
              output: { type: 'string', maxLength: 200, description: "Simulated output shown in terminal-simulation, e.g. '\"Alice\"'" },
              
              // Stat Card / Counter specific fields
              value: { type: 'string', maxLength: 12, description: "NUMERIC metric ONLY. e.g. '0.2ms' or '200x' or '99.9%' or '80%'. Max 12 characters. No words, no sentences, no emojis." },
              label: { type: 'string', maxLength: 40, description: "Main stat label, e.g. 'Redis Speed' or 'Database Slowdown'" },
              subtext: { type: 'string', maxLength: 80, description: "Sub-information text, e.g. 'Average response time' or 'Compared to SQL'" },
              trend: { type: 'string', maxLength: 30, description: "Badge info, e.g. '+200% faster' or '99.9% SLA'" },
              counterSteps: {
                type: 'array',
                description: "Optional numeric burst sequence for stat-card wow moments, e.g. [1,20,100,500,1000,2000,5000].",
                items: { type: 'number' }
              },
              
              // Timeline Card specific steps
              steps: { 
                type: 'array', 
                description: "Timeline steps, e.g. ['Step 1: Cache Miss', 'Step 2: Fetch SQL', 'Step 3: Save Cache']",
                items: { type: 'string' } 
              },
              
              // Architecture Diagram specific fields
              nodes: {
                type: 'array',
                description: "List of nodes to render. Keep nodes between 2 and 4. Position on 100x100 grid (x: 10-90, y: 15-85).",
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: "Unique node ID" },
                    label: { type: 'string', description: "Display name of the node, e.g. 'Client', 'Redis Cache', 'Postgres DB'" },
                    x: { type: 'number', description: "X coordinate (10 to 90)" },
                    y: { type: 'number', description: "Y coordinate (15 to 85)" },
                    highlight: { type: 'boolean', description: "Set true to highlight this node (e.g. active system)" }
                  },
                  required: ["id", "label", "x", "y"]
                }
              },
              edges: {
                type: 'array',
                description: "List of directional paths connecting nodes.",
                items: {
                  type: 'object',
                  properties: {
                    from: { type: 'string', description: "Source node ID" },
                    to: { type: 'string', description: "Destination node ID" },
                    animated: { type: 'boolean', description: "Set true to show moving data packets on this edge" }
                  },
                  required: ["from", "to"]
                }
              }
            }
          }
        },
        required: ["id", "text", "template", "templateData"]
      }
    }
  },
  required: ["scenes"]
};

// Schema for Quality Scorer
export const scorerSchema: any = {
  type: 'object',
  properties: {
    score: { type: 'number', description: "A score from 0 to 100 assessing the overall script and scene plan." },
    hookStrength: { type: 'number', description: "Score from 0 to 20 rating if it hooks developers within the first 2 seconds." },
    clarity: { type: 'number', description: "Score from 0 to 20 rating the flow and clarity of explanations." },
    visualDensity: { type: 'number', description: "Score from 0 to 20 rating the variety and fitness of visual templates selected." },
    technicalAccuracy: { type: 'number', description: "Score from 0 to 20 checking if technical terms, schemas, and code are correct." },
    retentionPotential: { type: 'number', description: "Score from 0 to 20 evaluating general pacing and readability." },
    feedback: { type: 'string', description: "Constructive feedback outlining weak points, errors, or suggestions for self-correction." }
  },
  required: ["score", "hookStrength", "clarity", "visualDensity", "technicalAccuracy", "retentionPotential", "feedback"]
};

// Schema for the v2.1 attention-first director step.
export const attentionPlanSchema: any = {
  type: 'object',
  properties: {
    version: { type: 'number' },
    hook: {
      type: 'object',
      properties: {
        claim: { type: 'string' },
        curiosityGap: { type: 'string' },
        visibleByFrame: { type: 'number' }
      },
      required: ["claim", "curiosityGap", "visibleByFrame"]
    },
    beats: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: "Stable beat ID such as beat-1." },
          role: {
            type: 'string',
            enum: ["shock", "problem", "escalation", "reveal", "proof", "payoff", "cta"]
          },
          viewerQuestion: { type: 'string' },
          surprise: { type: 'string' },
          patternInterrupt: {
            type: 'string',
            enum: ["zoom", "silence", "counter", "visual_swap", "code_reveal", "sound_hit"]
          }
        },
        required: ["id", "role", "viewerQuestion", "surprise", "patternInterrupt"]
      }
    },
    payoff: {
      type: 'object',
      properties: {
        promise: { type: 'string' },
        deliveredByScene: { type: 'number' }
      },
      required: ["promise", "deliveredByScene"]
    },
    scoringTargets: {
      type: 'object',
      properties: {
        minHookStrength: { type: 'number' },
        minCuriosityGap: { type: 'number' },
        minPatternInterrupts: { type: 'number' },
        minPayoffQuality: { type: 'number' }
      },
      required: ["minHookStrength", "minCuriosityGap", "minPatternInterrupts", "minPayoffQuality"]
    }
  },
  required: ["version", "hook", "beats", "payoff", "scoringTargets"]
};
