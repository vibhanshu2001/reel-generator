import React from 'react';
import { spring, interpolate, useVideoConfig } from 'remotion';

interface ComparisonCardProps {
  data: {
    title: string;
    headers: string[]; // e.g. ["Feature", "Postgres", "Redis"]
    rows: string[][]; // e.g. [["Speed", "40ms", "0.2ms"], ["Schema", "Rigid", "Flexible"]]
  };
  durationFrames: number;
  frame: number;
}

export const ComparisonCard: React.FC<ComparisonCardProps> = ({ data, durationFrames, frame }) => {
  const { title = 'Benchmark', headers = ['Feature', 'Postgres', 'Redis'], rows = [] } = data;
  const { fps } = useVideoConfig();
  const isProblemPayoff = normalizeHeader(headers[1]) === 'problem' && normalizeHeader(headers[2]) === 'payoff';

  // Base entry animation
  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 }
  });
  const layoutScale = interpolate(entrySpring, [0, 1], [0.85, 1]);
  const layoutOpacity = interpolate(entrySpring, [0, 1], [0, 1]);

  // Helper: check if a string contains numbers or units
  const isNumeric = (str: string) => /[\d\.]+/.test(str);

  // We look for a row comparing numeric values (typically the first row if comparing speed/latency)
  const numericRow = rows.find(row => row.length >= 3 && isNumeric(row[1]) && isNumeric(row[2]));

  if (numericRow) {
    // --- MODE A: BENCHMARK BAR CHART ---
    const featureName = numericRow[0];
    const val1Str = numericRow[1];
    const val2Str = numericRow[2];

    const num1 = parseFloat(val1Str.match(/[\d\.]+/)![0]);
    const num2 = parseFloat(val2Str.match(/[\d\.]+/)![0]);

    const label1 = headers[1] || 'Postgres';
    const label2 = headers[2] || 'Redis';

    // Latency comparison vs general numeric comparison:
    // If it's latency (lower is better), bar 1 (Postgres) is huge, bar 2 (Redis) is tiny.
    const isLatency = val1Str.toLowerCase().includes('ms') || val1Str.toLowerCase().includes('sec');

    // Bar sizes (percentages)
    let bar1WidthTarget = 85;
    let bar2WidthTarget = 85;

    if (isLatency) {
      // Postgres (large) vs Redis (tiny)
      bar1WidthTarget = 85;
      bar2WidthTarget = Math.max(5, (num2 / num1) * 85);
    } else {
      // General comparison (larger is better, e.g. throughput)
      bar1WidthTarget = Math.max(5, (num1 / num2) * 85);
      bar2WidthTarget = 85;
    }

    // Bar 1 (Postgres/Slow) animation: Slow growth
    const bar1Spring = spring({
      frame: frame - 10 < 0 ? 0 : frame - 10,
      fps,
      config: { damping: 15, stiffness: 60 } // Slow build
    });
    const bar1Width = interpolate(bar1Spring, [0, 1], [0, bar1WidthTarget]);

    // Bar 2 (Redis/Fast) animation: Instant pop after 25 frames
    const bar2Spring = spring({
      frame: frame - 25 < 0 ? 0 : frame - 25,
      fps,
      config: { damping: 10, stiffness: 220, mass: 0.2 } // Snappy pop
    });
    const bar2Width = interpolate(bar2Spring, [0, 1], [0, bar2WidthTarget]);

    // Calculate speed factor (e.g. 40ms / 0.2ms = 200x)
    const factor = num1 > num2 ? (num1 / num2) : (num2 / num1);
    const speedFactorText = factor >= 2 ? `${Math.round(factor)}x FASTER` : '';

    // Badge spring entry
    const badgeSpring = spring({
      frame: frame - 35 < 0 ? 0 : frame - 35,
      fps,
      config: { damping: 8, stiffness: 180 }
    });
    const badgeScale = interpolate(badgeSpring, [0, 1], [0, 1]);

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${layoutScale})`,
          opacity: layoutOpacity,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          fontFamily: "'Outfit', sans-serif",
          color: '#ffffff',
          padding: '30px'
        }}
      >
        <h2 style={{ fontSize: fitFontSize(title, 38, 28), fontWeight: 900, color: '#ffdf00', textTransform: 'uppercase', letterSpacing: 0, textAlign: 'center', marginBottom: '50px', textShadow: '0 0 15px rgba(255, 223, 0, 0.4)', lineHeight: 1.05 }}>
          {title}
        </h2>

        {/* Benchmark Visuals Container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', width: '100%', textAlign: 'left', padding: '0 20px' }}>
          
          {/* Bar 1 (Postgres / Slow) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '85%', fontSize: '26px', fontWeight: 700, color: '#8b949e' }}>
              <span>{label1}</span>
              <span style={{ color: '#ff3b30' }}>{val1Str}</span>
            </div>
            <div
              style={{
                width: `${bar1Width}%`,
                height: '50px',
                background: 'linear-gradient(90deg, #ff3b30 0%, #ff7b72 100%)',
                borderRadius: '12px',
                boxShadow: '0 4px 15px rgba(255, 59, 48, 0.3)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '20px'
              }}
            >
              {bar1Width > 15 && <span style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>SLOW</span>}
            </div>
          </div>

          {/* Bar 2 (Redis / Fast) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '85%', fontSize: '26px', fontWeight: 700, color: '#ffffff' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {label2} <span style={{ color: '#00f2fe' }}>FAST</span>
              </span>
              <span style={{ color: '#39ff14', textShadow: '0 0 15px rgba(57,255,20,0.5)' }}>{val2Str}</span>
            </div>
            <div
              style={{
                width: `${bar2Width}%`,
                height: '50px',
                background: 'linear-gradient(90deg, #39ff14 0%, #00ffcc 100%)',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(57, 255, 20, 0.4), 0 0 15px rgba(0, 242, 254, 0.3)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '20px',
                transition: 'width 0.05s ease-out'
              }}
            >
              {bar2Width > 15 && <span style={{ fontSize: '20px', fontWeight: 800, color: '#000000' }}>FAST</span>}
            </div>
          </div>

        </div>

        {/* Speed Multiplier Badge */}
        {speedFactorText && (
          <div
            style={{
              marginTop: '60px',
              display: 'flex',
              justifyContent: 'center',
              transform: `scale(${badgeScale})`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #ffdf00 0%, #39ff14 100%)',
                color: '#000000',
                padding: '20px 45px',
                borderRadius: '8px',
                fontSize: '34px',
                fontWeight: 900,
                boxShadow: '0 12px 30px rgba(57, 255, 20, 0.3), 0 0 15px rgba(255, 223, 0, 0.2)',
                letterSpacing: 0,
                transform: 'rotate(-2deg)'
              }}
            >
              {speedFactorText}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- MODE B: DUAL PILLAR COLUMN MATRIX ---
  const col1Name = headers[1] || 'DB 1';
  const col2Name = headers[2] || 'DB 2';
  const titleFontSize = fitFontSize(title, isProblemPayoff ? 56 : 36, isProblemPayoff ? 34 : 28);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        transform: `scale(${layoutScale})`,
        opacity: layoutOpacity,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        fontFamily: "'Outfit', sans-serif",
        color: '#ffffff',
        padding: isProblemPayoff ? '34px 28px' : '20px'
      }}
    >
      <h2 style={{ fontSize: titleFontSize, fontWeight: 900, color: isProblemPayoff ? '#ffffff' : '#00f2fe', textTransform: 'uppercase', letterSpacing: 0, textAlign: 'center', marginBottom: isProblemPayoff ? '34px' : '40px', lineHeight: 1.02, textShadow: '0 8px 24px rgba(0,0,0,0.55)' }}>
        {title}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isProblemPayoff ? '18px' : '24px', width: '100%', padding: isProblemPayoff ? 0 : '0 10px' }}>
        {/* Pillar 1 (Postgres/SQL/Standard) */}
        <div className="glass-panel" style={columnStyle('problem', isProblemPayoff)}>
          <div style={columnHeaderStyle('problem', isProblemPayoff)}>
            {col1Name}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: isProblemPayoff ? '12px' : '16px', textAlign: 'left' }}>
            {rows.map((row, idx) => {
              const rowSpring = spring({
                frame: frame - (10 + idx * 6) < 0 ? 0 : frame - (10 + idx * 6),
                fps,
                config: { damping: 12, stiffness: 120 }
              });
              const rowOpacity = interpolate(rowSpring, [0, 1], [0, 1]);
              const rowTranslateY = interpolate(rowSpring, [0, 1], [15, 0]);

              return (
                <div key={idx} style={{ opacity: rowOpacity, transform: `translateY(${rowTranslateY}px)` }}>
                  <div style={rowLabelStyle(isProblemPayoff)}>{row[0]}</div>
                  <div style={rowValueStyle(row[1], 'problem', isProblemPayoff)}>{row[1]}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pillar 2 (Redis/Target/Fast) */}
        <div className="glass-panel" style={columnStyle('payoff', isProblemPayoff)}>
          <div style={columnHeaderStyle('payoff', isProblemPayoff)}>
            {col2Name}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: isProblemPayoff ? '12px' : '16px', textAlign: 'left' }}>
            {rows.map((row, idx) => {
              const rowSpring = spring({
                frame: frame - (18 + idx * 6) < 0 ? 0 : frame - (18 + idx * 6),
                fps,
                config: { damping: 10, stiffness: 150 }
              });
              const rowOpacity = interpolate(rowSpring, [0, 1], [0, 1]);
              const rowTranslateY = interpolate(rowSpring, [0, 1], [15, 0]);

              return (
                <div key={idx} style={{ opacity: rowOpacity, transform: `translateY(${rowTranslateY}px)` }}>
                  <div style={rowLabelStyle(isProblemPayoff)}>{row[0]}</div>
                  <div style={rowValueStyle(row[2], 'payoff', isProblemPayoff)}>{row[2]}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

function normalizeHeader(value: string | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function fitFontSize(value: string, max: number, min: number): number {
  const length = String(value || '').length;
  if (length <= 18) return max;
  if (length <= 34) return Math.max(min, max - 8);
  if (length <= 52) return Math.max(min, max - 16);
  return min;
}

function columnStyle(kind: 'problem' | 'payoff', framework: boolean): React.CSSProperties {
  const accent = kind === 'problem' ? '#ff5f56' : '#39ff14';
  return {
    borderColor: framework ? `${accent}88` : `${accent}4d`,
    display: 'flex',
    flexDirection: 'column',
    gap: framework ? 16 : 20,
    minHeight: framework ? 520 : undefined,
    padding: framework ? '28px 22px' : undefined,
    background: framework ? 'rgba(3, 8, 12, 0.76)' : `${accent}08`,
    boxShadow: framework ? `0 18px 50px rgba(0,0,0,0.45), 0 0 26px ${accent}24` : `0 10px 30px ${accent}14`,
    backdropFilter: 'blur(10px)'
  };
}

function columnHeaderStyle(kind: 'problem' | 'payoff', framework: boolean): React.CSSProperties {
  const accent = kind === 'problem' ? '#ff5f56' : '#39ff14';
  return {
    fontSize: framework ? 34 : 28,
    fontWeight: 900,
    color: accent,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingBottom: framework ? 14 : 10,
    borderBottom: `2px solid ${accent}3d`,
    textShadow: `0 0 12px ${accent}52`,
    letterSpacing: 0,
    lineHeight: 1
  };
}

function rowLabelStyle(framework: boolean): React.CSSProperties {
  return {
    fontSize: framework ? 17 : 15,
    color: '#aeb6c2',
    textTransform: 'uppercase',
    fontWeight: 800,
    letterSpacing: 0,
    marginBottom: 5,
    lineHeight: 1.1
  };
}

function rowValueStyle(value: string, kind: 'problem' | 'payoff', framework: boolean): React.CSSProperties {
  const accent = kind === 'problem' ? '#ffffff' : '#d9ffe0';
  return {
    fontSize: framework ? fitFontSize(value, 34, 22) : fitFontSize(value, 22, 18),
    color: framework ? accent : kind === 'problem' ? '#ffffff' : '#39ff14',
    fontWeight: framework ? 900 : kind === 'problem' ? 700 : 800,
    marginTop: 2,
    lineHeight: 1.08,
    letterSpacing: 0,
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    wordBreak: 'normal',
    textShadow: kind === 'payoff' ? '0 0 8px rgba(57,255,20,0.25)' : '0 5px 16px rgba(0,0,0,0.5)'
  };
}

export default ComparisonCard;
