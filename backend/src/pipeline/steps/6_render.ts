import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RenderInputProps {
  projectId: string;
  scenes: {
    id: number;
    text: string;
    template: string;
    templateData: any;
    audioUrl: string; // HTTP url for Remotion to fetch the audio
    duration: number; // in seconds
    startFrame: number;
    endFrame: number;
    wordTimings: any[];
  }[];
  totalDurationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

export async function runVideoRenderer(
  projectId: string,
  scenesData: any[], // Scenes with audio path, duration, word timings
  onProgress?: (progress: number) => void
): Promise<string> {
  const fps = 30;
  let currentFrame = 0;

  // Calculate start/end frames for each scene based on its audio duration
  const formattedScenes = scenesData.map((scene, index) => {
    let durationSec = scene.duration || 3.0; // fallback to 3s if missing
    
    // For the last scene, add a 1.5 second hold to create a proper closing sequence
    const isLastScene = index === scenesData.length - 1;
    if (isLastScene) {
      durationSec += 1.5;
    }

    const durationFrames = Math.ceil(durationSec * fps);
    const startFrame = currentFrame;
    const endFrame = currentFrame + durationFrames;
    currentFrame = endFrame;

    // Convert local system audio path (e.g. backend/temp_audio/xyz.mp3)
    // to a relative URL that the Remotion web server can access: http://localhost:3001/audio/xyz.mp3
    const audioFilename = path.basename(scene.audioPath);
    const audioUrl = `http://localhost:3001/audio/${audioFilename}`;

    const templateData = JSON.parse(scene.templateData);
    if (templateData.imageUrl && templateData.imageUrl.startsWith('/outputs/')) {
      templateData.imageUrl = `http://localhost:3001${templateData.imageUrl}`;
    }
    if (templateData.renderState?.imageUrl && templateData.renderState.imageUrl.startsWith('/outputs/')) {
      templateData.renderState.imageUrl = `http://localhost:3001${templateData.renderState.imageUrl}`;
    }

    return {
      id: scene.sequenceNumber,
      text: scene.text,
      template: scene.template,
      templateData,
      audioUrl,
      duration: durationSec,
      startFrame,
      endFrame,
      wordTimings: JSON.parse(scene.wordTimings || '[]')
    };
  });

  const totalDurationInFrames = currentFrame;

  const renderProps: RenderInputProps = {
    projectId,
    scenes: formattedScenes,
    totalDurationInFrames,
    fps,
    width: 1080,
    height: 1920
  };

  // Paths configurations
  const tempPropsPath = path.join(__dirname, '..', '..', '..', 'temp_audio', `${projectId}_props.json`);
  const outputMp4Path = path.join(__dirname, '..', '..', '..', 'outputs', `${projectId}.mp4`);
  const remotionDir = path.join(__dirname, '..', '..', '..', '..', 'remotion');

  // Write props to a file so Remotion CLI can read it
  fs.writeFileSync(tempPropsPath, JSON.stringify(renderProps, null, 2));

  return new Promise((resolve, reject) => {
    // We execute the local remotion project command:
    // npx remotion render src/index.ts ShortComposition <output-mp4> --props=<temp-props>
    const command = `npx remotion render MainComposition "${outputMp4Path}" --props="${tempPropsPath}" -y`;
    console.log(`🎬 Running command: ${command} in ${remotionDir}`);

    const process = exec(command, { cwd: remotionDir }, (error, stdout, stderr) => {
      // Clean up temporary props file
      try {
        if (fs.existsSync(tempPropsPath)) {
          fs.unlinkSync(tempPropsPath);
        }
      } catch (e) {
        console.error('Failed to delete temporary props file:', e);
      }

      if (error) {
        console.error('Remotion CLI execution error:', stderr);
        return reject(new Error(`Remotion compilation failed: ${error.message}`));
      }

      console.log('Remotion CLI output:', stdout);
      resolve(outputMp4Path);
    });

    // Monitor progress output if possible
    process.stdout?.on('data', (data: string) => {
      // Remotion CLI outputs progress like: Rendered frame 120 / 600 (20%)
      const match = data.match(/(\d+)%/);
      if (match && onProgress) {
        const percent = parseInt(match[1], 10);
        onProgress(percent);
      }
    });
  });
}
