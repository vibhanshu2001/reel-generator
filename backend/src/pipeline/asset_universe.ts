export type AssetCategory =
  | 'icons'
  | 'particles'
  | 'counters'
  | 'graphs'
  | 'transitions'
  | 'cameraMoves'
  | 'terminalEffects'
  | 'codeThemes'
  | 'badges'
  | 'networkPackets'
  | 'infrastructureObjects';

export interface AssetDefinition {
  id: string;
  category: AssetCategory;
  label: string;
}

export const ASSET_UNIVERSE: AssetDefinition[] = [
  { id: 'icon-warning', category: 'icons', label: 'Warning triangle' },
  { id: 'icon-check', category: 'icons', label: 'Success check' },
  { id: 'particles-data-flow', category: 'particles', label: 'Flowing data particles' },
  { id: 'counter-burst', category: 'counters', label: 'Rapid count-up burst' },
  { id: 'graph-latency-drop', category: 'graphs', label: 'Latency drop graph' },
  { id: 'transition-smash-zoom', category: 'transitions', label: 'Smash zoom transition' },
  { id: 'camera-push-in', category: 'cameraMoves', label: 'Aggressive push-in' },
  { id: 'terminal-typing', category: 'terminalEffects', label: 'Typed command reveal' },
  { id: 'code-theme-dark', category: 'codeThemes', label: 'Dark editor theme' },
  { id: 'badge-10x', category: 'badges', label: '10x badge' },
  { id: 'packet-neon', category: 'networkPackets', label: 'Neon network packet' },
  { id: 'infra-database', category: 'infrastructureObjects', label: 'Database cylinder' },
  { id: 'infra-cache', category: 'infrastructureObjects', label: 'Cache node' },
  { id: 'infra-queue', category: 'infrastructureObjects', label: 'Queue broker' }
];

export function selectAssetsForTemplate(template: string, hasCounter: boolean): string[] {
  const base = ['transition-smash-zoom', 'camera-push-in'];

  if (template === 'code-card') return [...base, 'code-theme-dark', 'terminal-typing'];
  if (template === 'terminal-simulation') return [...base, 'terminal-typing', 'icon-warning'];
  if (template === 'architecture-diagram') return [...base, 'particles-data-flow', 'packet-neon', 'infra-database'];
  if (template === 'stat-card') return [...base, hasCounter ? 'counter-burst' : 'graph-latency-drop', 'badge-10x'];
  if (template === 'comparison-card') return [...base, 'icon-warning', 'icon-check'];

  return [...base, 'graph-latency-drop'];
}
