import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import prisma from '../db.js';
import { runResearch } from './steps/1_research.js';
import { runRetentionDirector, RetentionPlan } from './steps/1.5_retention_director.js';
import { runScriptGenerator, ScriptOutput } from './steps/2_script.js';
import { runScenePlanner, SceneOutput } from './steps/3_scene_planner.js';
import { runImageGenerator } from './steps/2.5_image_generator.js';
import { runRetentionAudit } from './steps/5_scorer.js';
import { generateEdgeTTS } from './steps/4_audio_tts.js';
import { projectEvents } from '../events.js';
import { selectStylePack, STYLE_PACKS } from './style_packs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempAudioDir = path.join(__dirname, '..', '..', 'temp_audio');
const outputsDir = path.join(__dirname, '..', '..', 'outputs');

function calculateGeminiCost(model: string, inputTokens: number, outputTokens: number): number {
  const isLite = model.includes('lite');
  const inputRate = isLite ? 0.0375 / 1000000 : 0.075 / 1000000;
  const outputRate = isLite ? 0.15 / 1000000 : 0.30 / 1000000;
  return (inputTokens * inputRate) + (outputTokens * outputRate);
}

/**
 * Executes the Phase 1 Consistent Character Cinematic Engine pipeline.
 */
export async function runContentPipeline(projectId: string, topic: string, seriesId?: string) {
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase();
  const apiKey = provider === 'openai'
    ? process.env.OPENAI_API_KEY
    : provider === 'deepseek'
      ? process.env.DEEPSEEK_API_KEY
      : process.env.GEMINI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    await updateProjectStatus(
      projectId, 
      'FAILED', 
      'No LLM API key is configured. Set GEMINI_API_KEY, DEEPSEEK_API_KEY, or OPENAI_API_KEY.',
      'failed'
    );
    return;
  }

  // Cost and token tracking
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0.0;
  const costBreakdown: Record<string, number> = {
    research: 0.0,
    retention: 0.0,
    script: 0.0,
    storyboard: 0.0,
    images: 0.0,
    audio: 0.0,
    audit: 0.0
  };

  try {
    // 0. Load Series memory/rules if seriesId is present
    let seriesName = '';
    let seriesUniverseRules = '';
    let pastTopics: string[] = [];

    if (seriesId) {
      const seriesObj = await prisma.series.findUnique({
        where: { id: seriesId },
        include: {
          projects: {
            where: { status: 'COMPLETED' },
            select: { topic: true },
            take: 5,
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (seriesObj) {
        seriesName = seriesObj.name;
        // Parse the universe rules
        try {
          const universeJson = JSON.parse(seriesObj.universe);
          seriesUniverseRules = `Universe: ${universeJson.name}. Premise: ${universeJson.premise}. Style: ${universeJson.visualStyle}. Rules: ${universeJson.rules.join(', ')}`;
        } catch {
          seriesUniverseRules = seriesObj.universe;
        }
        pastTopics = seriesObj.projects.map(p => p.topic);
      }
    }

    // --- Step 1: Research ---
    await updateStage(projectId, 'research', 'GENERATING_SCRIPT');
    console.log(`[Project ${projectId}] Step 1: Researching topic...`);
    const researchResult = await runResearch(topic, apiKey);
    totalInputTokens += researchResult.inputTokens;
    totalOutputTokens += researchResult.outputTokens;
    const researchCost = calculateGeminiCost('gemini-2.5-flash', researchResult.inputTokens, researchResult.outputTokens);
    costBreakdown.research = parseFloat(researchCost.toFixed(4));
    totalCost += researchCost;
    await updateProjectCost(projectId, totalInputTokens, totalOutputTokens, totalCost, costBreakdown);

    // --- Step 1.5: Retention Director ---
    await updateStage(projectId, 'retention', 'GENERATING_SCRIPT');
    console.log(`[Project ${projectId}] Step 1.5: Creating Retention Plan...`);
    const retentionStep = await runRetentionDirector(topic, apiKey, seriesName, seriesUniverseRules, pastTopics);
    const retentionPlan = retentionStep.plan;
    totalInputTokens += retentionStep.inputTokens;
    totalOutputTokens += retentionStep.outputTokens;
    const retentionCost = calculateGeminiCost('gemini-2.5-flash', retentionStep.inputTokens, retentionStep.outputTokens);
    costBreakdown.retention = parseFloat(retentionCost.toFixed(4));
    totalCost += retentionCost;
    
    // Save retention plan basics to project record
    await prisma.project.update({
      where: { id: projectId },
      data: {
        storyline: retentionPlan.storyline,
        viralPattern: retentionPlan.viralPattern,
        retentionScore: retentionPlan.predictedRetention,
        retentionPlan: JSON.stringify(retentionPlan)
      }
    });
    await updateProjectCost(projectId, totalInputTokens, totalOutputTokens, totalCost, costBreakdown);

    // --- Step 2: Dialogue Script Generation ---
    await updateStage(projectId, 'script', 'GENERATING_SCRIPT');
    console.log(`[Project ${projectId}] Step 2: Generating script dialogue...`);
    const scriptStep = await runScriptGenerator(topic, researchResult.outline, apiKey, retentionPlan, seriesUniverseRules);
    const scriptResult = scriptStep.script;
    totalInputTokens += scriptStep.inputTokens;
    totalOutputTokens += scriptStep.outputTokens;
    const scriptCost = calculateGeminiCost('gemini-2.5-flash', scriptStep.inputTokens, scriptStep.outputTokens);
    costBreakdown.script = parseFloat(scriptCost.toFixed(4));
    totalCost += scriptCost;

    // Save Script outline to DB
    await prisma.script.upsert({
      where: { projectId },
      update: {
        title: scriptResult.title,
        hook: scriptResult.hook,
        body: scriptResult.dialogue.map(t => `${t.speaker}: ${t.text}`).join('\n'),
        cta: scriptResult.cta,
        duration: scriptResult.duration
      },
      create: {
        projectId,
        title: scriptResult.title,
        hook: scriptResult.hook,
        body: scriptResult.dialogue.map(t => `${t.speaker}: ${t.text}`).join('\n'),
        cta: scriptResult.cta,
        duration: scriptResult.duration
      }
    });
    await updateProjectCost(projectId, totalInputTokens, totalOutputTokens, totalCost, costBreakdown);

    // --- Step 3: Scene Storyboard Planning ---
    await updateStage(projectId, 'storyboard', 'GENERATING_SCENES');
    const stylePackId = selectStylePack(topic);
    const stylePack = STYLE_PACKS[stylePackId];

    console.log(`[Project ${projectId}] Step 3: Planning storyboard scenes...`);
    const plannerStep = await runScenePlanner(scriptResult, apiKey, retentionPlan, stylePack);
    const sceneResult = plannerStep.planner;
    totalInputTokens += plannerStep.inputTokens;
    totalOutputTokens += plannerStep.outputTokens;
    const storyboardCost = calculateGeminiCost('gemini-2.5-flash', plannerStep.inputTokens, plannerStep.outputTokens);
    costBreakdown.storyboard = parseFloat(storyboardCost.toFixed(4));
    totalCost += storyboardCost;

    // Save the raw storyboard configuration
    await prisma.project.update({
      where: { id: projectId },
      data: {
        storyboard: JSON.stringify(sceneResult)
      }
    });
    await updateProjectCost(projectId, totalInputTokens, totalOutputTokens, totalCost, costBreakdown);

    // --- Step 4: Pluggable Image Generation ---
    await updateStage(projectId, 'images', 'GENERATING_SCENES');
    console.log(`[Project ${projectId}] Step 4: Generating visual scene assets...`);
    
    let imagesCostAccum = 0.0;
    const resolvedScenes: SceneOutput[] = [];

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
          projectId,
          sceneNumber: scene.sceneNumber,
          storyBeat: scene.storyBeat,
          template: scene.template,
          environment: scene.environment,
          characters: scene.characters,
          camera: scene.camera,
          speaker: scene.speaker,
          dialogue: scene.dialogue,
          templateProps: scene.templateProps
        },
        apiKey,
        outputsDir
      );
      
      imagesCostAccum += imgResult.cost;
      
      resolvedScenes.push({
        ...scene,
        storyState,
        renderState: {
          ...renderState,
          imageUrl: imgResult.imageUrl
        }
      });
    }
    costBreakdown.images = parseFloat(imagesCostAccum.toFixed(4));
    totalCost += imagesCostAccum;

    // Save updated storyboard with resolved imageUrls
    await prisma.project.update({
      where: { id: projectId },
      data: {
        storyboard: JSON.stringify({ scenes: resolvedScenes })
      }
    });
    await updateProjectCost(projectId, totalInputTokens, totalOutputTokens, totalCost, costBreakdown);

    // --- Step 5: Retention Scorer Audit ---
    await updateStage(projectId, 'audit', 'SCORING');
    console.log(`[Project ${projectId}] Step 5: Performing final Retention Audit...`);
    const scoreStep = await runRetentionAudit(scriptResult, resolvedScenes, retentionPlan, apiKey);
    const auditReport = scoreStep.auditor;
    totalInputTokens += scoreStep.inputTokens;
    totalOutputTokens += scoreStep.outputTokens;
    const auditCost = calculateGeminiCost('gemini-2.5-flash-lite', scoreStep.inputTokens, scoreStep.outputTokens);
    costBreakdown.audit = parseFloat(auditCost.toFixed(4));
    totalCost += auditCost;

    // Update retention audit columns in DB
    await prisma.project.update({
      where: { id: projectId },
      data: {
        retentionScore: auditReport.retentionScore,
        retentionReport: JSON.stringify(auditReport)
      }
    });
    await updateProjectCost(projectId, totalInputTokens, totalOutputTokens, totalCost, costBreakdown);
    console.log(`[Project ${projectId}] Retention Audit completed with score: ${auditReport.retentionScore}/100.`);

    // Persist finalized scenes to database for rendering step
    console.log(`[Project ${projectId}] Persisting storyboard scenes to database...`);
    // Clear old scenes database records first to avoid duplicates on retries
    await prisma.scene.deleteMany({
      where: { projectId }
    });

    for (const scene of resolvedScenes) {
      await prisma.scene.create({
        data: {
          projectId,
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

    // --- Step 6: TTS Voiceover generation ---
    await updateStage(projectId, 'audio', 'GENERATING_AUDIO');
    console.log(`[Project ${projectId}] Step 6: Synthesizing character voiceovers...`);

    const currentScenes = await prisma.scene.findMany({
      where: { projectId },
      orderBy: { sequenceNumber: 'asc' }
    });

    for (const scene of currentScenes) {
      const audioFilename = `${projectId}_scene_${scene.sequenceNumber}.mp3`;
      const sceneAudioPath = path.join(tempAudioDir, audioFilename);
      
      const sceneData = JSON.parse(scene.templateData);
      const speakerName = sceneData.storyState?.speaker || 'Byte';
      const voice = speakerName === 'Bug' ? 'en-US-EmmaNeural' : 'en-US-AndrewNeural';

      // Extract actual dialogue text to prevent voice synthesis from reading character prefix name
      const dialogueText = (sceneData.storyState?.dialogue || scene.text || '').replace(/^(Byte|Bug):\s*/i, '');
      console.log(`Generating speech for ${speakerName} in scene ${scene.sequenceNumber}: "${dialogueText}"`);
      const ttsResult = await generateEdgeTTS(dialogueText, sceneAudioPath, voice);

      // Update the scene database row
      await prisma.scene.update({
        where: { id: scene.id },
        data: {
          audioPath: ttsResult.audioPath,
          duration: ttsResult.duration,
          wordTimings: JSON.stringify(ttsResult.wordTimings)
        }
      });
    }

    // Pipeline completed. Transition status to DRAFT for review.
    const completedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'DRAFT',
        currentStage: 'completed',
        updatedAt: new Date()
      },
      include: {
        script: true,
        scenes: {
          orderBy: { sequenceNumber: 'asc' }
        },
        series: true
      }
    });

    projectEvents.emit(`update:${projectId}`, formatProjectForResponse(completedProject));
    console.log(`[Project ${projectId}] Pipeline successfully completed. Status set to DRAFT.`);

  } catch (error: any) {
    console.error(`[Project ${projectId}] Pipeline failed:`, error);
    await updateProjectStatus(projectId, 'FAILED', error.message || 'Unknown error occurred in pipeline', 'failed');
  }
}

// Helpers to format a database project by parsing text columns containing JSON strings
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

async function updateStage(id: string, stage: string, status: string) {
  const updated = await prisma.project.update({
    where: { id },
    data: {
      status,
      currentStage: stage,
      updatedAt: new Date()
    },
    include: {
      script: true,
      scenes: {
        orderBy: { sequenceNumber: 'asc' }
      },
      series: true
    }
  });
  projectEvents.emit(`update:${id}`, formatProjectForResponse(updated));
}

async function updateProjectStatus(id: string, status: string, error?: string, stage?: string) {
  const updated = await prisma.project.update({
    where: { id },
    data: {
      status,
      currentStage: stage || null,
      error: error || null,
      updatedAt: new Date()
    },
    include: {
      script: true,
      scenes: {
        orderBy: { sequenceNumber: 'asc' }
      },
      series: true
    }
  });

  projectEvents.emit(`update:${id}`, formatProjectForResponse(updated));
}

async function updateProjectCost(
  id: string, 
  inputTokens: number, 
  outputTokens: number, 
  cost: number, 
  breakdown: any
) {
  const updated = await prisma.project.update({
    where: { id },
    data: {
      inputTokens,
      outputTokens,
      generationCost: cost,
      costBreakdown: JSON.stringify(breakdown),
      updatedAt: new Date()
    },
    include: {
      script: true,
      scenes: {
        orderBy: { sequenceNumber: 'asc' }
      },
      series: true
    }
  });

  projectEvents.emit(`update:${id}`, formatProjectForResponse(updated));
}
