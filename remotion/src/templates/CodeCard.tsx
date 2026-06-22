import React from 'react';
import { spring, interpolate } from 'remotion';

interface CodeCardProps {
  data: {
    language: string;
    code: string;
    highlightLines?: number[];
    badLines?: number[];
    goodLines?: number[];
  };
  durationFrames: number;
  frame: number;
}

export const CodeCard: React.FC<CodeCardProps> = ({ data, durationFrames, frame }) => {
  const { code = '', language = 'typescript', highlightLines = [], badLines = [], goodLines = [] } = data;

  // 1. Entry animation (spring)
  const entrySpring = spring({
    frame,
    fps: 30,
    config: { damping: 13, stiffness: 110 }
  });

  // 2. Slow, continuous camera zoom over the scene duration
  const zoomProgress = frame / (durationFrames || 1);
  const cameraZoom = interpolate(zoomProgress, [0, 1], [1.02, 1.24]);

  const scale = interpolate(entrySpring, [0, 1], [0.85, 1.0]) * cameraZoom;
  const translateY = interpolate(entrySpring, [0, 1], [80, 0]);
  const opacity = interpolate(entrySpring, [0, 1], [0, 1]);

  // Syntax highlighting helper
  const highlightCode = (codeStr: string) => {
    return codeStr.split('\n').map((line, idx) => {
      const lineNum = idx + 1;
      const isBad = badLines.includes(lineNum);
      const isGood = goodLines.includes(lineNum);
      const isHighlighted = isBad || isGood || highlightLines.includes(lineNum) || highlightLines.length === 0;
      const linePulse = 1 + Math.sin(frame / 3) * 0.025;
      const accent = isBad ? '#ff3b30' : isGood ? '#39ff14' : '#00f2fe';
      const background = isBad
        ? 'rgba(255, 59, 48, 0.16)'
        : isGood
          ? 'rgba(57, 255, 20, 0.13)'
          : isHighlighted
            ? 'rgba(0, 242, 254, 0.1)'
            : 'transparent';

      let html = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Keywords
      const keywords = ['const', 'let', 'var', 'await', 'async', 'function', 'class', 'import', 'export', 'from', 'return', 'try', 'catch', 'if', 'else', 'new', 'for', 'while', 'of', 'in'];
      keywords.forEach(kw => {
        const reg = new RegExp(`\\b${kw}\\b`, 'g');
        html = html.replace(reg, `<span class="syntax-keyword">${kw}</span>`);
      });

      // Strings
      html = html.replace(/(['"`])(.*?)\1/g, `<span class="syntax-string">$1$2$1</span>`);

      // Comments
      html = html.replace(/(\/\/.*)/g, `<span class="syntax-comment">$1</span>`);

      // Functions/Methods
      html = html.replace(/\b(\w+)(?=\()/g, `<span class="syntax-function">$1</span>`);

      return (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            backgroundColor: background,
            borderLeft: isHighlighted ? `9px solid ${accent}` : '9px solid transparent',
            padding: '8px 24px',
            opacity: isHighlighted ? 1 : 0.24,
            boxShadow: isHighlighted ? `0 0 30px ${isBad ? 'rgba(255,59,48,0.25)' : isGood ? 'rgba(57,255,20,0.22)' : 'rgba(0,242,254,0.18)'}, inset 6px 0 0 ${isBad ? 'rgba(255,59,48,0.32)' : isGood ? 'rgba(57,255,20,0.26)' : 'rgba(0,242,254,0.3)'}` : 'none',
            transition: 'all 0.3s ease',
            minHeight: '64px',
            borderRadius: isHighlighted ? '6px' : '0',
            transform: isBad || isGood ? `scale(${linePulse})` : undefined,
            transformOrigin: 'left center'
          }}
        >
          {/* Line Number */}
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '29px',
              color: '#8b949e',
              width: '52px',
              userSelect: 'none',
              textAlign: 'right',
              marginRight: '28px',
              opacity: 0.5
            }}
          >
            {lineNum}
          </span>
          {/* Highlighted Line Content */}
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '38px',
              lineHeight: '52px',
              whiteSpace: 'pre',
              color: '#c9d1d9',
              textShadow: isHighlighted ? '0 0 10px rgba(201, 209, 217, 0.3)' : 'none'
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      );
    });
  };

  return (
    <div
      className="glass-panel"
      style={{
        width: '100%',
        maxWidth: 1060,
        minHeight: 760,
        transform: `scale(${scale}) translateY(${translateY}px)`,
        opacity,
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        border: '2px solid rgba(255, 255, 255, 0.24)',
        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.7), 0 0 35px rgba(0, 242, 254, 0.18)'
      }}
    >
      {/* Editor Title Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '22px 28px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          background: 'rgba(15, 18, 25, 0.85)'
        }}
      >
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ff5f56' }} />
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#27c93f' }} />
        </div>
        <div
          style={{
            fontSize: '26px',
            color: '#8b949e',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 600
          }}
        >
          {language ? `example.${language === 'javascript' ? 'js' : language === 'typescript' ? 'ts' : language === 'python' ? 'py' : language}` : 'code.ts'}
        </div>
        <div style={{ width: '60px' }} /> {/* Spacer */}
      </div>

      {/* Code Area */}
      <div
        style={{
          padding: '36px 0',
          backgroundColor: 'rgba(8, 10, 14, 0.92)',
          textAlign: 'left',
          flex: 1
        }}
      >
        {highlightCode(code)}
      </div>
    </div>
  );
};

export default CodeCard;
