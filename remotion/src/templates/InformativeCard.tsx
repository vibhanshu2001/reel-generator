import React from 'react';
import { Img, interpolate, spring, useVideoConfig } from 'remotion';

interface InformativeCardProps {
  data: {
    title: string;
    imageUrl: string;
    info?: string;
    camera?: {
      shot?: string;
      motion?: 'Static' | 'Zoom In' | 'Zoom Out' | 'Pan' | 'Dolly';
    };
  };
  durationFrames: number;
  frame: number;
}

export const InformativeCard: React.FC<InformativeCardProps> = ({ data, durationFrames, frame }) => {
  const { title = 'Did you know?', imageUrl = '', info = '', camera = { shot: 'Medium', motion: 'Zoom In' } } = data;
  const { fps } = useVideoConfig();
  const motion = camera.motion || 'Zoom In';

  // Base entry animation for the card
  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 90 }
  });
  const cardScale = interpolate(entrySpring, [0, 1], [0.94, 1.0]);
  const cardOpacity = interpolate(entrySpring, [0, 1], [0, 1]);

  // Ken Burns image animation
  const progress = frame / (durationFrames || 1);
  let imgScale = 1.0;
  let translateX = 0;
  let translateY = 0;

  if (motion === 'Zoom In') {
    imgScale = interpolate(progress, [0, 1], [1.0, 1.15], { extrapolateRight: 'clamp' });
  } else if (motion === 'Zoom Out') {
    imgScale = interpolate(progress, [0, 1], [1.15, 1.0], { extrapolateRight: 'clamp' });
  } else if (motion === 'Pan') {
    imgScale = 1.10;
    translateX = interpolate(progress, [0, 1], [-25, 25], { extrapolateRight: 'clamp' });
  } else if (motion === 'Dolly') {
    imgScale = 1.10;
    translateY = interpolate(progress, [0, 1], [-20, 20], { extrapolateRight: 'clamp' });
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: 1080,
        height: 1920,
        backgroundColor: '#030307',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '140px',
        paddingBottom: '140px',
        paddingLeft: '70px',
        paddingRight: '70px',
        zIndex: 5
      }}
    >
      {/* 1. Blurred Ambient Background */}
      {imageUrl && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            transform: 'scale(1.4)',
            filter: 'blur(55px) saturate(1.3)',
            opacity: 0.30,
            zIndex: 1,
            pointerEvents: 'none'
          }}
        >
          <Img
            src={imageUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </div>
      )}

      {/* Subtle overlay to enhance contrast */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle, rgba(0,0,0,0.15) 0%, rgba(3,3,7,0.85) 100%)',
          zIndex: 2,
          pointerEvents: 'none'
        }}
      />

      {/* 2. Top Title/Question Banner */}
      <div
        style={{
          zIndex: 10,
          opacity: cardOpacity,
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          marginBottom: '30px'
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(5, 5, 8, 0.78)',
            backdropFilter: 'blur(16px)',
            border: '1.5px solid rgba(255, 255, 255, 0.1)',
            padding: '24px 32px',
            borderRadius: '24px',
            textAlign: 'center',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
            width: '100%',
            maxWidth: '920px'
          }}
        >
          <h2
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: '44px',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: '1.3',
              margin: 0,
              textWrap: 'balance',
              textShadow: '0 2px 8px rgba(0,0,0,0.4)'
            }}
          >
            {title}
          </h2>
        </div>
      </div>

      {/* 3. Centered Main Image Card */}
      <div
        style={{
          width: '920px',
          height: '920px', // Perfect square for centered display
          borderRadius: '32px',
          border: '2px solid rgba(255, 255, 255, 0.15)',
          overflow: 'hidden',
          boxShadow: '0 30px 70px rgba(0, 0, 0, 0.65), 0 0 40px rgba(255,255,255,0.02)',
          zIndex: 8,
          transform: `scale(${cardScale})`,
          opacity: cardOpacity,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        {imageUrl ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              transform: `scale(${imgScale}) translate(${translateX}px, ${translateY}px)`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <Img
              src={imageUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </div>
        ) : (
          <div
            style={{
              color: '#8b949e',
              fontSize: '28px',
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 700,
              textAlign: 'center',
              padding: '40px'
            }}
          >
            Searching for visual asset...
          </div>
        )}
      </div>

      {/* 4. Bottom Summary/Info Box */}
      <div
        style={{
          zIndex: 10,
          opacity: cardOpacity,
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          marginTop: '30px'
        }}
      >
        {info ? (
          <div
            style={{
              backgroundColor: 'rgba(5, 5, 8, 0.65)',
              backdropFilter: 'blur(12px)',
              border: '1.2px solid rgba(255, 255, 255, 0.08)',
              padding: '18px 28px',
              borderRadius: '20px',
              textAlign: 'center',
              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.3)',
              width: '100%',
              maxWidth: '920px'
            }}
          >
            <p
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '26px', // Smaller font as requested
                fontWeight: 500,
                color: '#d1d5db', // Softer gray for caption look
                lineHeight: '1.4',
                margin: 0,
                textWrap: 'balance'
              }}
            >
              {info}
            </p>
          </div>
        ) : (
          // Render empty space placeholder to preserve spacing
          <div style={{ height: '80px' }} />
        )}
      </div>
    </div>
  );
};

export default InformativeCard;
