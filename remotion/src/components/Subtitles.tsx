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
    speaker?: string;
    templateData?: {
      captionStyle?: 'dialogue' | 'fact' | 'minimal' | 'none';
      storyState?: { speaker?: string };
    };
  };
  currentFrame: number;
}

export const Subtitles: React.FC<SubtitlesProps> = ({ activeScene, currentFrame }) => {
  const { fps } = useVideoConfig();
  const sceneRelativeFrame = currentFrame - activeScene.startFrame;
  const currentTime = sceneRelativeFrame / fps;

  const captionStyle = activeScene.templateData?.captionStyle || 'dialogue';

  // Handle 'none' style
  if (captionStyle === 'none') return null;

  const wordTimings = activeScene.wordTimings || [];

  // Determine speaker for colour theming
  const speaker = activeScene.templateData?.storyState?.speaker || activeScene.speaker || '';
  // Byte = cyan highlight, Bug = neon green highlight
  const activeWordColor = speaker === 'Bug' ? '#39ff14' : '#ffd60a';
  const activeGlow = speaker === 'Bug'
    ? '0 0 20px rgba(57,255,20,0.8), 0 4px 8px rgba(0,0,0,0.9)'
    : '0 0 20px rgba(255,214,10,0.8), 0 4px 8px rgba(0,0,0,0.9)';

  // --- Fallback: no word timings ---
  if (wordTimings.length === 0) {
    const cleanText = activeScene.text.replace(/^(Byte|Bug):\s*/i, '').replace(/[*_`~]/g, '');
    return (
      <div
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 64,
          fontWeight: 900,
          textTransform: 'uppercase',
          color: '#ffffff',
          textAlign: 'center',
          // Pure text shadow — no background box
          textShadow: '0 2px 12px rgba(0,0,0,1), 0 0 40px rgba(0,0,0,0.9), 3px 3px 0px rgba(0,0,0,0.8)',
          lineHeight: 1.1,
          letterSpacing: 1,
          overflowWrap: 'anywhere',
          maxWidth: 980,
          padding: '0 24px',
          WebkitTextStroke: '2px rgba(0,0,0,0.5)',
        }}
      >
        {cleanText}
      </div>
    );
  }

  // --- Find the SINGLE active word (one at a time) ---
  // Find current word being spoken
  let activeIndex = wordTimings.findIndex(
    (wt) => currentTime >= wt.start && currentTime <= wt.end
  );

  // If between words, show the last spoken word
  if (activeIndex === -1) {
    for (let i = wordTimings.length - 1; i >= 0; i--) {
      if (currentTime >= wordTimings[i].end) {
        activeIndex = i;
        break;
      }
    }
  }

  // Before any word starts, show nothing
  if (activeIndex === -1 && currentTime < wordTimings[0]?.start) {
    return null;
  }

  if (activeIndex === -1) activeIndex = 0;

  const activeWord = wordTimings[activeIndex];
  if (!activeWord) return null;

  // Spring bounce for the word pop
  const wordStartFrame = Math.round(activeWord.start * fps);
  const framesSinceWord = sceneRelativeFrame - wordStartFrame;
  const springVal = spring({
    frame: framesSinceWord < 0 ? 0 : framesSinceWord,
    fps,
    config: { damping: 8, stiffness: 260, mass: 0.1 }
  });

  const scale = interpolate(springVal, [0, 1], [0.5, 1.0], { extrapolateRight: 'clamp' });
  const opacity = interpolate(springVal, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' });

  // Word importance: ALL-CAPS short words (tech terms) get bigger treatment
  const cleanWordText = activeWord.word.replace(/[*_`~]/g, '');
  const isEmphasisWord = /^[A-Z]{2,}$/.test(cleanWordText) ||
    cleanWordText.length >= 6;
  const fontSize = captionStyle === 'minimal' ? 72 : isEmphasisWord ? 82 : 74;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        // No background container — pure floating text
      }}
    >
      <span
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: `${fontSize}px`,
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color: activeWordColor,
          // Thick black outline via text-shadow layers for legibility on any background
          textShadow: activeGlow,
          WebkitTextStroke: '3px rgba(0,0,0,0.85)',
          transform: `scale(${scale})`,
          opacity,
          display: 'inline-block',
          lineHeight: 1,
          transformOrigin: 'center bottom',
        }}
      >
        {cleanWordText}
      </span>
    </div>
  );
};

export default Subtitles;
