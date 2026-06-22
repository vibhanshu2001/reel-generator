import React from 'react';
import { spring, interpolate } from 'remotion';

interface TerminalSimulationProps {
  data: {
    command: string;
    output: string;
  };
  durationFrames: number;
  frame: number;
}

export const TerminalSimulation: React.FC<TerminalSimulationProps> = ({ data, durationFrames, frame }) => {
  const { command = 'redis-cli GET user:100', output = 'OK' } = data;

  // 1. Terminal window entry spring animation
  const entrySpring = spring({
    frame,
    fps: 30,
    config: { damping: 13, stiffness: 110 }
  });

  const scale = interpolate(entrySpring, [0, 1], [0.85, 1]);
  const translateY = interpolate(entrySpring, [0, 1], [70, 0]);
  const opacity = interpolate(entrySpring, [0, 1], [0, 1]);

  // 2. Typing speed configuration (Fast! 1 character every 1 frame to ensure it finishes typing quickly)
  const speed = 1.0;
  const charsTyped = Math.floor(frame / speed);
  const isTypingComplete = charsTyped >= command.length;
  const typedCommand = command.substring(0, charsTyped);

  // Blinking cursor state (toggles every 6 frames)
  const showCursor = !isTypingComplete || Math.floor(frame / 6) % 2 === 0;

  // 3. Staggered output lines fade-in (starts 3 frames after typing ends)
  const outputStartFrame = Math.ceil(command.length * speed) + 3;
  const outputLines = output.split('\n');

  return (
    <div
      className="glass-panel"
      style={{
        width: '100%',
        height: '100%',
        transform: `scale(${scale}) translateY(${translateY}px)`,
        opacity,
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        border: '2px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 35px rgba(0, 242, 254, 0.14)'
      }}
    >
      {/* Terminal Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '18px 24px',
          backgroundColor: 'rgba(15, 18, 25, 0.85)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)'
        }}
      >
        <div style={{ display: 'flex', gap: '10px', marginRight: '24px' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ff5f56' }} />
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#27c93f' }} />
        </div>
        <div
          style={{
            color: '#8b949e',
            fontSize: '20px',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 600
          }}
        >
          bash - redis-cli@terminal
        </div>
      </div>

      {/* Terminal Command Window */}
      <div
        style={{
          flex: 1,
          backgroundColor: 'rgba(8, 10, 14, 0.95)',
          padding: '40px 36px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '34px',
          lineHeight: '54px',
          color: '#ffffff',
          textAlign: 'left',
          overflow: 'hidden'
        }}
      >
        {/* Command Prompt Line */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '20px' }}>
          <span style={{ color: '#00f2fe', marginRight: '20px', userSelect: 'none', fontWeight: 800 }}>$</span>
          <span style={{ color: '#ffffff', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {typedCommand}
            {showCursor && (
              <span
                style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '30px',
                  backgroundColor: '#00f2fe',
                  marginLeft: '4px',
                  verticalAlign: 'middle',
                  boxShadow: '0 0 10px #00f2fe'
                }}
              />
            )}
          </span>
        </div>

        {/* Outputs Layer */}
        {frame >= outputStartFrame && (
          <div
            style={{
              color: '#a5d6ff',
              whiteSpace: 'pre-wrap',
              fontSize: '28px',
              lineHeight: '42px',
              marginTop: '10px'
            }}
          >
            {outputLines.map((line, idx) => {
              // Stagger lines fade in (each line appears 6 frames after the previous)
              const lineDelay = outputStartFrame + idx * 6;
              const lineSpring = spring({
                frame: frame - lineDelay < 0 ? 0 : frame - lineDelay,
                fps: 30,
                config: { damping: 10, stiffness: 120 }
              });
              const lineOpacity = interpolate(lineSpring, [0, 1], [0, 1]);
              const lineTranslateY = interpolate(lineSpring, [0, 1], [15, 0]);

              const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('fail');
              const isSuccess = line.toLowerCase().includes('success') || line.toLowerCase().includes('done') || line === 'OK' || line.includes('127.0.0.1');

              return (
                <div
                  key={idx}
                  style={{
                    opacity: lineOpacity,
                    transform: `translateY(${lineTranslateY}px)`,
                    color: isError ? '#ff5f56' : isSuccess ? '#39ff14' : '#a5d6ff',
                    textShadow: isSuccess ? '0 0 12px rgba(57, 255, 20, 0.3)' : 'none',
                    marginBottom: '8px'
                  }}
                >
                  {line}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalSimulation;
