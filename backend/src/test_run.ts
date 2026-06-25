import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from './db.js';
import { runImageSearch, downloadFile } from './pipeline/steps/2.8_image_search.js';
import { runVideoRenderer } from './pipeline/steps/6_render.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempAudioDir = path.join(__dirname, '..', 'temp_audio');
const outputsDir = path.join(__dirname, '..', 'outputs');

async function main() {
  const topic = "Why did the vaccines we got as kids leave such marks?";
  console.log(`🚀 Starting direct mockup render script for topic: "${topic}"`);

  // 1. Create a mockup project in the DB
  const project = await prisma.project.create({
    data: {
      topic,
      characterPair: 'informative',
      storyline: 'lacrimosa',
      status: 'GENERATING_SCRIPT',
      currentStage: 'research'
    }
  });

  const projectId = project.id;
  console.log(`✅ Project created in DB with ID: ${projectId}`);

  // 2. Create the mockup script in the DB (simulating LLM results)
  const scriptResult = {
    title: "Why did the vaccines we got as kids leave such marks?",
    youtubeTitle: "The Truth Behind Childhood Vaccine Marks",
    youtubeDescription: "Ever wondered about those circular marks many adults have on their upper arm? They're often remnants of childhood vaccinations like the Smallpox or BCG vaccine. These older, live attenuated vaccines were administered intradermally, just under the skin. This intentionally triggered a strong local immune response, leading to a small lesion that would heal into a distinctive scar. The scar served a crucial purpose: it was visible proof that a person had been successfully vaccinated and had developed immunity, vital for public health tracking. #VaccineScars #MedicalHistory #PublicHealth #LearnOnTikTok #ScienceFacts",
    hook: "Why did the vaccines we got as kids leave such marks?",
    info: "The scars are remnants of live vaccines like Smallpox or BCG administered under the skin.",
    cta: "Follow for more daily science facts!",
    duration: 30
  };

  await prisma.script.create({
    data: {
      projectId,
      title: scriptResult.title,
      youtubeTitle: scriptResult.youtubeTitle,
      youtubeDescription: scriptResult.youtubeDescription,
      hook: scriptResult.hook,
      body: scriptResult.youtubeDescription,
      cta: scriptResult.cta,
      duration: scriptResult.duration
    }
  });

  // 3. Search and download a real image from the web (using Unsplash/Google)
  console.log(`🔍 Searching for a real image for "vaccine scar arm"...`);
  let imageUrl = '';
  
  const searchResult = await runImageSearch("vaccine scar", projectId, outputsDir);
  if (searchResult) {
    imageUrl = searchResult;
    console.log(`🎯 Real image found and downloaded: ${imageUrl}`);
  } else {
    console.log(`❌ Failed to scrape a real image. Using a mockup placeholder...`);
    imageUrl = 'https://images.unsplash.com/photo-1611694449252-02453c27856a?w=1080&fit=max&q=80';
  }

  // 4. Create the scene in DB
  const scene = await prisma.scene.create({
    data: {
      projectId,
      sequenceNumber: 1,
      text: scriptResult.hook,
      template: 'informative-card',
      templateData: JSON.stringify({
        title: scriptResult.hook,
        imageUrl,
        info: scriptResult.info,
        camera: { shot: 'medium', motion: 'Zoom In' }
      })
    }
  });

  // 5. Download the background music
  console.log(`🎵 Downloading background music (Mozart - Lacrimosa)...`);
  const selectedSongUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
  const cachedSongPath = path.join(tempAudioDir, 'music_lacrimosa.mp3');
  
  if (!fs.existsSync(cachedSongPath)) {
    await downloadFile(selectedSongUrl, cachedSongPath);
  }

  const sceneAudioPath = path.join(tempAudioDir, `${projectId}_scene_1.mp3`);
  fs.copyFileSync(cachedSongPath, sceneAudioPath);

  // Update scene with audio
  await prisma.scene.update({
    where: { id: scene.id },
    data: {
      audioPath: sceneAudioPath,
      duration: scriptResult.duration,
      wordTimings: '[]'
    }
  });

  // 6. Trigger Remotion rendering CLI
  console.log(`🎬 Triggering Remotion video render for 30s...`);
  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'RENDERING', currentStage: 'render' }
  });

  try {
    const scenes = await prisma.scene.findMany({ where: { projectId } });
    const outputVideoPath = await runVideoRenderer(projectId, scenes);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'COMPLETED',
        currentStage: 'completed',
        videoPath: `/outputs/${projectId}.mp4`
      }
    });

    console.log(`\n🎉 Rendering completed successfully!`);
    console.log(`----------------------------------------------------`);
    console.log(`Video Path: ${outputVideoPath}`);
    console.log(`Caption: ${scriptResult.youtubeDescription}`);
    console.log(`----------------------------------------------------`);
  } catch (err: any) {
    console.error(`❌ Remotion rendering failed:`, err);
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'FAILED', error: err.message }
    });
  }
}

main().catch(err => {
  console.error('❌ Direct render failed:', err);
  process.exit(1);
});
