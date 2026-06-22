import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';

interface Word {
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
}

interface SubtitlesProps {
  activeScene: {
    startFrame: number;
    wordTimings: Word[];
    text: string;
    templateData?: {
      captionStyle?: 'dialogue' | 'fact' | 'minimal' | 'none';
    };
  };
  currentFrame: number;
}

export const Subtitles: React.FC<SubtitlesProps> = ({ activeScene, currentFrame }) => {
  const { fps } = useVideoConfig();
  const sceneRelativeFrame = currentFrame - activeScene.startFrame;
  const currentTime = sceneRelativeFrame / fps;

  const captionStyle = activeScene.templateData?.captionStyle || 'dialogue';

  // 0. Handle 'none' style (pure visual storytelling)
  if (captionStyle === 'none') {
    return null;
  }

  const wordTimings = activeScene.wordTimings || [];

  // Fallback: if no word-level timings exist, show the whole text with simple styles
  if (wordTimings.length === 0) {
    const cleanText = activeScene.text.replace(/^(Byte|Bug):\s*/i, '');
    const fallbackFontSize = fitCaptionFontSize(cleanText, 68, 40);
    return (
      <div
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: fallbackFontSize,
          fontWeight: 900,
          textTransform: 'uppercase',
          color: '#ffffff',
          textAlign: 'center',
          textShadow: '0 4px 15px rgba(0,0,0,0.7)',
          padding: '18px 30px',
          lineHeight: 1.12,
          letterSpacing: 0,
          background: 'rgba(2, 6, 10, 0.62)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          backdropFilter: 'blur(10px)',
          overflowWrap: 'anywhere',
          maxWidth: 980
        }}
      >
        {cleanText}
      </div>
    );
  }

  // 1. Locate the index of the active word
  let activeIndex = wordTimings.findIndex(
    (wt) => currentTime >= wt.start && currentTime <= wt.end
  );

  if (activeIndex === -1) {
    for (let i = wordTimings.length - 1; i >= 0; i--) {
      if (currentTime >= wordTimings[i].end) {
        activeIndex = i;
        break;
      }
    }
    if (activeIndex === -1) {
      activeIndex = 0;
    }
  }

  // 2. Chunk word timings to reduce text density (Alex Hormozi style dynamic chunking)
  // Max size is 4 words for standard dialogue/facts, and 2 words for minimal action/emotional scenes.
  const maxChunkSize = captionStyle === 'minimal' ? 2 : 4;
  const chunks: Word[][] = [];
  let currentChunk: Word[] = [];

  for (const wt of wordTimings) {
    currentChunk.push(wt);
    const hasPunctuation = /[.,!?;]/.test(wt.word);
    if (currentChunk.length >= maxChunkSize || hasPunctuation) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // Find the active chunk containing the active index
  let activeChunkIdx = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkStart = chunk[0].start;
    if (currentTime >= chunkStart) {
      activeChunkIdx = i;
    }
  }
  const activeChunk = chunks[activeChunkIdx] || [];

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px 20px',
        maxWidth: 900,
        width: '100%',
        fontFamily: "'Outfit', sans-serif",
        textTransform: 'uppercase',
        zIndex: 50,
        padding: '16px 28px',
        borderRadius: '16px',
        background: 'rgba(2, 6, 10, 0.7)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)',
        textAlign: 'center'
      }}
    >
      {activeChunk.map((wt, idx) => {
        const isSpoken = currentTime >= wt.start;
        const isWordActive = wt.start === wordTimings[activeIndex]?.start;

        // Future words are invisible to create typewriter appearance without layout shifting
        const opacity = isSpoken ? 1 : 0;
        
        // Active word animations
        let scale = 1.0;
        let color = '#ffffff';
        let rotate = 0;
        let textShadow = 'none';

        if (isWordActive) {
          // Spring bounce animation for the active word pop
          const wordStartFrame = Math.round(wt.start * fps);
          const activeFrame = sceneRelativeFrame - wordStartFrame;
          const springVal = spring({
            frame: activeFrame < 0 ? 0 : activeFrame,
            fps,
            config: { damping: 10, stiffness: 220, mass: 0.15 }
          });
          scale = interpolate(springVal, [0, 1], [0.85, 1.15]);
          rotate = interpolate(springVal, [0, 1], [-3, 1]);
          color = '#ffdf00'; // Neon yellow highlight
          textShadow = '0 0 15px rgba(255, 223, 0, 0.5)';
        }

        return (
          <span
            key={idx}
            style={{
              color,
              fontSize: '52px', // Larger readable font size for mobile
              fontWeight: isWordActive ? 900 : 800,
              opacity,
              transform: `scale(${scale}) rotate(${rotate}deg)`,
              textShadow,
              transition: 'color 0.1s ease, transform 0.05s ease-out',
              display: 'inline-block',
              margin: '0 8px',
              letterSpacing: '0.5px'
            }}
          >
            {wt.word}
          </span>
        );
      })}
    </div>
  );
};

function fitCaptionFontSize(value: string, max: number, min: number): number {
  const length = String(value || '').length;
  if (length <= 8) return max;
  if (length <= 14) return Math.max(min, max - 10);
  if (length <= 22) return Math.max(min, max - 20);
  return min;
}

export default Subtitles;
