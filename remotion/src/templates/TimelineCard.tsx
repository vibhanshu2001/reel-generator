import React from 'react';
import { spring, interpolate } from 'remotion';

interface TimelineCardProps {
  data: {
    title?: string;
    steps: string[]; // e.g. ["User Authenticates", "Token Issued", "Saved in LocalStorage"]
  };
  durationFrames: number;
  frame: number;
}

export const TimelineCard: React.FC<TimelineCardProps> = ({ data, durationFrames, frame }) => {
  const { title = 'Process Steps', steps = [] } = data;

  // 1. Entry spring animation
  const entrySpring = spring({
    frame,
    fps: 30,
    config: { damping: 13, stiffness: 110 }
  });

  const scale = interpolate(entrySpring, [0, 1], [0.85, 1.0]);
  const opacity = interpolate(entrySpring, [0, 1], [0, 1]);

  // 2. Active step tracking: calculate index based on progression over duration frames
  const totalSteps = steps.length;
  const activeStepIdx = Math.min(
    Math.floor((frame / (durationFrames || 1)) * totalSteps),
    totalSteps - 1
  );

  // Dynamic font size: fewer steps = bigger text to fill the frame
  const stepFontSize = totalSteps <= 3 ? 40 : totalSteps <= 5 ? 32 : 26;
  const stepGap = totalSteps <= 3 ? 60 : totalSteps <= 5 ? 50 : 40;

  return (
    <div
      className="glass-panel"
      style={{
        width: '100%',
        height: '100%',
        transform: `scale(${scale})`,
        opacity,
        display: 'flex',
        flexDirection: 'column',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        padding: '40px 44px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 242, 254, 0.1)'
      }}
    >
      {/* Title Header */}
      <div
        style={{
          fontSize: '34px',
          fontWeight: 900,
          color: '#ffffff',
          letterSpacing: '1px',
          textAlign: 'center',
          marginBottom: '50px',
          textTransform: 'uppercase',
          borderBottom: '2px solid rgba(255, 255, 255, 0.12)',
          paddingBottom: '20px'
        }}
      >
        {title}
      </div>

      {/* Vertical Timeline Track */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '30px', justifyContent: 'center' }}>
        
        {/* Track Line Background */}
        <div
          style={{
            position: 'absolute',
            left: '46px',
            top: '30px',
            bottom: '30px',
            width: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '3px',
            zIndex: 1
          }}
        />

        {/* Dynamic Glowing Active Progress Tracker */}
        <div
          style={{
            position: 'absolute',
            left: '46px',
            top: '30px',
            height: `${(activeStepIdx / (totalSteps - 1 || 1)) * 90}%`,
            width: '6px',
            backgroundColor: '#00f2fe',
            boxShadow: '0 0 15px #00f2fe, 0 0 30px #00f2fe',
            borderRadius: '3px',
            zIndex: 2,
            transition: 'height 0.35s ease-out'
          }}
        />

        {/* Timeline Steps */}
        {steps.map((step, idx) => {
          const isActive = idx === activeStepIdx;
          const isCompleted = idx < activeStepIdx;

          // Slide-in translation for each timeline row
          const itemDelay = idx * 6;
          const itemSpring = spring({
            frame: frame - itemDelay < 0 ? 0 : frame - itemDelay,
            fps: 30,
            config: { damping: 11, stiffness: 130 }
          });

          const itemTranslateX = interpolate(itemSpring, [0, 1], [-25, 0]);
          const itemOpacity = interpolate(itemSpring, [0, 1], [0, 1]);

          // Dynamic colors & styles based on state
          let badgeBg = 'rgba(15, 23, 42, 0.9)';
          let badgeBorder = '2px solid rgba(255, 255, 255, 0.15)';
          let badgeColor = 'rgba(255, 255, 255, 0.4)';
          let badgeGlow = 'none';
          
          let textColor = 'rgba(255, 255, 255, 0.45)';
          const finalItemScale = isActive ? 1.05 : 1.0;

          if (isActive) {
            badgeBg = '#00f2fe';
            badgeBorder = '3px solid #ffffff';
            badgeColor = '#05050a';
            badgeGlow = '0 0 25px rgba(0, 242, 254, 0.8), 0 0 10px rgba(0, 242, 254, 0.3)';
            textColor = '#ffffff';
          } else if (isCompleted) {
            badgeBg = '#39ff14';
            badgeBorder = '2px solid #39ff14';
            badgeColor = '#000000';
            badgeGlow = '0 0 12px rgba(57, 255, 20, 0.3)';
            textColor = 'rgba(255, 255, 255, 0.85)';
          }

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: idx === totalSteps - 1 ? 0 : `${stepGap}px`,
                zIndex: 3,
                opacity: itemOpacity,
                transform: `translateX(${itemTranslateX}px) scale(${finalItemScale})`,
                transition: 'transform 0.15s ease-out, opacity 0.15s ease-out'
              }}
            >
              {/* Step indicator circle */}
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: badgeBg,
                  border: badgeBorder,
                  boxShadow: badgeGlow,
                  marginRight: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '18px',
                  color: badgeColor,
                  transition: 'all 0.25s ease'
                }}
              >
                {isCompleted ? '✓' : idx + 1}
              </div>

              {/* Step label text */}
              <div
                style={{
                  fontSize: `${stepFontSize}px`,
                  fontWeight: isActive ? 800 : 600,
                  color: textColor,
                  textAlign: 'left',
                  textShadow: isActive ? '0 0 10px rgba(255, 255, 255, 0.2)' : 'none',
                  transition: 'color 0.25s ease'
                }}
              >
                {step}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineCard;
