import React from 'react';
import { Img, spring, interpolate, useVideoConfig } from 'remotion';

interface ReactionOverlayProps {
  gifUrl: string;
  frame: number;
  durationFrames: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const POSITIONS: Record<string, React.CSSProperties> = {
  'top-right':    { top: 60,  right: 48, bottom: 'auto', left: 'auto' },
  'top-left':     { top: 60,  left: 48,  bottom: 'auto', right: 'auto' },
  'bottom-right': { bottom: 280, right: 48, top: 'auto', left: 'auto' },
  'bottom-left':  { bottom: 280, left: 48,  top: 'auto', right: 'auto' },
};

export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({
  gifUrl,
  frame,
  durationFrames,
  position = 'top-right',
}) => {
  const { fps } = useVideoConfig();

  // Cap the visible window: show for 2 seconds max, regardless of scene length
  const VISIBLE_FRAMES = Math.min(durationFrames, Math.round(fps * 2));

  // Don't render at all once the window has passed
  if (frame >= VISIBLE_FRAMES) return null;

  // Pop-in spring: 0 → 1.15 overshoot (snappy)
  const popSpring = spring({
    frame,
    fps,
    config: { damping: 7, stiffness: 280, mass: 0.5 },
  });
  const popScale = interpolate(popSpring, [0, 1], [0, 1.15], {
    extrapolateRight: 'clamp',
  });

  // Settle spring (runs slightly after pop)
  const settleSpring = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 16, stiffness: 200, mass: 0.6 },
  });
  const settleScale = interpolate(settleSpring, [0, 1], [1.15, 1.0], {
    extrapolateRight: 'clamp',
  });

  const finalScale = frame < 8 ? popScale : settleScale;

  // Fade in: frames 0–4. Fade out: last 25% of the visible window.
  const fadeOutStart = Math.round(VISIBLE_FRAMES * 0.75);
  const opacity =
    frame >= fadeOutStart
      ? interpolate(frame, [fadeOutStart, VISIBLE_FRAMES], [1, 0], { extrapolateRight: 'clamp' })
      : interpolate(frame, [0, 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Subtle float bob (only while fully visible)
  const floatY = frame > 8 ? Math.sin(frame / 10) * 4 : 0;

  const posStyle = POSITIONS[position] ?? POSITIONS['top-right'];

  return (
    <div
      style={{
        position: 'absolute',
        ...posStyle,
        zIndex: 15,
        width: 180,
        height: 180,
        transform: `scale(${finalScale}) translateY(${floatY}px)`,
        opacity,
        filter: 'drop-shadow(0 0 18px rgba(0, 242, 254, 0.55)) drop-shadow(0 4px 12px rgba(0,0,0,0.6))',
        pointerEvents: 'none',
      }}
    >
      <Img
        src={gifUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: '12px',
        }}
      />
      {/* GIPHY attribution badge — required by terms of service */}
      <div
        style={{
          position: 'absolute',
          bottom: -22,
          right: 0,
          fontSize: '11px',
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 700,
          color: 'rgba(255,255,255,0.45)',
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
        }}
      >
        Powered by GIPHY
      </div>
    </div>
  );
};


export default ReactionOverlay;
