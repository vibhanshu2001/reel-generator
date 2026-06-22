export interface CharacterProfile {
  name: string;
  role: string;
  personality: string;
  visualPrompt: string;
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  voice: string;
}

export const CHARACTER_BIBLE: Record<string, CharacterProfile> = {
  Byte: {
    name: 'Byte',
    role: 'Smart, curious technical mentor.',
    personality: 'Confident, helpful, friendly, and witty.',
    visualPrompt: 'Byte, a friendly blue futuristic rounded robot with glowing white digital eyes on a dark round visor head, sleek metallic body, small holographic chest display showing green code brackets, cute cartoon adventure style.',
    colorPalette: {
      primary: '#00f2fe',
      secondary: '#0a192f',
      accent: '#39ff14'
    },
    voice: 'en-US-AndrewNeural'
  },
  Bug: {
    name: 'Bug',
    role: 'Audience surrogate who asks questions and represents the learner.',
    personality: 'Curious, easily confused, relatable, and expressive.',
    visualPrompt: 'Bug, a cute green insect-inspired companion, large expressive black pupil eyes, chubby round green body, tiny wings, wearing a small yellow backpack, curious and easily shocked expressions, cartoon adventure style.',
    colorPalette: {
      primary: '#4ade80',
      secondary: '#052e16',
      accent: '#fbbf24'
    },
    voice: 'en-US-EmmaNeural'
  }
};

export interface EnvironmentSpec {
  name: string;
  details: string;
}

/**
 * Visual Metaphor Engine: maps keywords in a topic to a rich cinematic environment.
 */
export function getEnvironmentForTopic(topic: string): EnvironmentSpec {
  const norm = topic.toLowerCase();
  
  if (norm.includes('kafka') || norm.includes('event') || norm.includes('queue') || norm.includes('pubsub')) {
    return {
      name: 'Futuristic logistics factory',
      details: 'automated conveyor belts with millions of glowing data packets zooming overhead on conveyor belts'
    };
  }
  
  if (norm.includes('redis') || norm.includes('cache') || norm.includes('memory') || norm.includes('speed')) {
    return {
      name: 'Hyper-speed memory vault',
      details: 'glowing vertical neon tubes showing lightning-fast electrical data lanes'
    };
  }
  
  if (norm.includes('postgres') || norm.includes('sql') || norm.includes('database') || norm.includes('db') || norm.includes('sqlite')) {
    return {
      name: 'Monolithic storage fortress',
      details: 'massive ancient stone archive chambers holding rows of glowing transaction ledgers'
    };
  }
  
  if (norm.includes('kubernetes') || norm.includes('k8s') || norm.includes('docker') || norm.includes('container') || norm.includes('deploy')) {
    return {
      name: 'Container city dockyards',
      details: 'automated gantry cranes moving floating container boxes carrying active code blocks'
    };
  }
  
  if (norm.includes('chatgpt') || norm.includes('llm') || norm.includes('ai') || norm.includes('gpt') || norm.includes('model')) {
    return {
      name: 'Giant probability machine',
      details: 'infinite grids of words floating in digital spheres, competing and resolving into sentences'
    };
  }
  
  if (norm.includes('opentelemetry') || norm.includes('monitoring') || norm.includes('prometheus') || norm.includes('metric') || norm.includes('trace')) {
    return {
      name: 'Telemetry mission control',
      details: 'curved wall-sized dashboards showing glowing microservice trace lines and pulse graphs'
    };
  }
  
  // Default fallback environment
  return {
    name: 'Futuristic developer digital grid',
    details: 'a floating matrix of blue neon coordinate lines and digital flowlines extending into infinity'
  };
}
