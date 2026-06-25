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

async function autoGenerateInformativeTopic(apiKey: string): Promise<string> {
  const { generateContentWithRetry } = await import('../pipeline/gemini.js');
  const prompt = `Generate a single, highly intriguing, curiosity-driven, general-interest (non-technical) topic for an informative reel.
It should be a fascinating question about science, history, daily life, nature, or space.
Examples: "Why do airplane windows have a tiny hole?", "Why does the vaccine leave a scar on our arms?", "Why do cats purr?".
Return ONLY the topic text, nothing else. Do not use quotes or markdown.`;

  try {
    const result = await generateContentWithRetry(apiKey, 'gemini-2.5-flash', prompt);
    return result.text.trim().replace(/^["']|["']$/g, '');
  } catch (err) {
    console.error('[AutoGenerateTopic] Failed:', err);
    // Return a default interesting topic as backup
    const backups = [
      "Why do airplane windows have tiny holes?",
      "Why do mirrors invert left-to-right but not up-to-down?",
      "Why did childhood vaccines leave circular marks?",
      "Why do cats purr?",
      "What actually happens to our brain when we sleep?",
      "Why is the ocean blue?"
    ];
    return backups[Math.floor(Math.random() * backups.length)];
  }
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

// Suggest Topics — calls Gemini/LLM to generate topic ideas based on type (byte_bug or informative)
router.get('/suggest-topics', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'No LLM API key configured.' });
  }

  const { generateContentWithRetry } = await import('../pipeline/gemini.js');
  const type = req.query.type || 'byte_bug';

  const schema: any = type === 'informative'
    ? {
        type: 'object',
        properties: {
          topics: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topic:       { type: 'string', description: 'Intriguing, curiosity-driven topic. E.g. "Why do airplane windows have a tiny hole?" or "The mystery of the vaccine marks"' },
                hook:        { type: 'string', description: 'The hook question/statement that will display at the top of the video. E.g. "Why is there a tiny hole in airplane windows?"' },
                category:    { type: 'string', enum: ['history', 'science', 'nature', 'space', 'health', 'daily-life', 'earth', 'technology'] },
                viralPattern:{ type: 'string', enum: ['hidden_truth', 'unexpected_twist', 'mystery_box', 'myth_busting'] },
                retentionScore: { type: 'number', description: 'Predicted 15-second retention % (0-100)' }
              },
              required: ['topic', 'hook', 'category', 'viralPattern', 'retentionScore']
            }
          }
        },
        required: ['topics']
      }
    : {
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

  const prompt = type === 'informative'
    ? `You are the creative director for an "Informative Spotlight" Shorts channel.
Generate exactly 6 HIGH-RETENTION, general-interest short video topic ideas (curiosity-driven, non-technical).

Each topic must:
1. Appeal to a broad audience (not technical or developer-specific). Think general science, historical trivia, daily life mysteries, or nature anomalies.
2. Have a highly intriguing hook question/statement that makes a user stop scrolling immediately (max 15 words).
3. Map to a clear viral pattern (myth busting, hidden truth, unexpected twist, mystery box).
4. Be concrete and interesting (e.g., "Why mirrors invert horizontally but not vertically", "Why do airplane windows have tiny holes?", "Why did vaccines we got as kids leave marks?").
5. Feel like it could go viral on TikTok or Instagram Reels.

Return strictly as JSON matching the schema. Vary the categories.`
    : `You are the creative director for the "Byte & Bug" developer Shorts channel.
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
  let { topic, seriesId, voiceAccent, characterPair: reqCharacterPair, backgroundMusic } = req.body;

  // Resolve character pair and series details
  let characterPair = reqCharacterPair || 'byte_bug';
  let storyline = 'explainer';

  if (seriesId) {
    const seriesObj = await prisma.series.findUnique({ where: { id: seriesId } });
    if (seriesObj) {
      characterPair = seriesObj.characterPair;
      if (characterPair === 'informative') {
        try {
          const univ = JSON.parse(seriesObj.universe);
          storyline = univ.backgroundMusic || 'lacrimosa';
        } catch {
          storyline = 'lacrimosa';
        }
      }
    }
  }

  if (characterPair === 'informative' && backgroundMusic) {
    storyline = backgroundMusic;
  }

  // Handle AUTO_CHOOSE or missing topic for informative style
  const isAutoChoose = !topic || topic.trim() === '' || topic.trim() === 'AUTO_CHOOSE';
  if (isAutoChoose) {
    if (characterPair === 'informative') {
      const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'No LLM API key configured for auto-choosing topic.' });
      }
      console.log('🤖 Auto-choosing topic for informative reel...');
      topic = await autoGenerateInformativeTopic(apiKey);
      console.log(`🤖 Auto-chosen topic: "${topic}"`);
    } else {
      return res.status(400).json({ error: 'Topic is required for Byte & Bug explainer reels.' });
    }
  }

  try {
    // Resolve character pair and series details
    let characterPair = reqCharacterPair || 'byte_bug';
    let storyline = 'explainer';

    if (seriesId) {
      const seriesObj = await prisma.series.findUnique({ where: { id: seriesId } });
      if (seriesObj) {
        characterPair = seriesObj.characterPair;
        if (characterPair === 'informative') {
          try {
            const univ = JSON.parse(seriesObj.universe);
            storyline = univ.backgroundMusic || 'lacrimosa';
          } catch {
            storyline = 'lacrimosa';
          }
        }
      }
    }

    if (characterPair === 'informative' && backgroundMusic) {
      storyline = backgroundMusic;
    }

    const project = await prisma.project.create({
      data: {
        topic: topic.trim(),
        seriesId: seriesId || null,
        characterPair,
        storyline,
        voiceAccent: voiceAccent || 'en-IN',
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

        // Merge the intro title card properties into the first scene of the storyboard
        if (sceneResult.scenes.length > 0) {
          const firstScene = sceneResult.scenes[0];
          
          const bytePoses = [
            { emotion: 'excited', action: 'gesturing towards the center', pose: 'pointing with a big smile' },
            { emotion: 'shocked', action: 'looking at the screen in awe', pose: 'hands on cheeks in amazement' },
            { emotion: 'excited', action: 'jumping in excitement', pose: 'jumping with arms wide open' }
          ];

          const bugPoses = [
            { emotion: 'confident', action: 'pointing to the center', pose: 'leaning forward confidently with a grin' },
            { emotion: 'dramatic', action: 'revealing the scene', pose: 'pointing dramatically into the camera' },
            { emotion: 'excited', action: 'welcoming the viewer', pose: 'gesturing with a confident smirk' }
          ];

          const poseIndex = id.split('-').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 3;
          const bytePose = bytePoses[poseIndex];
          const bugPose = bugPoses[poseIndex];

          firstScene.templateProps = {
            ...firstScene.templateProps,
            isIntro: true,
            title: scriptResult.youtubeTitle || scriptResult.title
          };

          // Set environment description for the image generator
          firstScene.environment = {
            name: `Intro: ${retentionPlan.visualMetaphor.concept || 'Concept'}`,
            description: `Vibrant action-packed comic scene set in: ${retentionPlan.visualMetaphor.visualWorld}. High-energy speed lines, clean flat gradients, bold contrast outlines. Byte and Bug are standing in this environment looking excited and energetic, gesturing towards the center of the screen where a big title will be displayed.`
          };

          // Ensure both Byte and Bug are present in the characters array for the intro visual
          firstScene.characters = [
            {
              name: 'Byte',
              ...bytePose
            },
            {
              name: 'Bug',
              ...bugPose
            }
          ];

          // Set camera settings for the intro scene
          firstScene.camera = {
            shot: 'medium',
            motion: 'zoom_in'
          };
          
          // Hook scene should always be visual-story template to render the title card background
          firstScene.template = 'visual-story';
        }

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
                storyState: scene.storyState!,
                ...scene.templateProps,
                stylePack: stylePack.id
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

        const projectObj = await prisma.project.findUnique({ where: { id } });
        const voiceAccent = projectObj?.voiceAccent || 'en-IN';

        for (const scene of currentScenes) {
          const audioFilename = `${id}_scene_${scene.sequenceNumber}.mp3`;
          const sceneAudioPath = path.join(tempAudioDir, audioFilename);
          
          const sceneData = JSON.parse(scene.templateData);
          const speakerName = sceneData.storyState?.speaker || 'Byte';
          
          let voice = speakerName === 'Bug' ? 'en-IN-PrabhatNeural' : 'en-IN-NeerjaNeural';
          if (voiceAccent === 'en-US') {
            voice = speakerName === 'Bug' ? 'en-US-AndrewNeural' : 'en-US-EmmaNeural';
          }

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

// POST /:id/accent - Toggle voice accent and regenerate audio files without regenerating scenes
router.post('/:id/accent', async (req, res) => {
  const { id } = req.params;
  const { voiceAccent } = req.body;

  if (!voiceAccent || !['en-IN', 'en-US'].includes(voiceAccent)) {
    return res.status(400).json({ error: 'Valid voiceAccent is required ("en-IN" or "en-US").' });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { scenes: true }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // 1. Update project accent and status, set videoPath to null (MP4 is now invalid)
    await prisma.project.update({
      where: { id },
      data: {
        voiceAccent,
        status: 'GENERATING_AUDIO',
        videoPath: null,
        error: null
      }
    });
    await getAndBroadcastProject(id);

    // Run audio regeneration in background
    (async () => {
      try {
        console.log(`[Project ${id}] Regenerating TTS audio for accent change to ${voiceAccent}...`);
        
        // 2. Clean up old scene audio files on disk
        for (const scene of project.scenes) {
          if (scene.audioPath && fs.existsSync(scene.audioPath)) {
            try {
              fs.unlinkSync(scene.audioPath);
            } catch (e) {
              console.error(`Failed to delete scene audio: ${scene.audioPath}`, e);
            }
          }
        }

        // 3. Fetch scenes in order
        const currentScenes = await prisma.scene.findMany({
          where: { projectId: id },
          orderBy: { sequenceNumber: 'asc' }
        });

        const { generateEdgeTTS } = await import('../pipeline/steps/4_audio_tts.js');

        for (const scene of currentScenes) {
          const audioFilename = `${id}_scene_${scene.sequenceNumber}.mp3`;
          const sceneAudioPath = path.join(tempAudioDir, audioFilename);
          
          const sceneData = JSON.parse(scene.templateData);
          const speakerName = sceneData.storyState?.speaker || 'Byte';
          const emotion = (sceneData.characters?.[0]?.emotion || 'neutral').toLowerCase();

          // Set voice
          let voice = speakerName === 'Bug' ? 'en-IN-PrabhatNeural' : 'en-IN-NeerjaNeural';
          if (voiceAccent === 'en-US') {
            voice = speakerName === 'Bug' ? 'en-US-AndrewNeural' : 'en-US-EmmaNeural';
          }

          // Emotion-aware SSML prosody for expression matching (mirrors runner.ts)
          let prosodyRate = '+0%';
          let prosodyPitch = '+0Hz';
          let prosodyVolume = '+10%';

          if (speakerName === 'Byte') {
            if (emotion === 'shocked' || emotion === 'surprised') {
              prosodyRate = '+18%'; prosodyPitch = '+4Hz'; prosodyVolume = '+15%';
            } else if (emotion === 'confused') {
              prosodyRate = '-8%'; prosodyPitch = '+2Hz'; prosodyVolume = '+10%';
            } else if (emotion === 'excited' || emotion === 'curious') {
              prosodyRate = '+12%'; prosodyPitch = '+3Hz'; prosodyVolume = '+12%';
            }
          } else {
            if (emotion === 'sarcastic') {
              prosodyRate = '-10%'; prosodyPitch = '-2Hz'; prosodyVolume = '+10%';
            } else if (emotion === 'dramatic') {
              prosodyRate = '-5%'; prosodyPitch = '-1Hz'; prosodyVolume = '+15%';
            } else if (emotion === 'confident' || emotion === 'explaining') {
              prosodyRate = '+5%'; prosodyPitch = '+0Hz'; prosodyVolume = '+12%';
            } else if (emotion === 'excited') {
              prosodyRate = '+15%'; prosodyPitch = '+2Hz'; prosodyVolume = '+15%';
            }
          }

          const dialogueText = (sceneData.storyState?.dialogue || scene.text || '').replace(/^(Byte|Bug):\s*/i, '');
          console.log(`🎙 [Accent Update TTS] ${speakerName} (${voice} | ${emotion}) Scene ${scene.sequenceNumber}: "${dialogueText.slice(0, 60)}..."`);
          
          const ttsResult = await generateEdgeTTS(dialogueText, sceneAudioPath, voice, prosodyRate, prosodyPitch, prosodyVolume);

          await prisma.scene.update({
            where: { id: scene.id },
            data: {
              audioPath: ttsResult.audioPath,
              duration: ttsResult.duration,
              wordTimings: JSON.stringify(ttsResult.wordTimings)
            }
          });
        }

        // Update project back to DRAFT and broadcast
        await prisma.project.update({
          where: { id },
          data: { status: 'DRAFT', updatedAt: new Date() }
        });
        await getAndBroadcastProject(id);
        console.log(`[Project ${id}] Audio regeneration complete for accent: ${voiceAccent}.`);
      } catch (err: any) {
        console.error(`[Project ${id}] Failed to regenerate audio for accent:`, err);
        await prisma.project.update({
          where: { id },
          data: {
            status: 'FAILED',
            error: err.message || 'Failed to regenerate audio for new accent',
            updatedAt: new Date()
          }
        });
        await getAndBroadcastProject(id);
      }
    })();

    res.json({ message: 'Voice accent update and audio regeneration started in background.' });
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
