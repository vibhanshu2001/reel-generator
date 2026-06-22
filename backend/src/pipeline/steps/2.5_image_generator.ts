import fs from 'fs';
import path from 'path';

export interface CharacterSceneState {
  name: 'Byte' | 'Bug';
  emotion: string;
  action: string;
}

export interface ImageGeneratorInput {
  projectId: string;
  sceneNumber: number;
  storyBeat: string;
  template: string;
  environment: {
    name: string;
    description: string;
  };
  characters: CharacterSceneState[];
  camera: {
    shot: string;
    motion: string;
  };
  speaker: string;
  dialogue: string;
  templateProps?: any;
}

export interface ImageGeneratorResult {
  imageUrl: string;
  localPath: string;
  provider: 'dalle' | 'svg_fallback';
  cost: number;
}

/**
 * Pluggable Image Provider.
 * Generates an image using Google's Imagen 3 API, falling back to OpenAI DALL-E 3,
 * and falling back to a highly polished dynamic SVG Mascot scene renderer if API calls fail or keys are missing.
 */
export async function runImageGenerator(
  input: ImageGeneratorInput,
  apiKey: string,
  outputsDir: string
): Promise<ImageGeneratorResult> {
  const filename = `${input.projectId}_scene_${input.sceneNumber}`;
  const svgFilename = `${filename}.svg`;
  const pngFilename = `${filename}.png`;
  
  const localSvgPath = path.join(outputsDir, svgFilename);
  const localPngPath = path.join(outputsDir, pngFilename);

  // Try Google Imagen 3 via Generative Language API
  const geminiApiKey = process.env.GEMINI_API_KEY || (apiKey && apiKey.startsWith('AIza') ? apiKey : '');

  if (geminiApiKey) {
    try {
      console.log(`🎨 [ImageGen] Calling Google Imagen 4 for Scene ${input.sceneNumber}...`);
      const imagePrompt = composeImagePrompt(input);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${geminiApiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: imagePrompt
            }
          ],
          parameters: {
            sampleCount: 1,
            aspectRatio: '9:16',
            outputMimeType: 'image/jpeg'
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        const base64Data = result.predictions?.[0]?.bytesBase64Encoded;
        
        if (base64Data) {
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(localPngPath, buffer);
          
          return {
            imageUrl: `/outputs/${pngFilename}`,
            localPath: localPngPath,
            provider: 'dalle', // Keep 'dalle' provider tag for database schema compatibility
            cost: 0.03 // approximate cost per Imagen 3 generation
          };
        } else {
          console.warn(`[ImageGen] Google Imagen 3 returned empty predictions. Trying next provider.`);
        }
      } else {
        const errText = await response.text();
        console.warn(`[ImageGen] Google Imagen 3 failed: ${response.status} - ${errText}. Trying next provider.`);
      }
    } catch (err: any) {
      console.warn(`[ImageGen] Google Imagen 3 error: ${err.message || err}. Trying next provider.`);
    }
  }

  // Backup: Check if OpenAI DALL-E 3 is configured and active
  const useDalle = process.env.LLM_PROVIDER?.trim().toLowerCase() === 'openai' || Boolean(process.env.OPENAI_API_KEY);
  
  if (useDalle && process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('C98KY7udvH7PTPkXIgohsg6QNxQWj1vW5ry5p8gJuiipGjEi')) {
    try {
      console.log(`🎨 [ImageGen] Calling DALL-E 3 backup for Scene ${input.sceneNumber}...`);
      
      const imagePrompt = composeImagePrompt(input);
      
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: imagePrompt,
          n: 1,
          size: '1024x1792', // vertical 9:16 layout
          quality: 'standard',
          response_format: 'url'
        })
      });

      if (response.ok) {
        const result = await response.json();
        const imageUrl = result.data[0]?.url;
        
        if (imageUrl) {
          // Download and save image locally
          const imageResponse = await fetch(imageUrl);
          const buffer = Buffer.from(await imageResponse.arrayBuffer());
          fs.writeFileSync(localPngPath, buffer);
          
          return {
            imageUrl: `/outputs/${pngFilename}`,
            localPath: localPngPath,
            provider: 'dalle',
            cost: 0.04 // standard DALL-E 3 cost
          };
        }
      } else {
        const errText = await response.text();
        console.warn(`[ImageGen] DALL-E 3 backup failed: ${response.status} - ${errText}. Falling back to SVG mascot drawer.`);
      }
    } catch (err: any) {
      console.warn(`[ImageGen] DALL-E 3 backup error: ${err.message || err}. Falling back to SVG mascot drawer.`);
    }
  }

  // Draw vector SVG mascot scene as a robust, consistent fallback
  console.log(`🎨 [ImageGen] Generating vector SVG mascot fallback for Scene ${input.sceneNumber}...`);
  const svgContent = drawSvgMascotScene(input);
  fs.writeFileSync(localSvgPath, svgContent);

  return {
    imageUrl: `/outputs/${svgFilename}`,
    localPath: localSvgPath,
    provider: 'svg_fallback',
    cost: 0.0
  };
}

/**
 * Composes high-fidelity prompts for Imagen 3/DALL-E 3 using the Character Bible lore.
 */
function composeImagePrompt(scene: ImageGeneratorInput): string {
  const envDesc = `${scene.environment.name}: ${scene.environment.description}. The environment and visual concept dominates 85% of the frame.`;
  
  const charsDesc = scene.characters.map((c) => {
    const mascotDetails = c.name === 'Byte'
      ? 'Byte (a small friendly blue futuristic rounded robot with glowing white digital eyes on a dark round visor head, sleek metallic body, cute cartoon style)'
      : 'Bug (a small cute green companion insect, large expressive eyes, chubby round green body, tiny wings, yellow backpack, cute cartoon style)';
    return `${mascotDetails} is present, feeling ${c.emotion} and is ${c.action}, but is positioned unobtrusively in the background or side, occupying less than 10% of the screen.`;
  }).join(' ');

  const cameraDesc = `This is a ${scene.camera.shot} camera shot, with a ${scene.camera.motion} effect.`;

  return `Consistent vertical 9:16 vertical composition, premium 3D animated cartoon movie style in the visual style of Zootopia, Pixar, and Big Hero 6. Immersive full-screen environment: ${envDesc}. The scene must occupy the entire vertical frame without any borders, frames, cards, or floating windows. Concept is the hero: the image focuses on a single clear idea with a clear focal point, visible action, and obvious cause-and-effect relationship. Characters: ${charsDesc || 'No characters.'} The concept/environment dominates 90% of the frame. Characters must be small and never compete with the concept for attention. No cyberpunk cities, no generic futuristic AI art, no abstract holograms, no sci-fi wallpaper. Vibrant colors, friendly and clean lighting, easy to understand in 1 second. The image must be purely visual: do NOT include any written text, words, letters, labels, signs, signatures, or captions on any elements in the scene. ${cameraDesc} Detailed 3D CGI rendering, high resolution.`;
}

/**
 * Programmatic SVG generator drawing Byte and Bug mascots inside thematic backgrounds
 * with customized visual details mapping to speaker, emotion, environment, and story beat.
 * Completely parses environments, poses characters dynamically based on action scripts,
 * and executes camera shot shifts on the root view container.
 */
function drawSvgMascotScene(input: ImageGeneratorInput): string {
  const { environment, characters, camera } = input;
  const envName = environment.name.toLowerCase();
  
  // 1. Identify Environment archetype
  const isKafka = envName.includes('factory') || envName.includes('partition') || envName.includes('belt') || envName.includes('kafka');
  const isRedis = envName.includes('vault') || envName.includes('memory') || envName.includes('speed') || envName.includes('redis') || envName.includes('disk');
  const isK8s = envName.includes('city') || envName.includes('kubernetes') || envName.includes('harbor') || envName.includes('docker') || envName.includes('pod');
  const isChatGpt = envName.includes('chatgpt') || envName.includes('arena') || envName.includes('predict') || envName.includes('token') || envName.includes('ai');

  // Set default palette colors
  let bgGradientStart = '#020308';
  let bgGradientEnd = '#0b132b';
  let gridColor = 'rgba(0, 242, 254, 0.05)';
  let accentColor = '#00f2fe';
  let envLabelText = 'Cyber Fortress';

  if (isKafka) {
    bgGradientStart = '#040914';
    bgGradientEnd = '#0b1021';
    gridColor = 'rgba(57, 255, 20, 0.04)';
    accentColor = '#39ff14'; // neon green
    envLabelText = 'Kafka Partition Factory';
  } else if (isRedis) {
    bgGradientStart = '#070708';
    bgGradientEnd = '#1c150b';
    gridColor = 'rgba(255, 223, 0, 0.04)';
    accentColor = '#ffdf00'; // gold / amber
    envLabelText = 'Redis Memory Vault';
  } else if (isK8s) {
    bgGradientStart = '#05020a';
    bgGradientEnd = '#1b0a2b';
    gridColor = 'rgba(236, 72, 153, 0.04)';
    accentColor = '#ec4899'; // pink
    envLabelText = 'Kubernetes Container City';
  } else if (isChatGpt) {
    bgGradientStart = '#02040c';
    bgGradientEnd = '#0b1b3a';
    gridColor = 'rgba(14, 165, 233, 0.05)';
    accentColor = '#0ea5e9'; // sky blue
    envLabelText = 'Word Prediction Arena';
  }

  // 2. Identify Poses and layout positions based on actions
  const drawByte = characters.some(c => c.name === 'Byte');
  const drawBug = characters.some(c => c.name === 'Bug');
  const byteData = characters.find(c => c.name === 'Byte');
  const bugData = characters.find(c => c.name === 'Bug');

  // Default coordinate setup (Centered/Balanced)
  let byteX = 320;
  let byteY = 1250;
  let byteScale = 0.55;
  let byteRot = 0;

  let bugX = 760;
  let bugY = 1280;
  let bugScale = 0.55;
  let bugRot = 0;

  const byteAction = byteData?.action.toLowerCase() || '';
  const bugAction = bugData?.action.toLowerCase() || '';

  // Scene compositions
  // Composition A: Trapped / Control panel
  if (bugAction.includes('trap') || bugAction.includes('inside') || bugAction.includes('conveyor') || bugAction.includes('lost')) {
    bugX = 540;
    bugY = 850;
    bugScale = 0.48;
    
    byteX = 240;
    byteY = 1300;
    byteRot = -10; // leaning towards console
  } 
  // Composition B: Chasing / Running / Race
  else if (byteAction.includes('run') || bugAction.includes('run') || byteAction.includes('race') || bugAction.includes('race') || bugAction.includes('chase')) {
    byteX = 350;
    byteY = 1250;
    byteRot = -12; // lean forward
    byteScale = 0.52;

    bugX = 780;
    bugY = 1230;
    bugRot = -18; // lean forward running
    bugScale = 0.52;
  }
  // Composition C: Falling / Flying
  else if (bugAction.includes('fall') || bugAction.includes('fly') || bugAction.includes('drop')) {
    bugX = 540;
    bugY = 700;
    bugRot = 140; // falling head first / tilted
    bugScale = 0.48;

    byteX = 260;
    byteY = 1320;
  }
  else if (byteAction.includes('fall') || byteAction.includes('fly') || byteAction.includes('ride')) {
    byteX = 540;
    byteY = 750;
    byteRot = -20;
    byteScale = 0.48;

    bugX = 800;
    bugY = 1320;
  }
  // Composition D: Climbing / Searching / Pointing
  else if (byteAction.includes('point') || byteAction.includes('stand on')) {
    byteX = 240;
    byteY = 1000; // standing high
    byteScale = 0.50;

    bugX = 720;
    bugY = 1300;
  }

  // 3. Environmental Drawing Elements
  let environmentSvg = '';

  if (isKafka) {
    // Kafka Conveyor belts, partition lines, and data packets
    environmentSvg = `
      <!-- Kafka Factory Belts -->
      <g stroke="${accentColor}" stroke-linecap="round" fill="none">
        <!-- Main Conveyor Belt -->
        <path d="M -100 1400 Q 540 1450 1180 1400" stroke-width="24" stroke-dasharray="25, 20" opacity="0.85"/>
        <path d="M -100 1400 Q 540 1450 1180 1400" stroke-width="4" opacity="0.3"/>
        
        <!-- Overhead Belt -->
        <path d="M -100 650 Q 540 600 1180 650" stroke-width="16" stroke-dasharray="15, 25" opacity="0.6"/>
      </g>
      
      <!-- Partition dividers/gates -->
      <g opacity="0.8">
        <rect x="420" y="700" width="240" height="300" rx="16" fill="rgba(4,9,20,0.85)" stroke="${accentColor}" stroke-width="6" stroke-dasharray="10, 10" filter="drop-shadow(0 0 15px ${accentColor})"/>
        <text x="540" y="750" fill="${accentColor}" font-family="monospace" font-size="28" font-weight="bold" text-anchor="middle">PARTITION 0</text>
        <line x1="420" y1="780" x2="660" y2="780" stroke="${accentColor}" stroke-width="2"/>
        
        <!-- Partition 1 (Background left) -->
        <rect x="80" y="800" width="160" height="200" rx="12" fill="rgba(4,9,20,0.6)" stroke="#0ea5e9" stroke-width="3" stroke-dasharray="5, 5"/>
        <text x="160" y="840" fill="#0ea5e9" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle">PARTITION 1</text>
        
        <!-- Partition 2 (Background right) -->
        <rect x="840" y="800" width="160" height="200" rx="12" fill="rgba(4,9,20,0.6)" stroke="#0ea5e9" stroke-width="3" stroke-dasharray="5, 5"/>
        <text x="920" y="840" fill="#0ea5e9" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle">PARTITION 2</text>
      </g>

      <!-- Glowing Data Packets floating overhead -->
      <g fill="${accentColor}" filter="drop-shadow(0 0 10px ${accentColor})">
        <rect x="180" y="615" width="50" height="20" rx="10"/>
        <rect x="480" y="590" width="50" height="20" rx="10"/>
        <rect x="820" y="615" width="50" height="20" rx="10"/>
        
        <!-- Packets on main belt -->
        <circle cx="200" cy="1410" r="14"/>
        <circle cx="540" cy="1435" r="14"/>
        <circle cx="880" cy="1410" r="14"/>
      </g>
    `;
  } else if (isRedis) {
    // Redis Memory Vault, speed trails, lightning
    environmentSvg = `
      <!-- Redis Central Vault safe lock in background -->
      <circle cx="540" cy="800" r="280" fill="none" stroke="rgba(255, 223, 0, 0.08)" stroke-width="40"/>
      <circle cx="540" cy="800" r="240" fill="none" stroke="${accentColor}" stroke-width="12" stroke-dasharray="10, 20" filter="drop-shadow(0 0 20px ${accentColor})"/>
      <circle cx="540" cy="800" r="80" fill="rgba(7,7,8,0.9)" stroke="${accentColor}" stroke-width="8"/>
      
      <!-- Vault Dial details -->
      <line x1="540" y1="720" x2="540" y2="760" stroke="${accentColor}" stroke-width="6"/>
      <line x1="540" y1="840" x2="540" y2="880" stroke="${accentColor}" stroke-width="6"/>
      <line x1="460" y1="800" x2="500" y2="800" stroke="${accentColor}" stroke-width="6"/>
      <line x1="580" y1="800" x2="620" y2="800" stroke="${accentColor}" stroke-width="6"/>

      <!-- Lightning / Speed trails -->
      <g stroke="${accentColor}" stroke-linecap="round" fill="none" opacity="0.8">
        <!-- Energy Bolt 1 -->
        <path d="M 120 400 L 220 650 L 160 700 L 280 950" stroke-width="6" filter="drop-shadow(0 0 10px ${accentColor})"/>
        <!-- Energy Bolt 2 -->
        <path d="M 960 400 L 860 650 L 920 700 L 800 950" stroke-width="6" filter="drop-shadow(0 0 10px ${accentColor})"/>
        
        <!-- Speed trails behind characters -->
        <path d="M 100 1350 L 980 1350" stroke-width="4" stroke-dasharray="30, 30" opacity="0.4"/>
      </g>
      
      <!-- Glowing RAM slots / memory blocks -->
      <g fill="rgba(255,223,0,0.1)" stroke="${accentColor}" stroke-width="2">
        <rect x="250" y="1420" width="80" height="25" rx="4"/>
        <rect x="350" y="1420" width="80" height="25" rx="4"/>
        <rect x="450" y="1420" width="80" height="25" rx="4"/>
        <rect x="550" y="1420" width="80" height="25" rx="4"/>
        <rect x="650" y="1420" width="80" height="25" rx="4"/>
        <rect x="750" y="1420" width="80" height="25" rx="4"/>
      </g>
    `;
  } else if (isK8s) {
    // Kubernetes container city, pods, service bridges
    environmentSvg = `
      <!-- Container City stacks -->
      <g stroke="${accentColor}" stroke-width="4" fill="rgba(236,72,153,0.06)">
        <!-- Giant background containers -->
        <rect x="60" y="550" width="280" height="180" rx="8"/>
        <line x1="60" y1="610" x2="340" y2="610" stroke="${accentColor}" stroke-width="2"/>
        <line x1="60" y1="670" x2="340" y2="670" stroke="${accentColor}" stroke-width="2"/>

        <rect x="60" y="750" width="280" height="180" rx="8"/>
        <line x1="60" y1="810" x2="340" y2="810" stroke="${accentColor}" stroke-width="2"/>
        <line x1="60" y1="870" x2="340" y2="870" stroke="${accentColor}" stroke-width="2"/>

        <!-- Right container stacks -->
        <rect x="740" y="600" width="280" height="180" rx="8"/>
        <line x1="740" y1="660" x2="1020" y2="660" stroke="${accentColor}" stroke-width="2"/>
        <line x1="740" y1="720" x2="1020" y2="720" stroke="${accentColor}" stroke-width="2"/>
        
        <rect x="740" y="800" width="280" height="180" rx="8" stroke="#38bdf8" fill="rgba(56,189,248,0.05)"/>
        <line x1="740" y1="860" x2="1020" y2="860" stroke="#38bdf8" stroke-width="2"/>
        <line x1="740" y1="920" x2="1020" y2="920" stroke="#38bdf8" stroke-width="2"/>
      </g>

      <!-- Pods nodes circles -->
      <g filter="drop-shadow(0 0 8px ${accentColor})">
        <!-- Pod Alpha -->
        <circle cx="200" cy="1150" r="60" fill="none" stroke="${accentColor}" stroke-width="4" stroke-dasharray="6,6"/>
        <circle cx="200" cy="1150" r="15" fill="${accentColor}"/>
        <text x="200" y="1240" fill="#ffffff" font-family="monospace" font-size="14" text-anchor="middle">pod-core-alpha</text>

        <!-- Pod Beta -->
        <circle cx="880" cy="1150" r="60" fill="none" stroke="${accentColor}" stroke-width="4" stroke-dasharray="6,6"/>
        <circle cx="880" cy="1150" r="15" fill="${accentColor}"/>
        <text x="880" y="1240" fill="#ffffff" font-family="monospace" font-size="14" text-anchor="middle">pod-core-beta</text>
      </g>

      <!-- Service bridges pipelines -->
      <path d="M 200 1150 H 880" stroke="${accentColor}" stroke-width="8" fill="none" opacity="0.6" stroke-dasharray="15, 10"/>
      <path d="M 340 640 L 740 690" stroke="#38bdf8" stroke-width="6" fill="none" opacity="0.5"/>
    `;
  } else if (isChatGpt) {
    // ChatGPT Word Prediction Arena, floating tokens, probability streams
    environmentSvg = `
      <!-- Glowing neural node center -->
      <circle cx="540" cy="720" r="150" fill="none" stroke="rgba(14, 165, 233, 0.15)" stroke-width="60"/>
      <circle cx="540" cy="720" r="120" fill="none" stroke="${accentColor}" stroke-width="4" stroke-dasharray="5,15" filter="drop-shadow(0 0 10px ${accentColor})"/>

      <!-- Floating word prediction boxes -->
      <g filter="drop-shadow(0 0 10px rgba(14,165,233,0.4))">
        <!-- token 1 -->
        <g transform="translate(180, 500) rotate(-10)">
          <rect x="0" y="0" width="180" height="70" rx="12" fill="#0b1b3a" stroke="${accentColor}" stroke-width="3"/>
          <text x="90" y="45" fill="#ffffff" font-family="'Outfit', sans-serif" font-size="24" font-weight="900" text-anchor="middle">"attention"</text>
        </g>
        
        <!-- token 2 -->
        <g transform="translate(680, 520) rotate(15)">
          <rect x="0" y="0" width="160" height="70" rx="12" fill="#0b1b3a" stroke="${accentColor}" stroke-width="3"/>
          <text x="80" y="45" fill="#ffffff" font-family="'Outfit', sans-serif" font-size="24" font-weight="900" text-anchor="middle">"vector"</text>
        </g>

        <!-- token 3 (Target / high probability) -->
        <g transform="translate(430, 850)">
          <rect x="0" y="0" width="220" height="80" rx="16" fill="#0f2b5c" stroke="#ffdf00" stroke-width="5" filter="drop-shadow(0 0 12px #ffdf00)"/>
          <text x="110" y="42" fill="#ffdf00" font-family="'Outfit', sans-serif" font-size="22" font-weight="800" text-anchor="middle">PROBABILITY: 98%</text>
          <text x="110" y="68" fill="#ffffff" font-family="'Outfit', sans-serif" font-size="24" font-weight="900" text-anchor="middle">"transformers"</text>
        </g>
      </g>

      <!-- Connection curves (Probability Streams) -->
      <path d="M 270 570 C 350 720, 420 720, 540 850" stroke="${accentColor}" stroke-width="4" fill="none" opacity="0.6"/>
      <path d="M 760 590 C 680 720, 660 720, 540 850" stroke="${accentColor}" stroke-width="4" fill="none" opacity="0.6"/>
    `;
  } else {
    // Generic PostgreSQL / Library
    environmentSvg = `
      <!-- Library shelves -->
      <line x1="80" y1="500" x2="1000" y2="500" stroke="rgba(255,255,255,0.15)" stroke-width="12"/>
      <line x1="80" y1="850" x2="1000" y2="850" stroke="rgba(255,255,255,0.15)" stroke-width="12"/>
      <line x1="80" y1="1200" x2="1000" y2="1200" stroke="rgba(255,255,255,0.15)" stroke-width="12"/>

      <!-- Books stacks -->
      <g fill="rgba(168,85,247,0.2)" stroke="${accentColor}" stroke-width="3" filter="drop-shadow(0 0 8px ${accentColor})">
        <rect x="180" y="320" width="70" height="180" rx="4"/>
        <rect x="255" y="300" width="75" height="200" rx="4"/>
        <rect x="335" y="340" width="65" height="160" rx="4"/>
        
        <rect x="700" y="680" width="80" height="170" rx="4" fill="rgba(56,189,248,0.2)" stroke="#38bdf8"/>
        <rect x="785" y="650" width="75" height="200" rx="4" fill="rgba(56,189,248,0.2)" stroke="#38bdf8"/>
      </g>
    `;
  }

  // 4. Character Visual elements SVG builders
  let byteSvg = '';
  let bugSvg = '';

  // Byte mascot builder
  if (drawByte && byteData) {
    const bx = 300;
    const by = 1150;
    const emotion = byteData.emotion.toLowerCase();

    let byteEyes = `<ellipse cx="${bx - 35}" cy="${by - 110}" rx="14" ry="14" fill="#ffffff" filter="drop-shadow(0 0 8px #00f2fe)"/>
                    <ellipse cx="${bx + 35}" cy="${by - 110}" rx="14" ry="14" fill="#ffffff" filter="drop-shadow(0 0 8px #00f2fe)"/>`;
    let byteMouth = `<path d="M ${bx - 15} ${by - 60} Q ${bx} ${by - 50} ${bx + 15} ${by - 60}" stroke="#00f2fe" stroke-width="6" fill="none" stroke-linecap="round"/>`;

    if (emotion === 'shock' || emotion === 'surprised' || emotion === 'shocked' || emotion === 'panic') {
      byteEyes = `<circle cx="${bx - 35}" cy="${by - 110}" r="22" fill="#ffffff" filter="drop-shadow(0 0 12px #ff3366)"/>
                  <circle cx="${bx + 35}" cy="${by - 110}" r="22" fill="#ffffff" filter="drop-shadow(0 0 12px #ff3366)"/>`;
      byteMouth = `<circle cx="${bx}" cy="${by - 55}" r="15" fill="#ff3366" filter="drop-shadow(0 0 6px #ff3366)"/>`;
    } else if (emotion === 'confused') {
      byteEyes = `<path d="M ${bx - 45} ${by - 120} L ${bx - 25} ${by - 100} M ${bx - 25} ${by - 120} L ${bx - 45} ${by - 100}" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
                  <circle cx="${bx + 35}" cy="${by - 110}" r="14" fill="#ffffff" filter="drop-shadow(0 0 8px #00f2fe)"/>`;
      byteMouth = `<path d="M ${bx - 20} ${by - 55} L ${bx + 20} ${by - 62}" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>`;
    } else if (emotion === 'explaining' || emotion === 'confident' || emotion === 'focused') {
      byteEyes = `<path d="M ${bx - 50} ${by - 115} Q ${bx - 35} ${by - 130} ${bx - 20} ${by - 115}" stroke="#00f2fe" stroke-width="8" fill="none" stroke-linecap="round"/>
                  <path d="M ${bx + 20} ${by - 115} Q ${bx + 35} ${by - 130} ${bx + 50} ${by - 115}" stroke="#00f2fe" stroke-width="8" fill="none" stroke-linecap="round"/>`;
      byteMouth = `<path d="M ${bx - 25} ${by - 65} Q ${bx} ${by - 35} ${bx + 25} ${by - 65}" fill="#00f2fe" stroke-linecap="round"/>`;
    }

    // Interactive actions: Pointing arms
    let actionOverlays = '';
    if (byteAction.includes('point')) {
      actionOverlays += `
        <!-- Pointing arm -->
        <path d="M ${bx - 80} ${by + 60} L ${bx - 220} ${by + 30}" stroke="#00f2fe" stroke-width="24" fill="none" stroke-linecap="round"/>
        <circle cx="${bx - 220}" cy="${by + 30}" r="20" fill="#39ff14" filter="drop-shadow(0 0 10px #39ff14)"/>
      `;
    }
    if (byteAction.includes('ride') || byteAction.includes('packet')) {
      actionOverlays += `
        <!-- Hoverboard under Byte -->
        <ellipse cx="${bx}" cy="${by + 220}" rx="160" ry="25" fill="#39ff14" opacity="0.9" filter="drop-shadow(0 0 15px #39ff14)"/>
        <path d="M ${bx - 120} ${by + 230} L ${bx - 160} ${by + 210}" stroke="#39ff14" stroke-width="8" stroke-linecap="round"/>
        <path d="M ${bx + 120} ${by + 230} L ${bx + 160} ${by + 210}" stroke="#39ff14" stroke-width="8" stroke-linecap="round"/>
      `;
    }
    if (emotion === 'panic' || emotion === 'confused' || emotion === 'shocked') {
      actionOverlays += `
        <!-- Panic exclamation mark -->
        <g transform="translate(${bx + 120}, ${by - 200})">
          <circle cx="0" cy="0" r="28" fill="#ff3366" filter="drop-shadow(0 0 8px #ff3366)"/>
          <text x="0" y="15" fill="#ffffff" font-family="'Outfit', sans-serif" font-size="44" font-weight="900" text-anchor="middle">!</text>
        </g>
      `;
    }

    const byteTransform = `translate(${byteX - bx}, ${byteY - by}) scale(${byteScale}) rotate(${byteRot}, ${bx}, ${by})`;

    byteSvg = `
      <!-- BYTE MASCOT -->
      <g transform="${byteTransform}">
        <ellipse cx="${bx}" cy="${by + 210}" rx="130" ry="24" fill="rgba(0,0,0,0.5)" filter="blur(8px)"/>
        <rect x="${bx - 120}" y="${by - 40}" width="240" height="200" rx="40" fill="url(#byteBodyGrad)" stroke="rgba(255,255,255,0.1)" stroke-width="4"/>
        <rect x="${bx - 70}" y="${by + 10}" width="140" height="90" rx="16" fill="rgba(10, 25, 47, 0.7)" stroke="#00f2fe" stroke-width="2"/>
        <text x="${bx}" y="${by + 60}" fill="#39ff14" font-family="monospace" font-size="28" font-weight="bold" text-anchor="middle">&lt; OK &gt;</text>
        <rect x="${bx - 40}" y="${by - 75}" width="80" height="40" rx="10" fill="#1f2937"/>
        <rect x="${bx - 140}" y="${by - 210}" width="280" height="150" rx="60" fill="url(#byteHeadGrad)" stroke="rgba(255,255,255,0.06)" stroke-width="4"/>
        <rect x="${bx - 110}" y="${by - 180}" width="220" height="100" rx="40" fill="#030712" stroke="rgba(0, 242, 254, 0.3)" stroke-width="3"/>
        ${byteEyes}
        ${byteMouth}
        <line x1="${bx}" y1="${by - 210}" x2="${bx}" y2="${by - 250}" stroke="#00f2fe" stroke-width="8" stroke-linecap="round"/>
        <circle cx="${bx}" cy="${by - 260}" r="15" fill="#39ff14" filter="drop-shadow(0 0 10px #39ff14)"/>
        ${actionOverlays}
      </g>
    `;
  }

  // Bug mascot builder
  if (drawBug && bugData) {
    const gx = 780;
    const gy = 1180;
    const emotion = bugData.emotion.toLowerCase();

    let bugEyes = `<circle cx="${gx - 30}" cy="${gy - 90}" r="22" fill="#ffffff" stroke="#052e16" stroke-width="4"/>
                   <circle cx="${gx - 30}" cy="${gy - 90}" r="8" fill="#000000"/>
                   <circle cx="${gx + 30}" cy="${gy - 90}" r="22" fill="#ffffff" stroke="#052e16" stroke-width="4"/>
                   <circle cx="${gx + 30}" cy="${gy - 90}" r="8" fill="#000000"/>`;
    let bugMouth = `<path d="M ${gx - 10} ${gy - 45} Q ${gx} ${gy - 38} ${gx + 10} ${gy - 45}" stroke="#052e16" stroke-width="5" fill="none" stroke-linecap="round"/>`;

    if (emotion === 'shock' || emotion === 'surprised' || emotion === 'shocked' || emotion === 'panic') {
      bugEyes = `<circle cx="${gx - 30}" cy="${gy - 95}" r="28" fill="#ffffff" stroke="#052e16" stroke-width="4"/>
                 <circle cx="${gx - 30}" cy="${gy - 95}" r="12" fill="#000000"/>
                 <circle cx="${gx + 30}" cy="${gy - 95}" r="28" fill="#ffffff" stroke="#052e16" stroke-width="4"/>
                 <circle cx="${gx + 30}" cy="${gy - 95}" r="12" fill="#000000"/>`;
      bugMouth = `<ellipse cx="${gx}" cy="${gy - 42}" rx="14" ry="18" fill="#052e16"/>`;
    } else if (emotion === 'confused') {
      bugEyes = `<path d="M ${gx - 45} ${gy - 105} Q ${gx - 30} ${gy - 80} ${gx - 15} ${gy - 105}" stroke="#052e16" stroke-width="6" fill="none" stroke-linecap="round"/>
                 <path d="M ${gx + 15} ${gy - 105} Q ${gx + 30} ${gy - 80} ${gx + 45} ${gy - 105}" stroke="#052e16" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      bugMouth = `<path d="M ${gx - 15} ${gy - 45} L ${gx + 15} ${gy - 45}" stroke="#052e16" stroke-width="5"/>`;
    }

    let actionOverlays = '';
    // Trapped capsule overlay
    if (bugAction.includes('trap') || bugAction.includes('inside')) {
      actionOverlays += `
        <!-- Glass containment capsule trapped Bug -->
        <rect x="${gx - 140}" y="${gy - 220}" width="280" height="430" rx="140" fill="rgba(0, 242, 254, 0.08)" stroke="#ff3366" stroke-width="8" stroke-dasharray="12, 6" filter="drop-shadow(0 0 20px #ff3366)"/>
        <text x="${gx}" y="${gy - 240}" fill="#ff3366" font-family="'Outfit', sans-serif" font-size="28" font-weight="900" text-anchor="middle" filter="drop-shadow(0 0 5px #ff3366)">LOCKED</text>
      `;
    }
    if (bugAction.includes('fall') || bugAction.includes('drop')) {
      actionOverlays += `
        <!-- Sweat bubbles and speed trails -->
        <path d="M ${gx - 80} ${gy - 120} Q ${gx - 100} ${gy - 100} ${gx - 80} ${gy - 80}" fill="none" stroke="#00f2fe" stroke-width="5" stroke-linecap="round"/>
        <path d="M ${gx + 80} ${gy - 120} Q ${gx + 100} ${gy - 100} ${gx + 80} ${gy - 80}" fill="none" stroke="#00f2fe" stroke-width="5" stroke-linecap="round"/>
      `;
    }
    if (bugAction.includes('celebrate') || bugAction.includes('jump')) {
      actionOverlays += `
        <!-- Celebrating sparkles -->
        <path d="M ${gx - 110} ${gy - 180} L ${gx - 90} ${gy - 150} L ${gx - 60} ${gy - 140} L ${gx - 90} ${gy - 130} L ${gx - 100} ${gy - 100} Z" fill="#ffdf00"/>
        <path d="M ${gx + 110} ${gy - 180} L ${gx + 90} ${gy - 150} L ${gx + 60} ${gy - 140} L ${gx + 90} ${gy - 130} L ${gx + 100} ${gy - 100} Z" fill="#ffdf00"/>
      `;
    }

    const bugTransform = `translate(${bugX - gx}, ${bugY - gy}) scale(${bugScale}) rotate(${bugRot}, ${gx}, ${gy})`;

    bugSvg = `
      <!-- BUG MASCOT -->
      <g transform="${bugTransform}">
        <ellipse cx="${gx}" cy="${gy + 160}" rx="90" ry="18" fill="rgba(0,0,0,0.5)" filter="blur(6px)"/>
        <ellipse cx="${gx - 65}" cy="${gy - 10}" rx="45" ry="70" fill="rgba(255,255,255,0.4)" stroke="rgba(255,255,255,0.6)" stroke-width="2" transform="rotate(-15, ${gx - 65}, ${gy - 10})"/>
        <ellipse cx="${gx + 65}" cy="${gy - 10}" rx="45" ry="70" fill="rgba(255,255,255,0.4)" stroke="rgba(255,255,255,0.6)" stroke-width="2" transform="rotate(15, ${gx + 65}, ${gy - 10})"/>
        <rect x="${gx - 62}" y="${gy - 10}" width="124" height="24" rx="8" fill="#fbbf24" stroke="#052e16" stroke-width="2"/>
        <ellipse cx="${gx}" cy="${gy + 40}" rx="80" ry="100" fill="url(#bugBodyGrad)" stroke="#052e16" stroke-width="4"/>
        <line x1="${gx - 40}" y1="${gy + 130}" x2="${gx - 55}" y2="${gy + 160}" stroke="#052e16" stroke-width="6" stroke-linecap="round"/>
        <line x1="${gx + 40}" y1="${gy + 130}" x2="${gx + 55}" y2="${gy + 160}" stroke="#052e16" stroke-width="6" stroke-linecap="round"/>
        <circle cx="${gx}" cy="${gy - 60}" r="65" fill="url(#bugHeadGrad)" stroke="#052e16" stroke-width="4"/>
        ${bugEyes}
        ${bugMouth}
        <path d="M ${gx - 20} ${gy - 120} Q ${gx - 40} ${gy - 160} ${gx - 60} ${gy - 150}" fill="none" stroke="#052e16" stroke-width="6" stroke-linecap="round"/>
        <circle cx="${gx - 60}" cy="${gy - 150}" r="8" fill="#fbbf24"/>
        <path d="M ${gx + 20} ${gy - 120} Q ${gx + 40} ${gy - 160} ${gx + 60} ${gy - 150}" fill="none" stroke="#052e16" stroke-width="6" stroke-linecap="round"/>
        <circle cx="${gx + 60}" cy="${gy - 150}" r="8" fill="#fbbf24"/>
        ${actionOverlays}
      </g>
    `;
  }

  // 5. Camera Transform grouping
  const cameraShot = (camera.shot || 'wide').toLowerCase();
  let cameraTransform = 'translate(0, 0) scale(1)';

  if (cameraShot.includes('close')) {
    const focusX = input.speaker === 'Bug' ? bugX : byteX;
    const focusY = input.speaker === 'Bug' ? bugY : byteY;
    cameraTransform = `translate(${540 - focusX * 1.8}, ${960 - focusY * 1.8}) scale(1.8)`;
  } else if (cameraShot.includes('medium')) {
    const midX = (byteX + bugX) / 2;
    const midY = (byteY + bugY) / 2;
    cameraTransform = `translate(${540 - midX * 1.3}, ${960 - midY * 1.3}) scale(1.3)`;
  } else if (cameraShot.includes('overhead')) {
    cameraTransform = `translate(54, 192) scale(0.9)`;
  } else if (cameraShot.includes('pov')) {
    const focusX = input.speaker === 'Bug' ? byteX : bugX;
    const focusY = input.speaker === 'Bug' ? byteY : bugY;
    cameraTransform = `translate(${540 - focusX * 2.0}, ${960 - focusY * 2.0}) scale(2.0)`;
  }

  // Generate HUD overlay labels
  const overlayLabels = `
    <!-- CINEMATIC HUD -->
    <rect x="50" y="50" width="980" height="140" rx="20" fill="rgba(15, 18, 28, 0.72)" stroke="rgba(255,255,255,0.06)" stroke-width="2" filter="backdrop-filter(blur(10px))"/>
    
    <text x="80" y="105" fill="#8b949e" font-family="'Outfit', sans-serif" font-size="20" font-weight="700" letter-spacing="1">STORY BEAT</text>
    <text x="80" y="145" fill="#ffffff" font-family="'Outfit', sans-serif" font-size="32" font-weight="900" letter-spacing="0.5">${input.storyBeat.toUpperCase()}</text>
    
    <text x="360" y="105" fill="#8b949e" font-family="'Outfit', sans-serif" font-size="20" font-weight="700" letter-spacing="1">ENVIRONMENT</text>
    <text x="360" y="145" fill="${accentColor}" font-family="'Outfit', sans-serif" font-size="28" font-weight="900" letter-spacing="0.5">${envLabelText.toUpperCase()}</text>
    
    <text x="820" y="105" fill="#8b949e" font-family="'Outfit', sans-serif" font-size="20" font-weight="700" letter-spacing="1">CAMERA SHOT</text>
    <text x="820" y="145" fill="#ffffff" font-family="'Outfit', sans-serif" font-size="28" font-weight="900" letter-spacing="0.5">${camera.shot.toUpperCase()}</text>
  `;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="100%" height="100%">
      <defs>
        <!-- Background Gradient -->
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bgGradientStart}"/>
          <stop offset="100%" stop-color="${bgGradientEnd}"/>
        </linearGradient>
        
        <!-- Byte Robot Gradients -->
        <linearGradient id="byteHeadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
        <linearGradient id="byteBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00f2fe"/>
          <stop offset="100%" stop-color="#4facfe"/>
        </linearGradient>
        
        <!-- Bug Gradients -->
        <linearGradient id="bugHeadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#86efac"/>
          <stop offset="100%" stop-color="#22c55e"/>
        </linearGradient>
        <linearGradient id="bugBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#22c55e"/>
          <stop offset="100%" stop-color="#15803d"/>
        </linearGradient>
        
        <!-- Grid Filter pattern -->
        <pattern id="gridPattern" width="90" height="90" patternUnits="userSpaceOnUse">
          <path d="M 90 0 L 0 0 0 90" fill="none" stroke="${gridColor}" stroke-width="2"/>
        </pattern>
      </defs>
      
      <!-- Base Background (always full screen) -->
      <rect width="1080" height="1920" fill="url(#bgGrad)"/>
      <rect width="1080" height="1920" fill="url(#gridPattern)"/>
      
      <!-- Spotlight -->
      <circle cx="540" cy="960" r="800" fill="radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 80%)" opacity="0.3"/>

      <!-- Camera viewport grouping (Apply zooms / tilts here) -->
      <g transform="${cameraTransform}">
        <!-- 1. Environment Elements -->
        ${environmentSvg}
        
        <!-- 2. Character SVG Models -->
        ${byteSvg}
        ${bugSvg}
      </g>
      
      <!-- 3. Cinematic Overlay HUD -->
      ${overlayLabels}
    </svg>
  `;
}
