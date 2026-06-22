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
  stylePack?: {
    id: string;
    palette: {
      background: string;
      foreground: string;
      accent: string;
      danger: string;
      success: string;
    };
    typography: string;
    backgroundType: string;
    glowIntensity: number;
  };
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
 * Composes high-fidelity prompts for Imagen 4/DALL-E 3 using the Byte & Bug Character Bible.
 *
 * BYTE: Female teenager, bright blue hoodie, long flowing black hair, large expressive eyes.
 *       Voice: warm female (EmmaNeural). Always shocked/confused/curious.
 *
 * BUG:  Male teenager, red hoodie with small bug antenna on hood, confident wide grin.
 *       Voice: energetic male (AndrewNeural). Always confident/sarcastic/dramatic.
 */
function composeImagePrompt(scene: ImageGeneratorInput): string {
  const envDesc = `${scene.environment.name}: ${scene.environment.description}.`;
  const stylePack = scene.stylePack;
  const technicalStyle = buildTechnicalComicStyle(stylePack);

  const charsDesc = scene.characters.map((c) => {
    const poseDesc = (c as any).pose || c.action;
    if (c.name === 'Byte') {
      // Byte = FEMALE — long black hair, feminine features, blue hoodie
      return `Byte (a young teenage girl wearing a bright electric-blue hoodie, long flowing black hair with side-swept bangs, large round expressive dark eyes showing ${c.emotion}, soft feminine features, ${poseDesc}). Byte is clearly female. Byte occupies 30-40% of the frame in the foreground, reacting with exaggerated comic expression.`;
    } else {
      // Bug = MALE — red hoodie, antenna, confident grin
      return `Bug (a young teenage boy wearing a vibrant red hoodie with a small cute bug antenna sticking out of the hood, confident wide grin showing ${c.emotion}, ${poseDesc}). Bug is clearly male. Bug occupies 30-40% of the frame, gesturing dramatically.`;
    }
  }).join(' ');

  const cameraDesc = `Camera: ${scene.camera.shot.replace('_', ' ')} shot with ${scene.camera.motion.replace('_', ' ')} motion.`;

  const speakerFocus = scene.speaker === 'Byte'
    ? 'Focus on Byte (female, blue hoodie, long black hair) in the foreground looking shocked/confused.'
    : 'Focus on Bug (male, red hoodie, antenna) in the foreground explaining dramatically.';

  return `Vertical 9:16 composition. ${technicalStyle} The image must fill the entire vertical frame without borders or panels. Environment (60-70% of frame): ${envDesc} Characters (30-40% of frame): ${charsDesc || 'No characters in this scene.'} ${speakerFocus} ${cameraDesc} NO written text, words, letters, labels, captions, logos, or UI labels anywhere. No superhero movie look. No city-swinging visual language. No Pixar 3D. No photorealistic rendering. Pure 2D technical comic animation, high contrast, clean developer-focused visual metaphor.`;
}

function buildTechnicalComicStyle(stylePack?: ImageGeneratorInput['stylePack']): string {
  const base = 'TECHNICAL 2D COMIC ANIMATION STYLE for software engineering education. Use bold ink outlines, clean vector-like shapes, readable architecture-diagram silhouettes, code-editor and terminal-inspired surfaces without readable text, network paths, server blocks, data packets, database cylinders, queues, caches, APIs, and cloud infrastructure as visual metaphors. Use halftone texture sparingly, precise speed lines for data flow, and comic impact frames only for technical failure or reveal moments.';

  if (!stylePack) {
    return `${base} Palette: dark technical background, electric cyan and green accents, restrained warning colors.`;
  }

  const palette = `Palette: background ${stylePack.palette.background}, foreground ${stylePack.palette.foreground}, accent ${stylePack.palette.accent}, danger ${stylePack.palette.danger}, success ${stylePack.palette.success}.`;

  switch (stylePack.id) {
    case 'terminal':
      return `${base} Terminal comic variant: dark shell-like spaces, monospace-inspired block shapes, command-line panels with abstract unreadable glyphs, green data streams, minimal glow. ${palette}`;
    case 'infographic':
      return `${base} Infographic comic variant: clean light technical canvas, structured comparison shapes, charts, timelines, arrows, architecture blocks, restrained ink lines, low glow. ${palette}`;
    case 'minimal':
      return `${base} Minimal technical comic variant: sparse composition, editorial shapes, fewer textures, crisp arrows, focused single metaphor, muted glow. ${palette}`;
    case 'cyberpunk':
    default:
      return `${base} Cyberpunk developer comic variant: dark grid spaces, neon data flows, API gateways, server corridors, luminous packets, high energy but still technical. ${palette}`;
  }
}

/**
 * Programmatic SVG generator drawing Byte and Bug as comic-style hoodie-wearing humans
 * inside thematic backgrounds with dynamic poses, motion streaks, impact frames,
 * and halftone textures consistent with a technical comic animation aesthetic.
 *
 * BYTE: Blue hoodie human. Bug antenna NOT present. Shocked/curious/confused expressions.
 * BUG:  Red hoodie human with small bug antenna on hood. Confident grin. Energetic poses.
 */
function drawSvgMascotScene(input: ImageGeneratorInput): string {
  const { environment, characters, camera } = input;
  const envName = environment.name.toLowerCase();

  const byteData = characters.find(c => c.name === 'Byte');
  const bugData = characters.find(c => c.name === 'Bug');
  const drawByte = Boolean(byteData);
  const drawBug = Boolean(bugData);

  const byteEmotion = (byteData?.emotion || 'curious').toLowerCase();
  const bugEmotion = (bugData?.emotion || 'confident').toLowerCase();
  const byteAction = (byteData?.action || '').toLowerCase();
  const bugAction = (bugData?.action || '').toLowerCase();

  // ==========================================================================
  // 1. ENVIRONMENT THEME DETECTION & PALETTE
  // ==========================================================================
  const isKafka = envName.includes('factory') || envName.includes('belt') || envName.includes('kafka');
  const isRedis = envName.includes('vault') || envName.includes('memory') || envName.includes('speed') || envName.includes('redis');
  const isK8s = envName.includes('kubernetes') || envName.includes('docker') || envName.includes('container') || envName.includes('pod');
  const isCloud = envName.includes('cloud') || envName.includes('aws') || envName.includes('server') || envName.includes('crash');
  const isAI = envName.includes('ai') || envName.includes('llm') || envName.includes('predict') || envName.includes('gpt');

  let bgColor1 = '#04050f';
  let bgColor2 = '#0b0d2a';
  let accentColor = '#00aaff';
  let accentColor2 = '#ffd60a';
  let gridColor = 'rgba(0, 170, 255, 0.06)';
  let envLabel = 'DIGITAL WORLD';

  if (isKafka) {
    bgColor1 = '#050f04'; bgColor2 = '#0d1f0b';
    accentColor = '#39ff14'; accentColor2 = '#ffd60a';
    gridColor = 'rgba(57,255,20,0.05)';
    envLabel = 'KAFKA FACTORY';
  } else if (isRedis) {
    bgColor1 = '#0f0a00'; bgColor2 = '#1a1200';
    accentColor = '#ffd60a'; accentColor2 = '#ff6b00';
    gridColor = 'rgba(255,214,10,0.05)';
    envLabel = 'MEMORY VAULT';
  } else if (isK8s) {
    bgColor1 = '#060010'; bgColor2 = '#12001f';
    accentColor = '#bf5fff'; accentColor2 = '#00f5c4';
    gridColor = 'rgba(191,95,255,0.05)';
    envLabel = 'K8S CITY';
  } else if (isCloud) {
    bgColor1 = '#000d1a'; bgColor2 = '#001529';
    accentColor = '#00d4ff'; accentColor2 = '#ff3b3b';
    gridColor = 'rgba(0,212,255,0.05)';
    envLabel = 'CLOUD SERVERS';
  } else if (isAI) {
    bgColor1 = '#050010'; bgColor2 = '#0b0020';
    accentColor = '#a855f7'; accentColor2 = '#00d4ff';
    gridColor = 'rgba(168,85,247,0.05)';
    envLabel = 'AI GRID';
  }

  // ==========================================================================
  // 2. ENVIRONMENT VISUAL ELEMENTS (Comic style: bold outlines, halftones)
  // ==========================================================================
  let environmentSvg = '';

  if (isKafka) {
    environmentSvg = `
      <!-- Comic Kafka Factory: conveyor belts, data packets, partition gates -->
      <!-- Halftone background dots -->
      <pattern id="htDots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="2.5" fill="${accentColor}" opacity="0.12"/>
      </pattern>
      <rect width="1080" height="1920" fill="url(#htDots)"/>

      <!-- Main conveyor belt (bold outline comic style) -->
      <rect x="0" y="880" width="1080" height="80" rx="0" fill="#1a2200" stroke="${accentColor}" stroke-width="6"/>
      <line x1="0" y1="900" x2="1080" y2="900" stroke="${accentColor}" stroke-width="3" stroke-dasharray="40,20" opacity="0.9"/>
      <line x1="0" y1="940" x2="1080" y2="940" stroke="${accentColor}" stroke-width="3" stroke-dasharray="40,20" opacity="0.9"/>

      <!-- Speed lines (motion streaks) -->
      <g stroke="${accentColor}" stroke-width="4" opacity="0.25">
        <line x1="-50" y1="600" x2="400" y2="600"/>
        <line x1="-50" y1="640" x2="600" y2="640"/>
        <line x1="-50" y1="680" x2="300" y2="680"/>
        <line x1="680" y1="600" x2="1130" y2="600"/>
        <line x1="780" y1="650" x2="1130" y2="650"/>
      </g>

      <!-- Data packets on belt (bright bold squares) -->
      <g filter="drop-shadow(0 0 12px ${accentColor})">
        <rect x="120" y="890" width="60" height="60" rx="8" fill="${accentColor}" stroke="#000" stroke-width="3"/>
        <rect x="380" y="888" width="70" height="64" rx="8" fill="${accentColor2}" stroke="#000" stroke-width="3"/>
        <rect x="680" y="892" width="55" height="56" rx="8" fill="${accentColor}" stroke="#000" stroke-width="3"/>
        <rect x="900" y="886" width="65" height="68" rx="8" fill="${accentColor2}" stroke="#000" stroke-width="3"/>
      </g>

      <!-- Partition gate structure -->
      <rect x="430" y="560" width="220" height="300" rx="12" fill="rgba(10,34,0,0.85)" stroke="${accentColor}" stroke-width="8"/>
      <rect x="450" y="580" width="180" height="40" rx="6" fill="${accentColor}" opacity="0.2"/>
    `;
  } else if (isRedis) {
    environmentSvg = `
      <!-- Comic Redis Vault: concentric rings, lightning bolts, speed trails -->
      <pattern id="htDots" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
        <circle cx="9" cy="9" r="2" fill="${accentColor}" opacity="0.1"/>
      </pattern>
      <rect width="1080" height="1920" fill="url(#htDots)"/>

      <!-- Vault rings (bold outlines) -->
      <circle cx="540" cy="820" r="320" fill="none" stroke="${accentColor}" stroke-width="10" stroke-dasharray="30,20" opacity="0.6"/>
      <circle cx="540" cy="820" r="220" fill="none" stroke="${accentColor2}" stroke-width="8" opacity="0.5"/>
      <circle cx="540" cy="820" r="100" fill="${accentColor}" opacity="0.12" stroke="${accentColor}" stroke-width="6"/>

      <!-- Lightning bolts (comic style) -->
      <g fill="${accentColor2}" stroke="#000" stroke-width="3" filter="drop-shadow(0 0 8px ${accentColor2})">
        <polygon points="100,400 140,550 110,550 150,700" />
        <polygon points="940,380 980,530 950,530 990,680" />
      </g>

      <!-- Speed trails (horizontal motion lines) -->
      <g stroke="${accentColor}" opacity="0.3">
        <line x1="0" y1="1100" x2="1080" y2="1100" stroke-width="6"/>
        <line x1="0" y1="1120" x2="800" y2="1120" stroke-width="4"/>
        <line x1="200" y1="1140" x2="1080" y2="1140" stroke-width="4"/>
      </g>
    `;
  } else if (isK8s) {
    environmentSvg = `
      <!-- Comic K8s City: floating container pods, service bridges -->
      <pattern id="htDots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="11" cy="11" r="2.5" fill="${accentColor}" opacity="0.09"/>
      </pattern>
      <rect width="1080" height="1920" fill="url(#htDots)"/>

      <!-- Container blocks (comic bold rectangles) -->
      <g stroke="${accentColor}" stroke-width="6" fill="rgba(100,0,200,0.08)">
        <rect x="50" y="500" width="260" height="160" rx="12"/>
        <rect x="50" y="680" width="260" height="160" rx="12"/>
        <rect x="770" y="520" width="260" height="160" rx="12"/>
        <rect x="770" y="700" width="260" height="160" rx="12"/>
      </g>

      <!-- Service connection lines (comic dashed) -->
      <g stroke="${accentColor2}" stroke-width="6" fill="none" stroke-dasharray="20,14" opacity="0.7">
        <line x1="310" y1="590" x2="770" y2="590"/>
        <line x1="310" y1="760" x2="770" y2="760"/>
        <line x1="180" y1="660" x2="180" y2="700"/>
        <line x1="900" y1="680" x2="900" y2="700"/>
      </g>

      <!-- Pod status circles -->
      <g filter="drop-shadow(0 0 10px ${accentColor})">
        <circle cx="180" cy="590" r="30" fill="${accentColor}" stroke="#000" stroke-width="4"/>
        <circle cx="900" cy="590" r="30" fill="${accentColor}" stroke="#000" stroke-width="4"/>
      </g>
    `;
  } else if (isCloud) {
    environmentSvg = `
      <!-- Comic Cloud: server towers, data highways, alert sirens -->
      <pattern id="htDots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="2" fill="${accentColor}" opacity="0.1"/>
      </pattern>
      <rect width="1080" height="1920" fill="url(#htDots)"/>

      <!-- Server rack towers (comic bold) -->
      <g stroke="${accentColor}" stroke-width="6" fill="rgba(0,30,60,0.8)">
        <rect x="80" y="450" width="160" height="480" rx="12"/>
        <rect x="460" y="380" width="160" height="550" rx="12"/>
        <rect x="840" y="470" width="160" height="460" rx="12"/>
      </g>

      <!-- Rack LED details -->
      <g fill="${accentColor}" filter="drop-shadow(0 0 6px ${accentColor})">
        <rect x="100" y="490" width="120" height="8" rx="4"/>
        <rect x="100" y="520" width="120" height="8" rx="4"/>
        <rect x="100" y="550" width="80" height="8" rx="4"/>
        <rect x="480" y="420" width="120" height="8" rx="4"/>
        <rect x="480" y="450" width="120" height="8" rx="4"/>
      </g>

      <!-- Alert siren (comic red burst) -->
      <g transform="translate(540, 280)" filter="drop-shadow(0 0 16px #ff3b3b)">
        <circle cx="0" cy="0" r="60" fill="#ff3b3b" stroke="#000" stroke-width="6"/>
        <!-- Comic impact spikes -->
        <polygon points="0,-80 8,-65 0,-55 -8,-65" fill="#ff3b3b" stroke="#000" stroke-width="3"/>
        <polygon points="80,0 65,8 55,0 65,-8" fill="#ff3b3b" stroke="#000" stroke-width="3"/>
        <polygon points="0,80 8,65 0,55 -8,65" fill="#ff3b3b" stroke="#000" stroke-width="3"/>
        <polygon points="-80,0 -65,8 -55,0 -65,-8" fill="#ff3b3b" stroke="#000" stroke-width="3"/>
        <polygon points="57,-57 48,-42 38,-52 52,-62" fill="#ff3b3b" stroke="#000" stroke-width="3"/>
        <polygon points="57,57 42,48 52,38 62,52" fill="#ff3b3b" stroke="#000" stroke-width="3"/>
      </g>

      <!-- Data highway (bold lines across) -->
      <line x1="240" y1="700" x2="460" y2="700" stroke="${accentColor2}" stroke-width="8" stroke-dasharray="25,15" opacity="0.8"/>
      <line x1="620" y1="700" x2="840" y2="700" stroke="${accentColor2}" stroke-width="8" stroke-dasharray="25,15" opacity="0.8"/>
    `;
  } else {
    // Generic digital grid
    environmentSvg = `
      <pattern id="htDots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="12" cy="12" r="2" fill="${accentColor}" opacity="0.1"/>
      </pattern>
      <rect width="1080" height="1920" fill="url(#htDots)"/>

      <!-- Digital grid lines -->
      <g stroke="${accentColor}" stroke-width="2" opacity="0.2">
        <line x1="360" y1="0" x2="360" y2="1920"/>
        <line x1="720" y1="0" x2="720" y2="1920"/>
        <line x1="0" y1="640" x2="1080" y2="640"/>
        <line x1="0" y1="1280" x2="1080" y2="1280"/>
      </g>

      <!-- Floating data nodes -->
      <g filter="drop-shadow(0 0 12px ${accentColor})">
        <circle cx="180" cy="500" r="40" fill="none" stroke="${accentColor}" stroke-width="6"/>
        <circle cx="540" cy="350" r="55" fill="none" stroke="${accentColor2}" stroke-width="6"/>
        <circle cx="900" cy="500" r="40" fill="none" stroke="${accentColor}" stroke-width="6"/>
        <circle cx="180" cy="1200" r="35" fill="none" stroke="${accentColor}" stroke-width="5"/>
        <circle cx="900" cy="1200" r="35" fill="none" stroke="${accentColor}" stroke-width="5"/>
      </g>

      <!-- Connection lines -->
      <g stroke="${accentColor}" stroke-width="4" stroke-dasharray="16,10" opacity="0.4">
        <line x1="180" y1="500" x2="540" y2="350"/>
        <line x1="540" y1="350" x2="900" y2="500"/>
        <line x1="180" y1="1200" x2="540" y2="1350"/>
        <line x1="900" y1="1200" x2="540" y2="1350"/>
      </g>
    `;
  }

  // ==========================================================================
  // 3. CHARACTER POSITIONS (based on speaker and actions)
  // ==========================================================================
  let byteX = 240, byteY = 1350;
  let bugX = 840, bugY = 1350;

  // Swap sides if Bug is speaking
  if (input.speaker === 'Bug') {
    bugX = 300; byteX = 800;
  }

  // Dynamic pose adjustments
  if (byteAction.includes('jump') || byteAction.includes('leap')) { byteY -= 120; }
  if (bugAction.includes('lean') || bugAction.includes('forward')) { bugX -= 40; }
  if (byteAction.includes('run') || bugAction.includes('run')) {
    byteY -= 40; bugY -= 40;
  }

  // ==========================================================================
  // 4. BYTE CHARACTER SVG (Blue hoodie human)
  // ==========================================================================
  let byteSvg = '';
  if (drawByte) {
    const isShocked = byteEmotion === 'shocked' || byteEmotion === 'surprised';
    const isConfused = byteEmotion === 'confused';
    const isExcited = byteEmotion === 'excited' || byteEmotion === 'curious';

    // Face expression
    let byteEyesPath = '';
    let byteMouthPath = '';
    let byteExtras = '';

    if (isShocked) {
      // Wide-open eyes, round "O" mouth
      byteEyesPath = `
        <ellipse cx="-32" cy="-48" rx="22" ry="26" fill="#fff" stroke="#000" stroke-width="4"/>
        <circle cx="-32" cy="-44" r="10" fill="#1a1a1a"/>
        <ellipse cx="32" cy="-48" rx="22" ry="26" fill="#fff" stroke="#000" stroke-width="4"/>
        <circle cx="32" cy="-44" r="10" fill="#1a1a1a"/>`;
      byteMouthPath = `<ellipse cx="0" cy="-10" rx="16" ry="20" fill="#cc0000" stroke="#000" stroke-width="3"/>`;
      // Shock lines radiating from head
      byteExtras = `
        <g stroke="${accentColor}" stroke-width="5" stroke-linecap="round" opacity="0.85">
          <line x1="-90" y1="-120" x2="-120" y2="-155"/>
          <line x1="0" y1="-130" x2="0" y2="-170"/>
          <line x1="90" y1="-120" x2="120" y2="-155"/>
          <line x1="-110" y1="-60" x2="-150" y2="-60"/>
          <line x1="110" y1="-60" x2="150" y2="-60"/>
        </g>
        <!-- Comic exclamation bubble -->
        <g transform="translate(80, -170)">
          <circle cx="0" cy="0" r="30" fill="${accentColor2}" stroke="#000" stroke-width="5"/>
          <text x="0" y="12" fill="#000" font-family="Impact, Arial Black, sans-serif" font-size="36" font-weight="900" text-anchor="middle">!</text>
        </g>`;
    } else if (isConfused) {
      // Squiggly eyes (one normal, one X-shaped), slanted mouth
      byteEyesPath = `
        <ellipse cx="-32" cy="-48" rx="18" ry="20" fill="#fff" stroke="#000" stroke-width="4"/>
        <circle cx="-32" cy="-44" r="8" fill="#1a1a1a"/>
        <!-- X eye (confused) -->
        <line x1="20" y1="-65" x2="44" y2="-33" stroke="#000" stroke-width="6" stroke-linecap="round"/>
        <line x1="44" y1="-65" x2="20" y2="-33" stroke="#000" stroke-width="6" stroke-linecap="round"/>`;
      byteMouthPath = `<path d="M -18 -8 Q 0 -18 18 -5" stroke="#000" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      // Sweat drop + question mark
      byteExtras = `
        <g transform="translate(90, -160)">
          <circle cx="0" cy="0" r="28" fill="${accentColor}" stroke="#000" stroke-width="4"/>
          <text x="0" y="10" fill="#000" font-family="Impact, Arial Black, sans-serif" font-size="30" font-weight="900" text-anchor="middle">?</text>
        </g>
        <!-- Sweat drop -->
        <ellipse cx="-90" cy="-80" rx="10" ry="14" fill="#00aaff" stroke="#000" stroke-width="3" transform="rotate(20 -90 -80)"/>`;
    } else {
      // Happy/curious eyes
      byteEyesPath = `
        <ellipse cx="-32" cy="-48" rx="18" ry="20" fill="#fff" stroke="#000" stroke-width="4"/>
        <circle cx="-32" cy="-44" r="8" fill="#1a1a1a"/>
        <circle cx="-26" cy="-48" r="4" fill="#fff"/>
        <ellipse cx="32" cy="-48" rx="18" ry="20" fill="#fff" stroke="#000" stroke-width="4"/>
        <circle cx="32" cy="-44" r="8" fill="#1a1a1a"/>
        <circle cx="38" cy="-48" r="4" fill="#fff"/>`;
      byteMouthPath = `<path d="M -16 -6 Q 0 8 16 -6" stroke="#000" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    }

    // Motion streaks under feet if running
    const byteMotion = (byteAction.includes('run') || byteAction.includes('jump'))
      ? `<g stroke="${accentColor}" stroke-width="4" opacity="0.5" stroke-linecap="round">
          <line x1="-80" y1="200" x2="-180" y2="200"/>
          <line x1="-60" y1="220" x2="-160" y2="220"/>
          <line x1="-70" y1="240" x2="-140" y2="240"/>
        </g>` : '';

    byteSvg = `
    <!-- ======= BYTE (Blue Hoodie Human) ======= -->
    <g transform="translate(${byteX}, ${byteY})" filter="drop-shadow(0 8px 24px rgba(0,170,255,0.4))">
      <!-- Ground shadow -->
      <ellipse cx="0" cy="220" rx="90" ry="18" fill="rgba(0,0,0,0.5)" filter="blur(8px)"/>

      ${byteMotion}

      <!-- LEGS -->
      <rect x="-42" y="120" width="36" height="100" rx="16" fill="#334a6b" stroke="#000" stroke-width="5"/>
      <rect x="10" y="120" width="36" height="100" rx="16" fill="#334a6b" stroke="#000" stroke-width="5"/>
      <!-- Shoes -->
      <ellipse cx="-24" cy="220" rx="32" ry="14" fill="#1a1a1a" stroke="#000" stroke-width="4"/>
      <ellipse cx="28" cy="220" rx="32" ry="14" fill="#1a1a1a" stroke="#000" stroke-width="4"/>

      <!-- BODY (blue hoodie) -->
      <rect x="-70" y="-20" width="140" height="150" rx="30" fill="#0088dd" stroke="#000" stroke-width="7"/>
      <!-- Hoodie pocket -->
      <rect x="-35" y="80" width="70" height="45" rx="12" fill="rgba(0,0,0,0.2)" stroke="#000" stroke-width="4"/>
      <!-- Hoodie draw strings -->
      <line x1="-12" y1="0" x2="-18" y2="50" stroke="#fff" stroke-width="3" opacity="0.5"/>
      <line x1="12" y1="0" x2="18" y2="50" stroke="#fff" stroke-width="3" opacity="0.5"/>

      <!-- ARMS -->
      <rect x="-120" y="-10" width="55" height="30" rx="14" fill="#0088dd" stroke="#000" stroke-width="6" transform="rotate(30 -92 5)"/>
      <rect x="68" y="-10" width="55" height="30" rx="14" fill="#0088dd" stroke="#000" stroke-width="6" transform="rotate(-20 95 5)"/>
      <!-- Hands -->
      <circle cx="-130" cy="50" r="22" fill="#f0c896" stroke="#000" stroke-width="5"/>
      <circle cx="130" cy="40" r="22" fill="#f0c896" stroke="#000" stroke-width="5"/>

      <!-- NECK -->
      <rect x="-18" y="-90" width="36" height="50" rx="10" fill="#f0c896" stroke="#000" stroke-width="4"/>

      <!-- HEAD -->
      <ellipse cx="0" cy="-135" rx="75" ry="80" fill="#f0c896" stroke="#000" stroke-width="7"/>

      <!-- BLACK MESSY HAIR -->
      <ellipse cx="0" cy="-205" rx="78" ry="50" fill="#1a1a1a" stroke="#000" stroke-width="4"/>
      <!-- Hair tufts -->
      <ellipse cx="-55" cy="-195" rx="30" ry="35" fill="#1a1a1a" stroke="#000" stroke-width="3"/>
      <ellipse cx="55" cy="-190" rx="28" ry="30" fill="#1a1a1a" stroke="#000" stroke-width="3"/>
      <ellipse cx="20" cy="-225" rx="22" ry="28" fill="#1a1a1a" stroke="#000" stroke-width="3"/>
      <ellipse cx="-20" cy="-228" rx="18" ry="24" fill="#1a1a1a" stroke="#000" stroke-width="3"/>

      <!-- FACE: Eyes -->
      <g transform="translate(0, -135)">
        ${byteEyesPath}
        ${byteMouthPath}
        ${byteExtras}
        <!-- Blush marks -->
        <ellipse cx="-55" cy="-20" rx="16" ry="10" fill="#ff8faa" opacity="0.45"/>
        <ellipse cx="55" cy="-20" rx="16" ry="10" fill="#ff8faa" opacity="0.45"/>
      </g>
    </g>`;
  }

  // ==========================================================================
  // 5. BUG CHARACTER SVG (Red hoodie human with antenna)
  // ==========================================================================
  let bugSvg = '';
  if (drawBug) {
    const isConfident = bugEmotion === 'confident' || bugEmotion === 'explaining';
    const isDramatic = bugEmotion === 'dramatic' || bugEmotion === 'sarcastic';
    const isFunny = bugEmotion === 'funny' || bugEmotion === 'excited';

    let bugEyesPath = '';
    let bugMouthPath = '';
    let bugExtras = '';

    if (isConfident || isFunny) {
      // Half-closed confident eyes, wide grin
      bugEyesPath = `
        <path d="M -50 -60 Q -32 -72 -14 -60" stroke="#000" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="-32" cy="-48" rx="16" ry="14" fill="#fff" stroke="#000" stroke-width="4"/>
        <circle cx="-32" cy="-44" r="7" fill="#1a1a1a"/>
        <path d="M 14 -60 Q 32 -72 50 -60" stroke="#000" stroke-width="7" fill="none" stroke-linecap="round"/>
        <ellipse cx="32" cy="-48" rx="16" ry="14" fill="#fff" stroke="#000" stroke-width="4"/>
        <circle cx="32" cy="-44" r="7" fill="#1a1a1a"/>`;
      bugMouthPath = `
        <!-- Big confident grin -->
        <path d="M -30 -10 Q 0 18 30 -10" stroke="#000" stroke-width="6" fill="#fff" stroke-linecap="round"/>
        <!-- Teeth -->
        <path d="M -28 -10 Q 0 16 28 -10" stroke="none" fill="#fff"/>`;
    } else if (isDramatic) {
      // Squinted dramatic eyes, smug mouth
      bugEyesPath = `
        <path d="M -50 -52 Q -32 -64 -14 -52" stroke="#000" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M 14 -52 Q 32 -64 50 -52" stroke="#000" stroke-width="7" fill="none" stroke-linecap="round"/>`;
      bugMouthPath = `<path d="M -20 -5 Q 0 0 20 -10" stroke="#000" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      // Dramatic sweat or sparkle
      bugExtras = `
        <g transform="translate(95, -150)" filter="drop-shadow(0 0 6px ${accentColor})">
          <polygon points="0,-30 6,-10 28,-10 11,2 18,24 0,12 -18,24 -11,2 -28,-10 -6,-10" fill="${accentColor2}" stroke="#000" stroke-width="3"/>
        </g>`;
    } else {
      bugEyesPath = `
        <ellipse cx="-32" cy="-48" rx="18" ry="20" fill="#fff" stroke="#000" stroke-width="4"/>
        <circle cx="-32" cy="-44" r="8" fill="#1a1a1a"/>
        <ellipse cx="32" cy="-48" rx="18" ry="20" fill="#fff" stroke="#000" stroke-width="4"/>
        <circle cx="32" cy="-44" r="8" fill="#1a1a1a"/>`;
      bugMouthPath = `<path d="M -16 -6 Q 0 8 16 -6" stroke="#000" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    }

    // Pointing arm if explaining
    let pointingArm = '';
    if (input.speaker === 'Bug' || bugAction.includes('point') || bugAction.includes('explain')) {
      pointingArm = `
        <!-- Extended pointing arm -->
        <rect x="${input.speaker === 'Bug' ? '-180' : '70'}" y="-5" width="115" height="28" rx="14" fill="#cc2200" stroke="#000" stroke-width="6" transform="rotate(${input.speaker === 'Bug' ? '-15' : '15'} ${input.speaker === 'Bug' ? '-120' : '130'} 9)"/>
        <circle cx="${input.speaker === 'Bug' ? '-195' : '195'}" cy="30" r="22" fill="#f0c896" stroke="#000" stroke-width="5"/>`;
    }

    const bugMotion = (bugAction.includes('run') || bugAction.includes('jump'))
      ? `<g stroke="${accentColor}" stroke-width="4" opacity="0.5" stroke-linecap="round">
          <line x1="80" y1="200" x2="180" y2="200"/>
          <line x1="60" y1="220" x2="160" y2="220"/>
        </g>` : '';

    bugSvg = `
    <!-- ======= BUG (Red Hoodie Human with Antenna) ======= -->
    <g transform="translate(${bugX}, ${bugY})" filter="drop-shadow(0 8px 24px rgba(255,59,59,0.4))">
      <!-- Ground shadow -->
      <ellipse cx="0" cy="220" rx="90" ry="18" fill="rgba(0,0,0,0.5)" filter="blur(8px)"/>

      ${bugMotion}

      <!-- LEGS -->
      <rect x="-42" y="120" width="36" height="100" rx="16" fill="#660000" stroke="#000" stroke-width="5"/>
      <rect x="10" y="120" width="36" height="100" rx="16" fill="#660000" stroke="#000" stroke-width="5"/>
      <!-- Shoes -->
      <ellipse cx="-24" cy="220" rx="32" ry="14" fill="#1a1a1a" stroke="#000" stroke-width="4"/>
      <ellipse cx="28" cy="220" rx="32" ry="14" fill="#1a1a1a" stroke="#000" stroke-width="4"/>

      <!-- BODY (red hoodie) -->
      <rect x="-70" y="-20" width="140" height="150" rx="30" fill="#cc2200" stroke="#000" stroke-width="7"/>
      <!-- Hoodie pocket -->
      <rect x="-35" y="80" width="70" height="45" rx="12" fill="rgba(0,0,0,0.2)" stroke="#000" stroke-width="4"/>
      <!-- Hoodie draw strings -->
      <line x1="-12" y1="0" x2="-18" y2="50" stroke="#fff" stroke-width="3" opacity="0.5"/>
      <line x1="12" y1="0" x2="18" y2="50" stroke="#fff" stroke-width="3" opacity="0.5"/>

      <!-- ARMS -->
      <rect x="-120" y="-10" width="55" height="30" rx="14" fill="#cc2200" stroke="#000" stroke-width="6" transform="rotate(25 -92 5)"/>
      ${pointingArm || `<rect x="68" y="-10" width="55" height="30" rx="14" fill="#cc2200" stroke="#000" stroke-width="6" transform="rotate(-25 95 5)"/>
      <circle cx="130" cy="40" r="22" fill="#f0c896" stroke="#000" stroke-width="5"/>`}
      <circle cx="-130" cy="45" r="22" fill="#f0c896" stroke="#000" stroke-width="5"/>

      <!-- NECK -->
      <rect x="-18" y="-90" width="36" height="50" rx="10" fill="#f0c896" stroke="#000" stroke-width="4"/>

      <!-- HEAD -->
      <ellipse cx="0" cy="-135" rx="75" ry="80" fill="#f0c896" stroke="#000" stroke-width="7"/>

      <!-- HOODIE HOOD (on head, red) -->
      <path d="M -75 -155 Q -80 -240 0 -250 Q 80 -240 75 -155" fill="#cc2200" stroke="#000" stroke-width="6"/>

      <!-- BUG ANTENNA on hood -->
      <line x1="0" y1="-215" x2="0" y2="-285" stroke="#1a1a1a" stroke-width="6" stroke-linecap="round"/>
      <circle cx="0" cy="-295" r="14" fill="${accentColor}" stroke="#000" stroke-width="5" filter="drop-shadow(0 0 8px ${accentColor})"/>

      <!-- FACE: Eyes -->
      <g transform="translate(0, -135)">
        ${bugEyesPath}
        ${bugMouthPath}
        ${bugExtras}
        <!-- Cheek blush -->
        <ellipse cx="-58" cy="-15" rx="16" ry="10" fill="#ff8888" opacity="0.35"/>
        <ellipse cx="58" cy="-15" rx="16" ry="10" fill="#ff8888" opacity="0.35"/>
      </g>
    </g>`;
  }

  // ==========================================================================
  // 6. CINEMATIC HUD OVERLAY
  // ==========================================================================
  const hudOverlay = `
    <!-- Scene info HUD (top area) -->
    <rect x="40" y="40" width="1000" height="110" rx="18" fill="rgba(8,10,20,0.82)" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
    <text x="70" y="85" fill="rgba(255,255,255,0.4)" font-family="'Outfit', Impact, sans-serif" font-size="18" font-weight="700" letter-spacing="2">ENV</text>
    <text x="70" y="122" fill="${accentColor}" font-family="'Outfit', Impact, sans-serif" font-size="28" font-weight="900" letter-spacing="1">${envLabel}</text>
    <text x="520" y="85" fill="rgba(255,255,255,0.4)" font-family="'Outfit', Impact, sans-serif" font-size="18" font-weight="700" letter-spacing="2">SPEAKER</text>
    <text x="520" y="122" fill="${input.speaker === 'Bug' ? '#ff3b3b' : '#00aaff'}" font-family="'Outfit', Impact, sans-serif" font-size="28" font-weight="900" letter-spacing="1">${input.speaker.toUpperCase()}</text>
    <text x="820" y="85" fill="rgba(255,255,255,0.4)" font-family="'Outfit', Impact, sans-serif" font-size="18" font-weight="700" letter-spacing="2">BEAT</text>
    <text x="820" y="122" fill="#fff" font-family="'Outfit', Impact, sans-serif" font-size="28" font-weight="900" letter-spacing="1">${input.storyBeat.toUpperCase()}</text>
  `;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="100%" height="100%">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bgColor1}"/>
          <stop offset="100%" stop-color="${bgColor2}"/>
        </linearGradient>
      </defs>

      <!-- Base background -->
      <rect width="1080" height="1920" fill="url(#bgGrad)"/>

      <!-- Environment elements -->
      ${environmentSvg}

      <!-- Characters -->
      ${byteSvg}
      ${bugSvg}

      <!-- HUD overlay -->
      ${hudOverlay}
    </svg>
  `;
}
