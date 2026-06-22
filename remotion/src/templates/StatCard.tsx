import React from 'react';
import { spring, interpolate, useVideoConfig } from 'remotion';

interface StatCardProps {
  data: {
    value: string; // e.g. "0.2ms" or "200x" or "99.9%"
    label: string; // e.g. "Redis Response Time" or "Speedup"
    subtext?: string;
    trend?: string;
    counterSteps?: number[];
  };
  durationFrames: number;
  frame: number;
}

export const StatCard: React.FC<StatCardProps> = ({ data, durationFrames, frame }) => {
  const { value = '100%', label = 'Stat Label', subtext = '', trend = '', counterSteps = [] } = data;
  const { fps } = useVideoConfig();
  const isMetric = isShortMetric(value);

  // 1. Entry animation for the full layout
  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 120 }
  });
  const layoutScale = interpolate(entrySpring, [0, 1], [0.75, 1]);
  const layoutOpacity = interpolate(entrySpring, [0, 1], [0, 1]);

  if (!isMetric) {
    const headline = compactText(value !== '100%' ? value : label, 52);
    const supportText = compactText(subtext || (label !== 'Stat Label' ? label : ''), 54);
    const headlineFontSize = headline.length > 42 ? 74 : headline.length > 28 ? 88 : 108;

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${layoutScale})`,
          opacity: layoutOpacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontFamily: "'Outfit', sans-serif",
          padding: '64px 46px',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            fontSize: '34px',
            fontWeight: 800,
            color: '#ffdf00',
            textTransform: 'uppercase',
            letterSpacing: 0,
            marginBottom: '30px'
          }}
        >
          Pay attention
        </div>
        <div
          style={{
            maxWidth: 940,
            fontSize: `${headlineFontSize}px`,
            fontWeight: 900,
            lineHeight: 0.94,
            color: '#ffffff',
            letterSpacing: 0,
            textTransform: 'uppercase',
            textWrap: 'balance',
            textShadow: '0 0 34px rgba(0, 242, 254, 0.48), 0 8px 22px rgba(0,0,0,0.55)'
          }}
        >
          {headline}
        </div>
        {supportText && (
          <div
            style={{
              maxWidth: 820,
              marginTop: '34px',
              fontSize: '34px',
              fontWeight: 700,
              lineHeight: 1.14,
              color: '#c9d1d9',
              letterSpacing: 0
            }}
          >
            {supportText}
          </div>
        )}
      </div>
    );
  }

  // 2. Parse numeric value and suffix
  const numericMatch = value.match(/[\d\.]+/);
  const targetNum = numericMatch ? parseFloat(numericMatch[0]) : 100;
  const suffix = value.replace(/[\d\.]+/g, '');

  // Determine if it's a latency (ms/seconds) -> count down, or multiplier/percentage -> count up
  const isLatency = value.toLowerCase().includes('ms') || value.toLowerCase().includes('sec');
  const startVal = isLatency ? Math.max(targetNum * 150, 100) : 0;

  // 3. Spreading count animation over the first 30 frames
  const countSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90, mass: 0.8 }
  });

  const stepIndex = Math.min(counterSteps.length - 1, Math.floor((frame / Math.max(1, Math.min(durationFrames, 54))) * counterSteps.length));
  const currentNum = counterSteps.length > 0
    ? counterSteps[Math.max(0, stepIndex)]
    : interpolate(countSpring, [0, 1], [startVal, targetNum]);

  // Fix decimals if target number has them
  const hasDecimal = targetNum.toString().includes('.');
  const decimalPlaces = hasDecimal ? (targetNum.toString().split('.')[1] || '').length : 0;
  const formattedNum = currentNum.toFixed(decimalPlaces);

  // 4. Speed Gauge SVG needle rotation:
  // Rotation from -90 deg (left/slow) to +90 deg (right/fast).
  // If it's latency, a smaller value is faster (needle goes right). If it's a multiplier, a larger value is faster.
  const speedPercentage = isLatency 
    ? Math.max(0, Math.min(1, (startVal - currentNum) / (startVal - targetNum || 1)))
    : Math.max(0, Math.min(1, currentNum / (targetNum || 1)));

  const needleRotation = interpolate(speedPercentage, [0, 1], [-90, 90]);

  // 5. Pulsing visual elements: glowing pulse every 20 frames
  const pulseScale = 1.0 + Math.sin(frame / 3) * 0.03 * (frame > 25 ? 1 : 0);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        transform: `scale(${layoutScale})`,
        opacity: layoutOpacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontFamily: "'Outfit', sans-serif",
        padding: '20px'
      }}
    >
      {/* Dynamic Header */}
      <div
        style={{
          fontSize: '40px',
          fontWeight: 800,
          color: '#8b949e',
          textTransform: 'uppercase',
          letterSpacing: 0,
          marginBottom: '28px',
          textAlign: 'center',
          textShadow: '0 4px 10px rgba(0,0,0,0.5)'
        }}
      >
        {label}
      </div>

      {/* Speed Gauge / Gauge representation */}
      <div style={{ position: 'relative', width: 580, height: 330, display: 'flex', justifyContent: 'center', overflow: 'hidden', marginBottom: '-6px' }}>
        {/* SVG Speedometer Arc */}
        <svg width="500" height="290" style={{ position: 'absolute', top: 10 }}>
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff3b30" />   {/* Red (Slow) */}
              <stop offset="50%" stopColor="#ffcc00" />  {/* Yellow */}
              <stop offset="100%" stopColor="#34c759" /> {/* Green (Fast) */}
            </linearGradient>
            <linearGradient id="needleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#00f2fe" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background Track */}
          <path
            d="M 55 250 A 195 195 0 0 1 445 250"
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="24"
            strokeLinecap="round"
          />

          {/* Active Gradient Speed Track */}
          <path
            d="M 55 250 A 195 195 0 0 1 445 250"
            fill="none"
            stroke="url(#gaugeGrad)"
            strokeWidth="20"
            strokeDasharray="612"
            strokeDashoffset={612 - (speedPercentage * 612)}
            strokeLinecap="round"
            filter="url(#glow)"
            style={{
              transition: 'stroke-dashoffset 0.05s ease-out'
            }}
          />

          {/* Tick Marks */}
          {[0, 1, 2, 3, 4, 5, 6].map((tick) => {
            const angle = -180 + (tick * 30);
            const rad = (angle * Math.PI) / 180;
            const x1 = 250 + 168 * Math.cos(rad);
            const y1 = 250 + 168 * Math.sin(rad);
            const x2 = 250 + 188 * Math.cos(rad);
            const y2 = 250 + 188 * Math.sin(rad);
            return (
              <line
                key={tick}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="3"
              />
            );
          })}

          {/* Central needle anchor point */}
          <circle cx="250" cy="250" r="18" fill="#05050a" stroke="#00f2fe" strokeWidth="4" />
          <circle cx="250" cy="250" r="7" fill="#00f2fe" />
          
          {/* Moving Gauge Needle */}
          <g transform={`rotate(${needleRotation}, 250, 250)`}>
            <polygon
              points="245,250 255,250 250,50"
              fill="url(#needleGrad)"
              style={{
                filter: 'drop-shadow(0 0 5px rgba(0, 242, 254, 0.8))'
              }}
            />
          </g>
        </svg>
      </div>

      {/* Giant Exploding Value */}
      <div
        style={{
          fontSize: counterSteps.length > 0 ? '174px' : '150px',
          fontWeight: 900,
          fontFamily: "'Outfit', sans-serif",
          color: '#ffffff',
          letterSpacing: 0,
          lineHeight: counterSteps.length > 0 ? '166px' : '144px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${pulseScale})`,
          textShadow: '0 0 40px rgba(0, 242, 254, 0.6), 0 0 80px rgba(0, 242, 254, 0.2)',
          marginBottom: '16px'
        }}
      >
        <span>{formattedNum}</span>
        <span style={{ color: '#00f2fe', marginLeft: '5px' }}>{suffix}</span>
      </div>

      {/* Subtext description */}
      {subtext && (
        <div
          style={{
            fontSize: '30px',
            color: '#8b949e',
            fontWeight: 500,
            marginBottom: '30px',
            textAlign: 'center',
            maxWidth: '85%'
          }}
        >
          {subtext}
        </div>
      )}

      {/* Trend indicator badge */}
      {trend && (
        <div
          style={{
            backgroundColor: 'rgba(57, 255, 20, 0.15)',
            border: '2px solid rgba(57, 255, 20, 0.4)',
            color: '#39ff14',
            padding: '12px 28px',
            borderRadius: '50px',
            fontSize: '24px',
            fontWeight: 800,
            boxShadow: '0 8px 25px rgba(57, 255, 20, 0.25), 0 0 10px rgba(57, 255, 20, 0.2)',
            textTransform: 'uppercase',
            letterSpacing: 0
          }}
        >
          {trend}
        </div>
      )}

      {/* Decorative accent bars — fills vertical space when subtext/trend are absent */}
      {!subtext && !trend && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '28px', alignItems: 'flex-end' }}>
          {[0.4, 0.65, 1.0, 0.75, 0.5, 0.3].map((h, i) => (
            <div
              key={i}
              style={{
                width: '18px',
                height: `${h * 60 * (0.6 + Math.sin((frame + i * 8) / 10) * 0.4)}px`,
                borderRadius: '4px',
                background: i === 2 ? '#00f2fe' : 'rgba(0, 242, 254, 0.3)',
                boxShadow: i === 2 ? '0 0 16px rgba(0, 242, 254, 0.6)' : 'none',
                transition: 'height 0.05s linear'
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function isShortMetric(value: string): boolean {
  const trimmed = String(value || '').trim();
  return trimmed.length <= 12 && /^[~<>+\-]?\d[\d,.]*(\.\d+)?\s*(k|m|b|x|%|ms|s|sec|rps|qps|req\/s|\/s)?$/i.test(trimmed);
}

function compactText(value: string, maxLength: number): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

export default StatCard;
