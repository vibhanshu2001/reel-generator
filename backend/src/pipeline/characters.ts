export interface CharacterProfile {
  name: string;
  role: string;
  personality: string;
  visualPrompt: string;
  comicStyle: string; // Comic animation style descriptor for image generation
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  voice: string;
}

/**
 * BYTE & BUG CHARACTER BIBLE
 *
 * Every short is an episode from the same universe.
 * The audience must recognize Byte and Bug immediately.
 * Never generate random people — only these two recurring characters.
 *
 * BYTE — The Audience Surrogate
 *   Young comic-style character. Blue hoodie. Black hair.
 *   Curious expression. Slightly confused most of the time.
 *   Asks questions. Learns things. Reacts emotionally.
 *   Emotions: shocked, curious, excited, confused.
 *
 * BUG — The Tech Expert & Storyteller
 *   Red hoodie. Small bug antenna on hoodie hood.
 *   Confident grin. Energetic body language.
 *   Explains concepts. Makes jokes. Creates chaos. Very expressive.
 *   Emotions: confident, funny, dramatic, sarcastic.
 */
export const CHARACTER_BIBLE: Record<string, CharacterProfile> = {
  Byte: {
    name: 'Byte',
    role: 'The audience surrogate who asks questions and represents the confused learner.',
    personality: 'Curious, easily confused, relatable, shocked by revelations, emotionally expressive.',
    visualPrompt:
      'Byte, a young comic-style human teenager wearing a bright blue hoodie, black messy hair, large expressive dark eyes showing curiosity and confusion, slightly open mouth in a surprised expression, clean modern 2D comic illustration style.',
    comicStyle:
      'Dynamic 2D comic animation. Blue hoodie. Black hair. Large expressive dark eyes. Exaggerated surprised/confused expressions. Motion streaks when reacting. Comic impact lines radiating from head when shocked.',
    colorPalette: {
      primary: '#00aaff',
      secondary: '#0a192f',
      accent: '#ffd60a'
    },
    voice: 'en-US-EmmaNeural'
  },
  Bug: {
    name: 'Bug',
    role: 'The tech expert and storyteller who explains concepts, creates chaos, and makes jokes.',
    personality: 'Confident, energetic, sarcastic, funny, dramatic, loves to show off knowledge.',
    visualPrompt:
      'Bug, a young comic-style human teenager wearing a red hoodie with a small cute bug antenna sticking out of the hood, confident wide grin, energetic body posture, leaning forward with enthusiasm, clean modern 2D comic illustration style.',
    comicStyle:
      'Dynamic 2D comic animation. Red hoodie. Tiny bug antenna on hood. Confident wide grin. Energetic leaning forward pose. Expressive hand gestures. Speed lines and impact frames when making dramatic reveals.',
    colorPalette: {
      primary: '#ff3b3b',
      secondary: '#1a0000',
      accent: '#39ff14'
    },
    voice: 'en-US-AndrewNeural'
  }
};

export interface EnvironmentSpec {
  name: string;
  details: string;
}

/**
 * Visual Metaphor Engine: maps keywords in a topic to a rich cinematic environment.
 * Environments are rendered in technical comic animation style,
 * NOT Pixar 3D CGI. Strong outlines, vibrant flat gradients, halftone textures.
 */
export function getEnvironmentForTopic(topic: string): EnvironmentSpec {
  const norm = topic.toLowerCase();

  if (norm.includes('kafka') || norm.includes('event') || norm.includes('queue') || norm.includes('pubsub')) {
    return {
      name: 'Futuristic logistics factory',
      details: 'automated conveyor belts with millions of glowing data packets zooming overhead on conveyor belts, comic-style speed lines'
    };
  }

  if (norm.includes('redis') || norm.includes('cache') || norm.includes('memory') || norm.includes('speed')) {
    return {
      name: 'Hyper-speed memory vault',
      details: 'glowing vertical neon tubes showing lightning-fast electrical data lanes, comic impact frames on fast-moving elements'
    };
  }

  if (norm.includes('postgres') || norm.includes('sql') || norm.includes('database') || norm.includes('db') || norm.includes('sqlite')) {
    return {
      name: 'Monolithic storage fortress',
      details: 'massive ancient stone archive chambers holding rows of glowing transaction ledgers, dramatic lighting with comic halftone shadows'
    };
  }

  if (norm.includes('kubernetes') || norm.includes('k8s') || norm.includes('docker') || norm.includes('container') || norm.includes('deploy')) {
    return {
      name: 'Container city dockyards',
      details: 'automated gantry cranes moving floating container boxes, comic panel energy with motion blur and speed streaks'
    };
  }

  if (norm.includes('chatgpt') || norm.includes('llm') || norm.includes('ai') || norm.includes('gpt') || norm.includes('model')) {
    return {
      name: 'Giant probability machine',
      details: 'infinite grids of words floating in digital spheres, competing and resolving into sentences, comic-style word bubbles and impact lettering'
    };
  }

  if (norm.includes('opentelemetry') || norm.includes('monitoring') || norm.includes('prometheus') || norm.includes('metric') || norm.includes('trace')) {
    return {
      name: 'Telemetry mission control',
      details: 'curved wall-sized dashboards showing glowing microservice trace lines and pulse graphs, comic-style alert icons flashing'
    };
  }

  if (norm.includes('aws') || norm.includes('cloud') || norm.includes('server') || norm.includes('crash') || norm.includes('outage')) {
    return {
      name: 'Massive cloud server city',
      details: 'towering server racks stretching into the clouds, data highways connecting continents, dramatic comic-style warning sirens and lightning'
    };
  }

  // Default fallback environment
  return {
    name: 'Futuristic developer digital grid',
    details: 'a floating matrix of blue neon coordinate lines and digital flowlines extending into infinity, comic-style panel compositions'
  };
}
