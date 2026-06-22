import { Router } from 'express';
import prisma from '../db.js';
import { runContentPipeline } from '../pipeline/runner.js';
import { runVideoRenderer } from '../pipeline/steps/6_render.js';
import type { SceneOutput } from '../pipeline/steps/3_scene_planner.js';
import { projectEvents } from '../events.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempAudioDir = path.join(__dirname, '..', '..', 'temp_audio');
const outputsDir = path.join(__dirname, '..', '..', 'outputs');

const router = Router();

// Helper to format a database project by parsing text columns containing JSON strings
function formatProjectForResponse(project: any) {
  if (!project) return null;
  return {
    ...project,
    costBreakdown: project.costBreakdown ? JSON.parse(project.costBreakdown) : null,
    retentionPlan: project.retentionPlan ? JSON.parse(project.retentionPlan) : null,
    retentionReport: project.retentionReport ? JSON.parse(project.retentionReport) : null,
    storyboard: project.storyboard ? JSON.parse(project.storyboard) : null,
    series: project.series ? {
      ...project.series,
      universe: project.series.universe ? JSON.parse(project.series.universe) : null
    } : null
  };
}

// Helper to fetch full project details and broadcast it to listeners
async function getAndBroadcastProject(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      script: true,
      scenes: {
        orderBy: { sequenceNumber: 'asc' }
      },
      series: true
    }
  });
  if (project) {
    const formatted = formatProjectForResponse(project);
    projectEvents.emit(`update:${id}`, formatted);
    return formatted;
  }
  return null;
}

// 0. Series Endpoints
router.get('/series', async (req, res) => {
  try {
    const seriesList = await prisma.series.findMany({
      orderBy: { createdAt: 'desc' }
    });
    const formatted = seriesList.map(s => ({
      ...s,
      universe: s.universe ? JSON.parse(s.universe) : null
    }));
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/series', async (req, res) => {
  const { name, characterPair, universe } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Series name is required.' });
  }

  try {
    const newSeries = await prisma.series.create({
      data: {
        name: name.trim(),
        characterPair: characterPair || 'byte_bug',
        universe: JSON.stringify(universe || {
          name: 'Byte & Bug Universe',
          premise: 'Every short is an episode from the same comic universe. Byte and Bug must be immediately recognizable. Never generate random people — only these two recurring characters.',
          characters: ['Byte', 'Bug'],
          characterBible: {
            Byte: {
              role: 'The audience surrogate — asks questions, learns things, reacts emotionally',
              appearance: 'Young human, bright blue hoodie, black messy hair, large expressive dark eyes, curious/confused expression',
              personality: 'Curious, easily confused, relatable, shocked by revelations',
              emotions: ['shocked', 'confused', 'curious', 'excited'],
              exampleLines: ['Wait... what happens if AWS crashes?', 'Seriously?!', 'But HOW does it know where to go?', 'No way...'],
              visualAction: 'Head tilts, hands on cheeks in shock, jumping back surprised, leaning toward Bug with curiosity'
            },
            Bug: {
              role: 'The tech expert and storyteller — explains concepts, makes jokes, creates chaos, shows off knowledge dramatically',
              appearance: 'Young human, vibrant red hoodie, small cute bug antenna sticking out of the hood, confident wide grin, energetic body language',
              personality: 'Confident, sarcastic, funny, dramatic, energetic',
              emotions: ['confident', 'sarcastic', 'dramatic', 'explaining'],
              exampleLines: ['Half the internet starts sweating.', 'Hahaha... not even close.', 'Oh wow, great observation.', 'Let me show you.'],
              visualAction: 'Pointing dramatically, leaning forward with grin, arms wide open explaining, doing a mic drop, jumping into frame from offscreen'
            }
          },
          storyStructure: {
            rule: 'Every video is a CONVERSATION, not a lecture',
            badExample: 'Narrator explains AWS.',
            goodExample: 'Byte: "Wait... what happens if AWS crashes?" Bug: "Half the internet starts sweating." Byte: "Seriously?" Bug: "Let me show you."',
            arc: ['Hook (Bug shocks OR Byte asks)', 'Byte questions', 'Bug escalates with chaos', 'Byte deeper confusion', 'Bug reveals dramatically', 'Byte shocked/awed', 'CTA']
          },
          visualStyle: 'technical_2d_comic_animation',
          visualStyleDetails: 'Developer-focused technical comic aesthetic. Strong bold outlines, clean flat gradients, architecture-diagram shapes, terminal/code-inspired surfaces without readable text, APIs, queues, databases, servers, data packets, sparse halftone shadows, and motion streaks for data flow. NOT superhero movie visuals, NOT Pixar 3D, NOT photorealistic, NOT generic AI art.',
          animationRules: [
            'Characters NEVER stand still — change pose every 1-2 seconds',
            'Use: head tilts, hand gestures, walking, jumping, pointing, running, looking around',
            'At least one crash-through or zoom-into action per video',
            'Exaggerate ALL expressions — comic characters are LOUD',
            'Byte emotions: shocked/confused/curious. Bug emotions: confident/sarcastic/dramatic'
          ],
          retentionRules: [
            'Every 5-8 seconds: surprise beat, joke, or visual reveal',
            'Bug must be sarcastic at least twice per video',
            'Byte must express shock with short outbursts at least twice per video',
            'Important tech words (AWS, CRASHED, BILLIONS, INTERNET) dominate captions',
            'Hook must grab attention within 3 seconds — no build-up'
          ],
          continuityLevel: 'strict'
        })
      }
    });
    res.status(201).json({
      ...newSeries,
      universe: JSON.parse(newSeries.universe)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Suggest Topics — calls Gemini to generate high-retention Byte & Bug topic ideas
router.get('/suggest-topics', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No LLM API key configured.' });
  }

  const { generateContentWithRetry } = await import('../pipeline/gemini.js');

  const schema: any = {
    type: 'object',
    properties: {
      topics: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            topic:       { type: 'string', description: 'Short topic title, e.g. "How Kafka Actually Works"' },
            hook:        { type: 'string', description: 'The 1-line hook Byte or Bug would say to open the video. Max 12 words.' },
            category:    { type: 'string', enum: ['networking', 'databases', 'distributed-systems', 'cloud', 'ai-ml', 'devops', 'security', 'web', 'os', 'algorithms'] },
            viralPattern:{ type: 'string', enum: ['myth_busting', 'hidden_truth', 'battle', 'race', 'countdown', 'unexpected_twist', 'survival_story', 'mystery_box'] },
            retentionScore: { type: 'number', description: 'Predicted 15-second retention % (0-100)' }
          },
          required: ['topic', 'hook', 'category', 'viralPattern', 'retentionScore']
        }
      }
    },
    required: ['topics']
  };

  const prompt = `You are the creative director for the "Byte & Bug" developer Shorts channel.
Byte (blue hoodie, confused learner) and Bug (red hoodie, sarcastic expert) explore tech concepts together in chaotic comic adventures.

Generate exactly 6 HIGH-RETENTION short video topic ideas for software developers aged 22-35.

Each topic must:
1. Be immediately intriguing — a developer scrolling at 2am stops for this
2. Have a shocking/surprising hook that makes you say "wait, really?"
3. Map to a clear viral pattern (myth busting, hidden truth, battle, unexpected twist, etc.)
4. Be specific — not "how databases work" but "Why your Postgres query is 200x slower at night"
5. Feel like it could go viral on TikTok or Instagram Reels for devs

Topics should span different categories. Mix:
- Counter-intuitive discoveries ("The thing nobody tells you about X")
- Scary production moments ("What happens when Y fails")  
- Speed/performance battles ("X vs Y — and the winner shocks everyone")
- Hidden mechanisms ("The secret inside X that changes everything")
- Dramatic "oh no" moments that devs fear

Return strictly as JSON matching the schema. Vary the categories. Make every hook punchy.`;

  try {
    const result = await generateContentWithRetry(apiKey, 'gemini-2.5-flash', prompt, schema);
    const parsed = JSON.parse(result.text);
    res.json(parsed.topics);
  } catch (err: any) {
    console.error('[SuggestTopics] Failed:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate topic suggestions.' });
  }
});

// 1. Get all projects
router.get('/', async (req, res) => {

  try {
    const projects = await prisma.project.findMany({
      include: { script: true, series: true },
      orderBy: { createdAt: 'desc' }
    });
    const formatted = projects.map(p => formatProjectForResponse(p));
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Create a new project & kick off pipeline
router.post('/', async (req, res) => {
  const { topic, seriesId } = req.body;
  if (!topic || topic.trim() === '') {
    return res.status(400).json({ error: 'Topic is required.' });
  }

  try {
    // Resolve character pair and series details
    let characterPair = 'byte_bug';
    if (seriesId) {
      const seriesObj = await prisma.series.findUnique({ where: { id: seriesId } });
      if (seriesObj) {
        characterPair = seriesObj.characterPair;
      }
    }

    const project = await prisma.project.create({
      data: {
        topic: topic.trim(),
        seriesId: seriesId || null,
        characterPair,
        status: 'GENERATING_SCRIPT',
        currentStage: 'research'
      },
      include: {
        series: true
      }
    });

    // Run pipeline asynchronously in background
    runContentPipeline(project.id, topic.trim(), seriesId || undefined);

    res.status(201).json(formatProjectForResponse(project));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Real-time Event Stream (SSE) for a specific project
router.get('/:id/stream', async (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendUpdate = (projectData: any) => {
    res.write(`data: ${JSON.stringify(projectData)}\n\n`);
  };

  // 1. Send the initial current status of the project immediately
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      script: true,
      scenes: {
        orderBy: { sequenceNumber: 'asc' }
      },
      series: true
    }
  });

  if (project) {
    sendUpdate(formatProjectForResponse(project));
  }

  // 2. Listen to real-time events for this project
  const eventName = `update:${id}`;
  projectEvents.on(eventName, sendUpdate);

  // 3. Clean up listener when client closes the connection
  req.on('close', () => {
    projectEvents.off(eventName, sendUpdate);
  });
});

// 3. Get project details (fallback for full static fetch)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        script: true,
        scenes: {
          orderBy: { sequenceNumber: 'asc' }
        },
        series: true
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.json(formatProjectForResponse(project));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Retry/Resume project generation pipeline
router.post('/:id/retry', async (req, res) => {
  const { id } = req.params;
  try {
    const project = await prisma.project.findUnique({
      where: { id }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Update status to clear error and signal start
    await prisma.project.update({
      where: { id },
      data: { status: 'GENERATING_SCRIPT', error: null }
    });
    await getAndBroadcastProject(id);

    // Trigger pipeline in background (will dynamically resume from checkpoint)
    runContentPipeline(id, project.topic);

    res.json({ message: 'Generation pipeline resumed in background.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update script and regenerate scenes/audio
router.put('/:id/script', async (req, res) => {
  const { id } = req.params;
  const { title, youtubeTitle, youtubeDescription, hook, body, cta, duration } = req.body;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { scenes: true }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // 1. Clean up old scene audio files
    for (const scene of project.scenes) {
      if (scene.audioPath && fs.existsSync(scene.audioPath)) {
        try {
          fs.unlinkSync(scene.audioPath);
        } catch (e) {
          console.error(`Failed to delete scene audio: ${scene.audioPath}`, e);
        }
      }
    }

    // 2. Clear old scenes database records
    await prisma.scene.deleteMany({
      where: { projectId: id }
    });

    // 3. Update project script and status
    await prisma.script.update({
      where: { projectId: id },
      data: {
        title,
        youtubeTitle: youtubeTitle || title,
        youtubeDescription: youtubeDescription || `${hook}\n\n${cta}`,
        hook,
        body,
        cta,
        duration
      }
    });

    await prisma.project.update({
      where: { id },
      data: { status: 'GENERATING_SCENES', error: null }
    });

    // Broadcast current transition
    await getAndBroadcastProject(id);

    // 4. Trigger scene planning & TTS generation in background
    const provider = process.env.LLM_PROVIDER?.trim().toLowerCase();
    const apiKey = provider === 'openai'
      ? process.env.OPENAI_API_KEY!
      : provider === 'deepseek'
        ? process.env.DEEPSEEK_API_KEY!
        : (process.env.GEMINI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY)!;
    
    // Asynchronous runner
    (async () => {
      try {
        // Parse retentionPlan and topic from current project
        let retentionPlan: any = null;
        if (project.retentionPlan) {
          try {
            retentionPlan = JSON.parse(project.retentionPlan);
          } catch (e) {
            console.error('Failed to parse retentionPlan:', e);
          }
        }

        // Parse human script body text into structured DialogueTurn[]
        const dialogueTurns = body.split('\n').map((line: string) => {
          const clean = line.trim();
          if (clean.startsWith('Bug:')) {
            return { speaker: 'Bug', text: clean.substring(4).trim(), emotion: 'curious', visualAction: '' };
          } else if (clean.startsWith('Byte:')) {
            return { speaker: 'Byte', text: clean.substring(5).trim(), emotion: 'explaining', visualAction: '' };
          } else {
            return { speaker: 'Byte', text: clean, emotion: 'explaining', visualAction: '' };
          }
        });

        const scriptResult = {
          title,
          youtubeTitle: youtubeTitle || title,
          youtubeDescription: youtubeDescription || `${hook}\n\n${cta}`,
          hook,
          dialogue: dialogueTurns,
          cta,
          duration
        };

        const { runScenePlanner } = await import('../pipeline/steps/3_scene_planner.js');
        const { runImageGenerator } = await import('../pipeline/steps/2.5_image_generator.js');
        const { runRetentionAudit } = await import('../pipeline/steps/5_scorer.js');
        const { generateEdgeTTS } = await import('../pipeline/steps/4_audio_tts.js');
        const { selectStylePack, STYLE_PACKS } = await import('../pipeline/style_packs.js');

        const stylePackId = selectStylePack(project.topic);
        const stylePack = STYLE_PACKS[stylePackId];

        console.log(`[Project ${id}] Regenerating scenes for manually updated script...`);
        const plannerStep = await runScenePlanner(scriptResult, apiKey, retentionPlan, stylePack);
        const sceneResult = plannerStep.planner;

        // Generate Pluggable Visual Scene Assets
        let resolvedScenes: SceneOutput[] = [];
        for (const scene of sceneResult.scenes) {
          const storyState = {
            beat: scene.storyBeat,
            speaker: scene.speaker,
            dialogue: scene.dialogue
          };
          const renderState = {
            characters: scene.characters,
            environment: scene.environment,
            camera: scene.camera,
            imageUrl: ''
          };

          if (scene.template !== 'visual-story') {
            resolvedScenes.push({
              ...scene,
              storyState,
              renderState
            });
            continue;
          }

          const imgResult = await runImageGenerator(
            {
              projectId: id,
              sceneNumber: scene.sceneNumber,
              storyBeat: scene.storyBeat,
              template: scene.template,
              environment: scene.environment,
              characters: scene.characters,
              camera: scene.camera,
              speaker: scene.speaker,
              dialogue: scene.dialogue,
              templateProps: scene.templateProps,
              stylePack
            },
            apiKey,
            outputsDir
          );
          
          resolvedScenes.push({
            ...scene,
            storyState,
            renderState: {
              ...renderState,
              imageUrl: imgResult.imageUrl
            }
          });
        }

        // Run Auditor Audit
        const scoreStep = await runRetentionAudit(scriptResult, resolvedScenes, retentionPlan, apiKey);
        const auditReport = scoreStep.auditor;

        // Update Project storyboard, score and audit report
        await prisma.project.update({
          where: { id },
          data: {
            storyboard: JSON.stringify({ scenes: resolvedScenes }),
            retentionScore: auditReport.retentionScore,
            retentionReport: JSON.stringify(auditReport)
          }
        });

        // Clear old scenes database records first to avoid duplicates on edits
        await prisma.scene.deleteMany({
          where: { projectId: id }
        });

        // Persist scenes to database
        for (const scene of resolvedScenes) {
          await prisma.scene.create({
            data: {
              projectId: id,
              sequenceNumber: scene.sceneNumber,
              text: `${scene.storyState!.speaker}: ${scene.storyState!.dialogue}`,
              template: scene.template,
              templateData: JSON.stringify({
                ...scene.renderState!,
                captionStyle: scene.captionStyle || 'dialogue',
                storyState: scene.storyState!
              })
            }
          });
        }

        // Update to audio status & broadcast
        await prisma.project.update({ where: { id }, data: { status: 'GENERATING_AUDIO' } });
        await getAndBroadcastProject(id);
        
        console.log(`[Project ${id}] Regenerating TTS audio clips...`);
        const currentScenes = await prisma.scene.findMany({
          where: { projectId: id },
          orderBy: { sequenceNumber: 'asc' }
        });

        for (const scene of currentScenes) {
          const audioFilename = `${id}_scene_${scene.sequenceNumber}.mp3`;
          const sceneAudioPath = path.join(tempAudioDir, audioFilename);
          
          const sceneData = JSON.parse(scene.templateData);
          const speakerName = sceneData.storyState?.speaker || 'Byte';
          const voice = speakerName === 'Bug' ? 'en-US-EmmaNeural' : 'en-US-AndrewNeural';

          // Extract actual dialogue text to prevent voice synthesis from reading character prefix name
          const dialogueText = (sceneData.storyState?.dialogue || scene.text || '').replace(/^(Byte|Bug):\s*/i, '');
          console.log(`Generating speech for ${speakerName} in scene ${scene.sequenceNumber}: "${dialogueText}"`);
          const ttsResult = await generateEdgeTTS(dialogueText, sceneAudioPath, voice);

          await prisma.scene.update({
            where: { id: scene.id },
            data: {
              audioPath: ttsResult.audioPath,
              duration: ttsResult.duration,
              wordTimings: JSON.stringify(ttsResult.wordTimings)
            }
          });
        }

        await prisma.project.update({ where: { id }, data: { status: 'DRAFT' } });
        await getAndBroadcastProject(id);
        console.log(`[Project ${id}] Scene regeneration complete.`);
      } catch (err: any) {
        console.error(`[Project ${id}] Failed to regenerate scenes:`, err);
        await prisma.project.update({
          where: { id },
          data: { status: 'FAILED', error: err.message || 'Failed to regenerate scenes' }
        });
        await getAndBroadcastProject(id);
      }
    })();

    res.json({ message: 'Script updated. Regenerating scenes and voiceover in background.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Trigger video rendering via Remotion
router.post('/:id/render', async (req, res) => {
  const { id } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        scenes: {
          orderBy: { sequenceNumber: 'asc' }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.scenes.length === 0) {
      return res.status(400).json({ error: 'Project has no scenes to render.' });
    }

    // Update project state to RENDERING & broadcast
    await prisma.project.update({
      where: { id },
      data: { status: 'RENDERING', error: null }
    });
    await getAndBroadcastProject(id);

    // Run Remotion rendering CLI in background
    (async () => {
      try {
        console.log(`[Project ${id}] Triggering Remotion video render...`);
        const outputVideoPath = await runVideoRenderer(id, project.scenes);

        // Update project to COMPLETED & broadcast
        await prisma.project.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            videoPath: `/outputs/${id}.mp4`,
            updatedAt: new Date()
          }
        });
        await getAndBroadcastProject(id);
        console.log(`[Project ${id}] Remotion rendering completed! Saved to ${outputVideoPath}`);
      } catch (err: any) {
        console.error(`[Project ${id}] Remotion rendering failed:`, err);
        await prisma.project.update({
          where: { id },
          data: {
            status: 'FAILED',
            error: err.message || 'Remotion rendering failed',
            updatedAt: new Date()
          }
        });
        await getAndBroadcastProject(id);
      }
    })();

    res.json({ message: 'Render started in background.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Delete project and cleanup files
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { scenes: true }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // 1. Delete scene audio files
    for (const scene of project.scenes) {
      if (scene.audioPath && fs.existsSync(scene.audioPath)) {
        try {
          fs.unlinkSync(scene.audioPath);
        } catch (e) {
          console.error(`Failed to delete scene audio: ${scene.audioPath}`, e);
        }
      }
    }

    // 2. Delete rendered video file
    const videoFilePath = path.join(outputsDir, `${id}.mp4`);
    if (fs.existsSync(videoFilePath)) {
      try {
        fs.unlinkSync(videoFilePath);
      } catch (e) {
        console.error(`Failed to delete output video: ${videoFilePath}`, e);
      }
    }

    // 3. Delete database record
    await prisma.project.delete({
      where: { id }
    });

    res.json({ message: 'Project and all local files deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
