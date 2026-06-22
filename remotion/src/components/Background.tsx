import React from 'react';
import { useCurrentFrame } from 'remotion';

type VisualEnvironment = 'neon' | 'terminal' | 'architecture' | 'benchmark' | 'editor' | 'counter';
type StylePackId = 'terminal' | 'cyberpunk' | 'infographic' | 'minimal';

interface BackgroundProps {
  template?: string;
  environment?: VisualEnvironment;
  stylePack?: StylePackId;
  sceneId?: number;
}

const BACKGROUND_LOGS = [
  "import { useCurrentFrame } from 'remotion';",
  "const express = require('express');",
  "const app = express();",
  "app.use('/audio', express.static(tempAudioDir));",
  "const client = redis.createClient();",
  "await client.set('user:100:session', token);",
  "DEBUG: database query took 0.2ms (cache hit)",
  "INFO: server listening on port 3001",
  "SUCCESS: remotion build complete",
  "const socket = new WebSocket(wssUrl);",
  "prisma.scene.create({ data: { projectId, text } });",
  "ffmpeg -i input.wav -codec:a libmp3lame -b:a 48k output.mp3",
  "git commit -m 'feat: dynamic subtitle animations'",
  "npm run dev --filter=frontend",
  "docker-compose up -d --build redis postgres",
  "curl -X POST http://localhost:3001/api/projects",
  "const activeScene = scenes.find(s => currentFrame >= s.startFrame);",
  "SELECT * FROM users WHERE email = 'dev@domain.com';",
  "const ttsResult = await generateEdgeTTS(text, path);",
  "Remotion rendering output path: /backend/outputs/id.mp4",
  "Starting local development server on port 3000..."
];

const getEnvironment = (template?: string, environment?: VisualEnvironment, sceneId = 1): VisualEnvironment => {
  if (environment) return environment;
  if (template === 'terminal-simulation') return 'terminal';
  if (template === 'architecture-diagram') return 'architecture';
  if (template === 'stat-card') return sceneId % 2 === 0 ? 'counter' : 'benchmark';
  if (template === 'code-card') return 'editor';
  return sceneId % 2 === 0 ? 'benchmark' : 'neon';
};

export const Background: React.FC<BackgroundProps> = ({ template, environment, stylePack = 'cyberpunk', sceneId = 1 }) => {
  const frame = useCurrentFrame();
  const env = getEnvironment(template, environment, sceneId);

  const scrollSpeed = env === 'terminal' ? 1.4 : 0.7;
  const scrollOffset = (frame * scrollSpeed) % 800;
  const sweep = (frame * 10) % 1920;
  const packetX = (frame * 18) % 1160 - 40;
  const counterPulse = 0.9 + Math.sin(frame / 4) * 0.08;
  const chartGrow = Math.min(1, frame / 42);

  const baseByEnv: Record<VisualEnvironment, string> = {
    neon: 'linear-gradient(145deg, #04040a 0%, #07111d 45%, #170613 100%)',
    terminal: 'linear-gradient(180deg, #020806 0%, #07140d 55%, #020302 100%)',
    architecture: 'linear-gradient(135deg, #040914 0%, #0b1021 52%, #05030d 100%)',
    benchmark: 'linear-gradient(180deg, #070708 0%, #151006 58%, #050505 100%)',
    editor: 'linear-gradient(140deg, #05070b 0%, #0b0f17 52%, #080b10 100%)',
    counter: 'radial-gradient(circle at center, #101004 0%, #08090b 48%, #020203 100%)'
  };

  const styleOverlay: Record<StylePackId, { background: string; grid: string; vignette: string; opacity: number }> = {
    terminal: {
      background: 'linear-gradient(180deg, rgba(2,8,6,0.92), rgba(5,18,10,0.86))',
      grid: 'rgba(57,255,20,0.06)',
      vignette: 'radial-gradient(circle, transparent 24%, rgba(0,12,4,0.84) 88%)',
      opacity: 0.92
    },
    cyberpunk: {
      background: 'linear-gradient(140deg, rgba(0,242,254,0.08), rgba(255,45,85,0.08))',
      grid: 'rgba(0,242,254,0.07)',
      vignette: 'radial-gradient(circle, transparent 28%, rgba(0,0,0,0.78) 90%)',
      opacity: 1
    },
    infographic: {
      background: 'linear-gradient(180deg, rgba(247,250,252,0.9), rgba(219,234,254,0.78))',
      grid: 'rgba(37,99,235,0.08)',
      vignette: 'radial-gradient(circle, transparent 38%, rgba(15,23,42,0.22) 94%)',
      opacity: 0.86
    },
    minimal: {
      background: 'linear-gradient(180deg, rgba(11,13,16,0.94), rgba(24,24,27,0.86))',
      grid: 'rgba(250,204,21,0.04)',
      vignette: 'radial-gradient(circle, transparent 36%, rgba(0,0,0,0.72) 92%)',
      opacity: 0.78
    }
  };
  const selectedStyle = styleOverlay[stylePack];

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `${selectedStyle.background}, ${baseByEnv[env]}`,
        zIndex: 1,
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `linear-gradient(${selectedStyle.grid} 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
          backgroundSize: env === 'terminal' ? '72px 72px' : '96px 96px',
          transform: `translateY(${(frame % 96) * -0.25}px)`,
          pointerEvents: 'none'
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: (env === 'terminal' || env === 'editor' ? 0.32 : 0.14) * selectedStyle.opacity,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: env === 'terminal' ? '24px' : '16px',
          color: env === 'terminal' ? '#39ff14' : '#00f2fe',
          lineHeight: env === 'terminal' ? '42px' : '30px',
          whiteSpace: 'nowrap',
          transform: `translateY(-${scrollOffset}px)`,
          filter: env === 'terminal' ? 'blur(0.5px)' : 'blur(2px)',
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      >
        {/* Render multiple sets to loop smoothly */}
        {[...BACKGROUND_LOGS, ...BACKGROUND_LOGS, ...BACKGROUND_LOGS, ...BACKGROUND_LOGS].map((log, idx) => (
          <div key={idx} style={{ paddingLeft: `${(idx % 4) * 40 + 20}px` }}>
            {log}
          </div>
        ))}
      </div>

      {env === 'architecture' && (
        <>
          {[220, 520, 820].map((top, idx) => (
            <div key={top} style={{ position: 'absolute', left: 90, right: 90, top, height: 3, background: 'rgba(0,242,254,0.12)' }}>
              <div style={{ width: 22, height: 22, borderRadius: 4, background: '#00f2fe', transform: `translateX(${(packetX + idx * 220) % 980}px) translateY(-9px)`, boxShadow: '0 0 24px rgba(0,242,254,0.85)' }} />
            </div>
          ))}
          {[180, 680, 1180].map((top, idx) => (
            <div key={top} style={{ position: 'absolute', left: idx % 2 ? 720 : 120, top, width: 260, height: 120, border: '2px solid rgba(255,255,255,0.08)', background: 'rgba(0,242,254,0.04)' }} />
          ))}
        </>
      )}

      {env === 'benchmark' && (
        <div style={{ position: 'absolute', left: 70, right: 70, bottom: 220, height: 620, display: 'flex', alignItems: 'flex-end', gap: 28, opacity: 0.32 }}>
          {[0.22, 0.38, 0.58, 0.76, 0.92].map((height, idx) => (
            <div key={idx} style={{ flex: 1, height: `${height * chartGrow * 100}%`, background: idx === 4 ? '#39ff14' : '#ffdf00', boxShadow: idx === 4 ? '0 0 30px rgba(57,255,20,0.5)' : '0 0 20px rgba(255,223,0,0.35)', transition: 'height 0.1s linear' }} />
          ))}
        </div>
      )}

      {env === 'counter' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.16, fontFamily: "'Outfit', sans-serif", fontSize: 420, fontWeight: 900, transform: `scale(${counterPulse})`, color: '#ffdf00', textShadow: '0 0 60px rgba(255,223,0,0.65)' }}>
          {(Math.min(5000, Math.floor(Math.pow(frame + 1, 2.18)))).toLocaleString()}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: sweep - 180,
          height: 180,
          background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.07), transparent)',
          transform: 'skewY(-8deg)',
          pointerEvents: 'none'
        }}
      />

      {/* Radial spotlight glow at center — adds depth and visual energy */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: `translateX(-50%) scale(${0.9 + Math.sin(frame / 20) * 0.08})`,
          width: '700px',
          height: '700px',
          borderRadius: '50%',
          background: env === 'terminal'
            ? 'radial-gradient(circle, rgba(57,255,20,0.07) 0%, transparent 70%)'
            : env === 'benchmark'
            ? 'radial-gradient(circle, rgba(255,223,0,0.08) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(0,242,254,0.07) 0%, transparent 70%)',
          pointerEvents: 'none'
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          backgroundImage: selectedStyle.vignette
        }}
      />
    </div>
  );
};

export default Background;
