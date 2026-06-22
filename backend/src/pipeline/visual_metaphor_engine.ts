import { ScriptOutput } from './steps/2_script.js';

export interface VisualMetaphor {
  concept: string;
  visualWorld: string;
  mapping: Record<string, string>;
}

const CURATED_METAPHORS: Array<VisualMetaphor & { keywords: string[] }> = [
  {
    concept: 'Kafka',
    keywords: ['kafka', 'broker', 'consumer', 'producer', 'stream', 'event'],
    visualWorld: 'airport baggage routing system',
    mapping: {
      producers: 'check-in counters dropping bags onto belts',
      topics: 'labeled conveyor lanes',
      partitions: 'parallel belt lanes',
      consumers: 'arrival carousels pulling bags by destination'
    }
  },
  {
    concept: 'Promise.all',
    keywords: ['promise.all', 'promises', 'parallel await', 'async'],
    visualWorld: 'delivery fleet dispatch',
    mapping: {
      promises: 'delivery vans leaving together',
      resolve: 'packages arriving at the same hub',
      rejection: 'one red van blocking the fleet',
      latency: 'slowest delivery setting total wait time'
    }
  },
  {
    concept: 'Redis',
    keywords: ['redis', 'cache', 'caching', 'in-memory'],
    visualWorld: 'Formula 1 pit lane',
    mapping: {
      cacheHit: 'instant pit stop',
      cacheMiss: 'car leaving track for a distant warehouse',
      ttl: 'countdown timer above the pit box',
      database: 'main garage far behind the pit wall'
    }
  },
  {
    concept: 'Database bottleneck',
    keywords: ['database bottleneck', 'slow query', 'index', 'n+1', 'postgres', 'mysql'],
    visualWorld: 'city traffic jam',
    mapping: {
      requests: 'cars entering a narrow bridge',
      bottleneck: 'single blocked lane',
      index: 'express lane opening',
      pool: 'traffic lights controlling flow'
    }
  },
  {
    concept: 'Load balancer',
    keywords: ['load balancer', 'load balancing', 'reverse proxy', 'nginx'],
    visualWorld: 'traffic control tower',
    mapping: {
      loadBalancer: 'control tower routing planes',
      servers: 'runways with capacity lights',
      healthCheck: 'runway inspection beacon',
      failover: 'plane diverted to green runway'
    }
  },
  {
    concept: 'Microservices',
    keywords: ['microservice', 'microservices', 'service mesh'],
    visualWorld: 'factory assembly line',
    mapping: {
      services: 'specialized stations',
      apiCalls: 'parts moving between stations',
      latency: 'one station slowing the line',
      tracing: 'colored tags following each part'
    }
  }
];

export function selectVisualMetaphor(topic: string, script: ScriptOutput): VisualMetaphor {
  const scriptBodyText = (script as any).body || (script.dialogue ? script.dialogue.map(t => `${t.speaker}: ${t.text}`).join('\n') : '');
  const haystack = `${topic} ${script.title} ${script.hook} ${scriptBodyText}`.toLowerCase();
  const match = CURATED_METAPHORS.find((metaphor) =>
    metaphor.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
  );

  if (match) {
    const { keywords: _keywords, ...metaphor } = match;
    return metaphor;
  }

  return {
    concept: script.title || topic,
    visualWorld: 'debugging war room',
    mapping: {
      problem: 'red incident card',
      rootCause: 'highlighted trace line',
      fix: 'green deploy button',
      payoff: 'latency chart snapping down'
    }
  };
}
