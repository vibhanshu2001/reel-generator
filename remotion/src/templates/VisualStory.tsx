import React from 'react';
import { Img, interpolate, spring } from 'remotion';

interface VisualStoryProps {
  data: {
    imageUrl: string;
    camera?: {
      shot: string;
      motion: string;
    };
    isIntro?: boolean;
    title?: string;
  };
  durationFrames: number;
  frame: number;
}

export const VisualStory: React.FC<VisualStoryProps> = ({ data, durationFrames, frame }) => {
  const { imageUrl = '', camera = { shot: 'Medium', motion: 'Static' } } = data;
  const motion = camera.motion || 'Static';

  // Base Entry Animation
  const entrySpring = spring({
    frame,
    fps: 30,
    config: { damping: 14, stiffness: 100 }
  });
  const entryOpacity = interpolate(entrySpring, [0, 1], [0, 1]);
  const entryScale = interpolate(entrySpring, [0, 1], [0.92, 1.0]);

  // Ken Burns Camera Motion interpolation
  const progress = frame / (durationFrames || 1);
  let scale = 1.0;
  let translateX = 0;
  let translateY = 0;

  if (motion === 'Zoom In') {
    scale = interpolate(progress, [0, 1], [1.0, 1.16], { extrapolateRight: 'clamp' });
  } else if (motion === 'Zoom Out') {
    scale = interpolate(progress, [0, 1], [1.16, 1.0], { extrapolateRight: 'clamp' });
  } else if (motion === 'Pan') {
    scale = 1.10; // scale up slightly so edges don't cut off
    translateX = interpolate(progress, [0, 1], [-45, 45], { extrapolateRight: 'clamp' });
  } else if (motion === 'Dolly') {
    scale = 1.10;
    translateY = interpolate(progress, [0, 1], [-35, 35], { extrapolateRight: 'clamp' });
  }

  const finalScale = entryScale * scale;

  const isIntro = data.isIntro === true;
  const title = data.title || '';

  // Title spring entry
  const titleSpring = spring({
    frame,
    fps: 30,
    config: { damping: 14, stiffness: 100 }
  });
  
  // Fade out around frame 45-55
  const titleOpacity = interpolate(
    frame,
    [0, 10, 45, 55],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const titleScale = interpolate(titleSpring, [0, 1], [0.85, 1.0]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: 1080,
        height: 1920,
        overflow: 'hidden',
        opacity: entryOpacity,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${finalScale}) translate(${translateX}px, ${translateY}px)`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {imageUrl ? (
          <Img
            src={imageUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div style={{ color: '#8b949e', fontSize: '28px', fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>
            No visual asset generated
          </div>
        )}
      </div>

      {isIntro && frame < 60 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
            opacity: titleOpacity,
            pointerEvents: 'none',
            padding: '0 50px',
          }}
        >
          <div
            style={{
              background: 'rgba(5, 5, 8, 0.88)',
              backdropFilter: 'blur(12px)',
              border: '2px solid rgba(0, 242, 254, 0.35)',
              boxShadow: '0 20px 50px rgba(0, 242, 254, 0.15), inset 0 0 20px rgba(0, 242, 254, 0.05)',
              padding: '34px 44px',
              borderRadius: '24px',
              textAlign: 'center',
              transform: `scale(${titleScale})`,
              maxWidth: '900px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <span
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '18px',
                fontWeight: 900,
                color: '#00f2fe',
                textTransform: 'uppercase',
                letterSpacing: '3px',
              }}
            >
              Topic Spotlight
            </span>
            <h1
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '54px',
                fontWeight: 900,
                color: '#ffffff',
                textTransform: 'uppercase',
                lineHeight: '1.15',
                margin: 0,
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              {title}
            </h1>
          </div>
        </div>
      )}
    </div>
  );
};
