import React from 'react';
import { getInputProps, useCurrentFrame, Sequence, Audio, interpolate, spring, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Outfit';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { Background } from './components/Background';
import { Subtitles } from './components/Subtitles';
import { ReactionOverlay } from './components/ReactionOverlay';
import { CodeCard } from './templates/CodeCard';
import { ArchitectureDiagram } from './templates/ArchitectureDiagram';
import { ComparisonCard } from './templates/ComparisonCard';
import { TerminalSimulation } from './templates/TerminalSimulation';
import { StatCard } from './templates/StatCard';
import { TimelineCard } from './templates/TimelineCard';
import { VisualStory } from './templates/VisualStory';

// Load fonts globally
loadFont();
loadMono();

export interface Scene {
  id: number;
  text: string;
  template: 'architecture-diagram' | 'code-card' | 'comparison-card' | 'terminal-simulation' | 'stat-card' | 'timeline-card' | 'visual-story';
  templateData: any & {
    environment?: 'neon' | 'terminal' | 'architecture' | 'benchmark' | 'editor' | 'counter';
    stylePack?: 'terminal' | 'cyberpunk' | 'infographic' | 'minimal';
    layout?: 'text-top' | 'text-bottom' | 'text-mid' | 'cinematic';
  };
  audioUrl: string;
  duration: number;
  startFrame: number;
  endFrame: number;
  wordTimings: { word: string; start: number; end: number }[];
}

export interface MainProps {
  projectId: string;
  scenes: Scene[];
  totalDurationInFrames: number;
}

/**
 * Layout variants — controls where subtitles sit and how the template area aligns.
 *
 *  text-top      → text at the top third, template sits in lower 60%
 *  text-bottom   → text at the bottom, template centered (classic)
 *  text-mid      → text in the mid-lower zone, template shifted up
 *  cinematic     → text very bottom edge, template fills almost full height
 */
type LayoutVariant = 'text-top' | 'text-bottom' | 'text-mid' | 'cinematic';

const LAYOUT_CONFIG: Record<LayoutVariant, {
  subtitleTop?: number;
  subtitleBottom?: number;
  templatePaddingTop: number;
  templatePaddingBottom: number;
  templateAlign: 'flex-start' | 'center' | 'flex-end';
  gifPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}> = {
  'text-top': {
    subtitleTop: 110,
    templatePaddingTop: 340,
    templatePaddingBottom: 60,
    templateAlign: 'center',
    gifPosition: 'bottom-right',
  },
  'text-bottom': {
    subtitleBottom: 180, // lowered from 420
    templatePaddingTop: 60,
    templatePaddingBottom: 320,
    templateAlign: 'center',
    gifPosition: 'top-right',
  },
  'text-mid': {
    subtitleBottom: 200, // lowered from 460
    templatePaddingTop: 48,
    templatePaddingBottom: 0,
    templateAlign: 'flex-start',
    gifPosition: 'top-left',
  },
  'cinematic': {
    subtitleBottom: 160, // lowered from 450 — captions near bottom safe zone
    templatePaddingTop: 40,
    templatePaddingBottom: 320,
    templateAlign: 'center',
    gifPosition: 'top-right',
  },
};

/**
 * Derives a layout variant from scene properties — no LLM involvement needed.
 * Rules:
 *  - Scene 1 (hook): text-top for immediate visual impact
 *  - stat-card: text-bottom (the number IS the visual, put text below to explain it)
 *  - architecture-diagram: text-top (diagram needs max vertical space)
 *  - code-card: cinematic (code card is tall; text at very bottom)
 *  - terminal-simulation: text-top (output is at bottom of terminal naturally)
 *  - timeline-card: alternates between text-mid and text-bottom
 *  - comparison-card: alternates text-top / text-bottom
 *  - CTA beat: cinematic
 */
function deriveLayout(scene: Scene, totalScenes: number): LayoutVariant {
  const beat = scene.templateData?.attentionBeatId ?? '';
  const isLast = scene.id === totalScenes;
  const isFirst = scene.id === 1;

  if (beat === 'cta' || isLast) return 'cinematic';
  if (isFirst) return 'text-top';

  switch (scene.template) {
    case 'visual-story':      return 'cinematic';
    case 'stat-card':         return 'text-bottom';
    case 'architecture-diagram': return 'text-top';
    case 'code-card':         return 'cinematic';
    case 'terminal-simulation': return 'text-top';
    case 'timeline-card':     return scene.id % 2 === 0 ? 'text-mid' : 'text-bottom';
    case 'comparison-card':   return scene.id % 2 === 0 ? 'text-top' : 'text-bottom';
    default:                  return scene.id % 3 === 0 ? 'text-top' : scene.id % 3 === 1 ? 'text-bottom' : 'text-mid';
  }
}

export const Main: React.FC = () => {
  const { scenes, totalDurationInFrames } = (getInputProps() as unknown) as MainProps;
  const currentFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsedSeconds = currentFrame / 30;

  if (!scenes || scenes.length === 0) {
    return (
      <div style={{ flex: 1, backgroundColor: '#050508', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: 32 }}>
        No scenes configuration found.
      </div>
    );
  }

  const activeScene = scenes.find(
    (scene) => currentFrame >= scene.startFrame && currentFrame < scene.endFrame
  ) || scenes[scenes.length - 1];

  const activeEnvironment = activeScene.templateData?.environment;
  const needsContrastBoost =
    (elapsedSeconds >= 8 && elapsedSeconds <= 14) ||
    activeEnvironment === 'neon' ||
    activeEnvironment === 'architecture' ||
    activeEnvironment === 'benchmark';

  // Resolve layout for active scene (LLM override respected, else derived)
  const layout: LayoutVariant = activeScene.templateData?.layout ?? deriveLayout(activeScene, scenes.length);
  const cfg = LAYOUT_CONFIG[layout];

  // Smooth layout transition: interpolate padding/position over 8 frames when scene changes
  const sceneLocalFrame = currentFrame - activeScene.startFrame;
  const transitionSpring = spring({ frame: sceneLocalFrame, fps, config: { damping: 18, stiffness: 160 } });
  const transitionProg = interpolate(transitionSpring, [0, 1], [0, 1], { extrapolateRight: 'clamp' });

  const renderTemplate = (scene: Scene) => {
    const durationFrames = scene.endFrame - scene.startFrame;
    const sceneRelativeFrame = currentFrame - scene.startFrame;

    switch (scene.template) {
      case 'visual-story':
        return <VisualStory data={scene.templateData} durationFrames={durationFrames} frame={sceneRelativeFrame} />;
      case 'code-card':
        return <CodeCard data={scene.templateData} durationFrames={durationFrames} frame={sceneRelativeFrame} />;
      case 'architecture-diagram':
        return <ArchitectureDiagram data={scene.templateData} durationFrames={durationFrames} frame={sceneRelativeFrame} />;
      case 'comparison-card':
        return <ComparisonCard data={scene.templateData} durationFrames={durationFrames} frame={sceneRelativeFrame} />;
      case 'terminal-simulation':
        return <TerminalSimulation data={scene.templateData} durationFrames={durationFrames} frame={sceneRelativeFrame} />;
      case 'stat-card':
        return <StatCard data={scene.templateData} durationFrames={durationFrames} frame={sceneRelativeFrame} />;
      case 'timeline-card':
        return <TimelineCard data={scene.templateData} durationFrames={durationFrames} frame={sceneRelativeFrame} />;
      default:
        return <div style={{ color: 'white' }}>Unknown template: {scene.template}</div>;
    }
  };

  // Subtitle position (absolute coords)
  const subtitleStyle: React.CSSProperties = {
    position: 'absolute',
    left: 50,
    right: 50,
    display: 'flex',
    justifyContent: 'center',
    zIndex: 20,
    opacity: transitionProg,
    ...(cfg.subtitleTop !== undefined
      ? { top: cfg.subtitleTop }
      : { bottom: cfg.subtitleBottom ?? 180 }),
  };

  return (
    <div style={{ flex: 1, backgroundColor: '#050508', position: 'relative', width: 1080, height: 1920, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* 1. Background / Visual Story (full-screen) */}
      {activeScene.template === 'visual-story' ? (
        <VisualStory
          data={activeScene.templateData}
          durationFrames={activeScene.endFrame - activeScene.startFrame}
          frame={currentFrame - activeScene.startFrame}
        />
      ) : (
        <Background
          template={activeScene.template}
          environment={activeScene.templateData?.environment}
          stylePack={activeScene.templateData?.stylePack}
          sceneId={activeScene.id}
        />
      )}

      {needsContrastBoost && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 6,
            pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.035), transparent 24%, transparent 58%, rgba(0,0,0,0.28))'
          }}
        />
      )}

      {/* 2. Audio tracks */}
      {scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.endFrame - scene.startFrame}
        >
          <Audio src={scene.audioUrl} volume={1.0} />
        </Sequence>
      ))}

      {/* 3. Template Visual Area — vertical alignment shifts per layout */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: cfg.templateAlign,
          paddingTop: `${cfg.templatePaddingTop}px`,
          paddingBottom: `${cfg.templatePaddingBottom}px`,
          paddingLeft: '28px',
          paddingRight: '28px',
          zIndex: 10,
        }}
      >
        {scenes.map((scene) => {
          const isVisible = currentFrame >= scene.startFrame && currentFrame < scene.endFrame;
          if (!isVisible) return null;
          if (scene.template === 'visual-story') return null;
          return (
            <div key={scene.id} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {renderTemplate(scene)}
            </div>
          );
        })}
      </div>

      {/* 4. Reaction GIF overlay — position adapts to layout */}
      {scenes.map((scene) => {
        const isVisible = currentFrame >= scene.startFrame && currentFrame < scene.endFrame;
        if (!isVisible || !scene.templateData?.reactionGifUrl) return null;
        const sceneLayout: LayoutVariant = scene.templateData?.layout ?? deriveLayout(scene, scenes.length);
        const sceneRelativeFrame = currentFrame - scene.startFrame;
        const durationFrames = scene.endFrame - scene.startFrame;
        return (
          <ReactionOverlay
            key={`reaction-${scene.id}`}
            gifUrl={scene.templateData.reactionGifUrl}
            frame={sceneRelativeFrame}
            durationFrames={durationFrames}
            position={LAYOUT_CONFIG[sceneLayout].gifPosition}
          />
        );
      })}

      {/* 5. Subtitles — position driven by layout variant with floating speaker badge */}
      <div style={subtitleStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
          {activeScene.templateData?.storyState?.speaker && activeScene.template !== 'visual-story' && (
            <div
              style={{
                backgroundColor: activeScene.templateData.storyState.speaker === 'Bug' ? '#4ade80' : '#00f2fe',
                color: '#030307',
                padding: '6px 20px',
                borderRadius: '50px',
                fontSize: '20px',
                fontWeight: 900,
                letterSpacing: '1.5px',
                fontFamily: "'Outfit', sans-serif",
                textTransform: 'uppercase',
                boxShadow: `0 6px 20px rgba(0,0,0,0.4), 0 0 15px ${activeScene.templateData.storyState.speaker === 'Bug' ? 'rgba(74,222,128,0.3)' : 'rgba(0,242,254,0.3)'}`
              }}
            >
              {activeScene.templateData.storyState.speaker}
            </div>
          )}
          <Subtitles activeScene={{ ...activeScene, speaker: activeScene.templateData?.storyState?.speaker }} currentFrame={currentFrame} />
        </div>
      </div>

      {/* Cinematic Fade Out at the end of the video */}
      {totalDurationInFrames && currentFrame >= totalDurationInFrames - 45 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#000000',
            opacity: interpolate(
              currentFrame,
              [totalDurationInFrames - 45, totalDurationInFrames - 15],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            ),
            zIndex: 100,
            pointerEvents: 'none'
          }}
        />
      )}
    </div>
  );
};
export default Main;

