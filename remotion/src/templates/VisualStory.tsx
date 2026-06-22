import React from 'react';
import { Img, interpolate, spring } from 'remotion';

interface VisualStoryProps {
  data: {
    imageUrl: string;
    camera?: {
      shot: string;
      motion: string;
    };
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
    </div>
  );
};
