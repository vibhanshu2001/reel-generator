export type StylePackId = 'terminal' | 'cyberpunk' | 'infographic' | 'minimal';

export interface StylePack {
  id: StylePackId;
  palette: {
    background: string;
    foreground: string;
    accent: string;
    danger: string;
    success: string;
  };
  typography: 'mono' | 'geometric' | 'editorial';
  glowIntensity: number;
  backgroundType: 'terminal' | 'grid' | 'chart' | 'clean';
  transitionStyle: 'cut' | 'smash_zoom' | 'wipe' | 'fade';
  cameraAggression: number;
  primitiveDefaults: {
    borderRadius: number;
    strokeWidth: number;
  };
}

export const STYLE_PACKS: Record<StylePackId, StylePack> = {
  terminal: {
    id: 'terminal',
    palette: {
      background: '#020806',
      foreground: '#e6ffe6',
      accent: '#39ff14',
      danger: '#ff3b30',
      success: '#39ff14'
    },
    typography: 'mono',
    glowIntensity: 0.45,
    backgroundType: 'terminal',
    transitionStyle: 'cut',
    cameraAggression: 0.65,
    primitiveDefaults: { borderRadius: 6, strokeWidth: 3 }
  },
  cyberpunk: {
    id: 'cyberpunk',
    palette: {
      background: '#05050b',
      foreground: '#ffffff',
      accent: '#00f2fe',
      danger: '#ff2d55',
      success: '#39ff14'
    },
    typography: 'geometric',
    glowIntensity: 0.85,
    backgroundType: 'grid',
    transitionStyle: 'smash_zoom',
    cameraAggression: 0.9,
    primitiveDefaults: { borderRadius: 8, strokeWidth: 4 }
  },
  infographic: {
    id: 'infographic',
    palette: {
      background: '#f7fafc',
      foreground: '#101828',
      accent: '#2563eb',
      danger: '#dc2626',
      success: '#16a34a'
    },
    typography: 'geometric',
    glowIntensity: 0.1,
    backgroundType: 'chart',
    transitionStyle: 'wipe',
    cameraAggression: 0.35,
    primitiveDefaults: { borderRadius: 4, strokeWidth: 3 }
  },
  minimal: {
    id: 'minimal',
    palette: {
      background: '#0b0d10',
      foreground: '#f5f5f5',
      accent: '#facc15',
      danger: '#ef4444',
      success: '#22c55e'
    },
    typography: 'editorial',
    glowIntensity: 0.2,
    backgroundType: 'clean',
    transitionStyle: 'fade',
    cameraAggression: 0.25,
    primitiveDefaults: { borderRadius: 4, strokeWidth: 2 }
  }
};

export function selectStylePack(topic: string): StylePackId {
  const normalized = topic.toLowerCase();
  if (/\b(cli|terminal|linux|bash|shell|docker|git)\b/.test(normalized)) return 'terminal';
  if (/\b(metric|benchmark|latency|database|system design|architecture)\b/.test(normalized)) return 'infographic';
  if (/\b(clean|simple|minimal|design)\b/.test(normalized)) return 'minimal';
  return 'cyberpunk';
}
