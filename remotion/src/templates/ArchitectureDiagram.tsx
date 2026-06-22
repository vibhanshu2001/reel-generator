import React from 'react';
import { spring, interpolate, useVideoConfig } from 'remotion';

interface Node {
  id: string;
  label: string;
  x: number; // percent
  y: number; // percent
  highlight?: boolean;
}

interface Edge {
  from: string;
  to: string;
  animated?: boolean;
}

interface ArchitectureDiagramProps {
  data: {
    title?: string;
    nodes: Node[];
    edges: Edge[];
  };
  durationFrames: number;
  frame: number;
}

export const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = ({ data, durationFrames, frame }) => {
  const { title = 'System Architecture', nodes = [], edges = [] } = data;
  const { fps } = useVideoConfig();

  // 1. Entry animation
  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 100 }
  });
  const layoutScale = interpolate(entrySpring, [0, 1], [0.85, 1]);
  const layoutOpacity = interpolate(entrySpring, [0, 1], [0, 1]);

  // Coordinates helper
  const findNode = (id: string) => nodes.find(n => n.id === id);

  // SVG Icon Renderer for each node type based on its label/id keywords
  const renderNodeIcon = (node: Node, size: number = 80) => {
    const isUser = node.id.toLowerCase().includes('user') || node.id.toLowerCase().includes('client') || node.label.toLowerCase().includes('user') || node.label.toLowerCase().includes('microservices');
    const isCache = node.id.toLowerCase().includes('cache') || node.id.toLowerCase().includes('redis') || node.label.toLowerCase().includes('cache') || node.label.toLowerCase().includes('redis') || node.label.toLowerCase().includes('kafka');
    const isDb = node.id.toLowerCase().includes('db') || node.id.toLowerCase().includes('sql') || node.id.toLowerCase().includes('postgres') || node.id.toLowerCase().includes('database') || node.label.toLowerCase().includes('db') || node.label.toLowerCase().includes('database') || node.label.toLowerCase().includes('postgres') || node.label.toLowerCase().includes('streams');

    const color = node.highlight ? '#00f2fe' : '#ffffff';

    if (isUser) {
      // Laptop / Client Icon
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="2" y1="20" x2="22" y2="20" />
          <line x1="12" y1="17" x2="12" y2="20" />
        </svg>
      );
    }

    if (isCache) {
      // Cache Rack with Lightning Bolt
      return (
        <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="6" rx="1" />
            <rect x="2" y="9" width="20" height="6" rx="1" />
            <rect x="2" y="16" width="20" height="6" rx="1" />
            <line x1="6" y1="5" x2="6.01" y2="5" />
            <line x1="6" y1="12" x2="6.01" y2="12" />
            <line x1="6" y1="19" x2="6.01" y2="19" />
          </svg>
          <svg
            width={size / 2}
            height={size / 2}
            viewBox="0 0 24 24"
            fill="#ffdf00"
            stroke="#ffdf00"
            strokeWidth="1"
            style={{
              position: 'absolute',
              top: size / 4,
              left: size / 3,
              filter: 'drop-shadow(0 0 8px #ffdf00)'
            }}
          >
            <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />
          </svg>
        </div>
      );
    }

    if (isDb) {
      // Database Cylinder Stack
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
        </svg>
      );
    }

    // Default Node Server Box
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
    );
  };

  // Node scale calculations. We check if an edge is active and flowing.
  // A node pulses slightly when packets hit it.
  const getNodeScale = (nodeId: string) => {
    // Check if any edge enters this node and is animated
    const incomingEdges = edges.filter(e => e.to === nodeId && e.animated);
    if (incomingEdges.length === 0) return 1.0;

    // Pulse based on active frames (cycles every 40 frames)
    const cycle = (frame / 40) % 1;
    // Packet "hits" the node when cycle is near 0.95 - 1.0 or 0.0 - 0.05
    const isHitting = cycle > 0.9 || cycle < 0.1;
    if (isHitting) {
      // Small pulse bounce
      return 1.08 + Math.sin(cycle * Math.PI) * 0.04;
    }
    return 1.0;
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        transform: `scale(${layoutScale})`,
        opacity: layoutOpacity,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        color: '#ffffff',
        fontFamily: "'Outfit', sans-serif",
        padding: '24px'
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: '34px',
          fontWeight: 900,
          color: '#ffffff',
          letterSpacing: '1px',
          textAlign: 'center',
          marginBottom: '50px',
          textTransform: 'uppercase',
          textShadow: '0 4px 10px rgba(0,0,0,0.5)'
        }}
      >
        {title}
      </div>

      {/* SVG Connections & Packets Canvas */}
      <div style={{ flex: 1, position: 'relative', width: '100%' }}>
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible'
          }}
        >
          <defs>
            <linearGradient id="edgeGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
              <stop offset="50%" stopColor="#00f2fe" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
            </linearGradient>
            <filter id="packetGlow">
              <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {edges.map((edge, idx) => {
            const startNode = findNode(edge.from);
            const endNode = findNode(edge.to);
            if (!startNode || !endNode) return null;

            // Map grid % to SVG width/height representation
            const x1 = `${startNode.x}%`;
            const y1 = `${startNode.y}%`;
            const x2 = `${endNode.x}%`;
            const y2 = `${endNode.y}%`;

            // Flow packets offset math (cycles every 40 frames)
            const packetCycle1 = (frame / 40) % 1;
            const px1 = `${startNode.x + (endNode.x - startNode.x) * packetCycle1}%`;
            const py1 = `${startNode.y + (endNode.y - startNode.y) * packetCycle1}%`;

            // Offset second packet by 0.5 (half phase)
            const packetCycle2 = ((frame + 20) / 40) % 1;
            const px2 = `${startNode.x + (endNode.x - startNode.x) * packetCycle2}%`;
            const py2 = `${startNode.y + (endNode.y - startNode.y) * packetCycle2}%`;

            return (
              <React.Fragment key={idx}>
                {/* Edge Pathway */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />

                {/* Animated Edge Flowing Packets */}
                {edge.animated && (
                  <>
                    <circle
                      cx={px1}
                      cy={py1}
                      r="12"
                      fill="#00f2fe"
                      filter="url(#packetGlow)"
                      style={{
                        boxShadow: '0 0 15px #00f2fe'
                      }}
                    />
                    <circle
                      cx={px2}
                      cy={py2}
                      r="12"
                      fill="#39ff14"
                      filter="url(#packetGlow)"
                      style={{
                        boxShadow: '0 0 15px #39ff14'
                      }}
                    />
                  </>
                )}
              </React.Fragment>
            );
          })}
        </svg>

        {/* Nodes DOM Layer */}
        {nodes.map((node) => {
          const isKafka = node.id.toLowerCase().includes('kafka') || node.id.toLowerCase().includes('redis') || node.id.toLowerCase().includes('cache');
          const entryDelay = isKafka || node.highlight ? 18 : 6;
          
          const nodeEntry = spring({
            frame: frame - entryDelay < 0 ? 0 : frame - entryDelay,
            fps,
            config: { damping: 10, stiffness: 140 }
          });
          const entryScale = interpolate(nodeEntry, [0, 1], [0, 1]);

          const pulseScale = getNodeScale(node.id);
          const finalScale = entryScale * pulseScale;

          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: `translate(-50%, -50%) scale(${finalScale})`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                zIndex: 10
              }}
            >
              {/* Graphic Icon Container */}
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '30px',
                  backgroundColor: node.highlight ? 'rgba(0, 242, 254, 0.12)' : 'rgba(15, 23, 42, 0.85)',
                  border: node.highlight ? '3px solid #00f2fe' : '2px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: node.highlight 
                    ? '0 0 35px rgba(0, 242, 254, 0.35), inset 0 0 15px rgba(0, 242, 254, 0.15)'
                    : '0 10px 25px rgba(0,0,0,0.5)',
                  transition: 'all 0.15s ease-out'
                }}
              >
                {renderNodeIcon(node, 60)}
              </div>

              {/* Label */}
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: node.highlight ? '#00f2fe' : '#ffffff',
                  backgroundColor: 'rgba(5, 5, 10, 0.8)',
                  padding: '6px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {node.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ArchitectureDiagram;
