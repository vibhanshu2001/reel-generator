export type StorylineType =
  | 'explainer'
  | 'mystery'
  | 'problem_solution'
  | 'timeline'
  | 'success_story'
  | 'case_study'
  | 'comparison'
  | 'before_after'
  | 'documentary'
  | 'shocking_facts'
  | 'rise_fall'
  | 'custom';

export type ViralPatternType =
  | 'myth_busting'
  | 'hidden_truth'
  | 'battle'
  | 'race'
  | 'countdown'
  | 'unexpected_twist'
  | 'before_after'
  | 'survival_story'
  | 'mystery_box';

export interface StorylineSpec {
  id: StorylineType;
  label: string;
  narrativeArc: string;
}

export interface ViralPatternSpec {
  id: ViralPatternType;
  label: string;
  description: string;
  hookFormula: string;
  retentionAngle: string;
}

export const STORYLINES: Record<StorylineType, StorylineSpec> = {
  explainer: {
    id: 'explainer',
    label: 'Explainer',
    narrativeArc: 'Introduce concept -> Break down key parts -> Show practical application -> Final summary.'
  },
  mystery: {
    id: 'mystery',
    label: 'Mystery',
    narrativeArc: 'Start with a weird observation -> Dig into the hidden layers -> Build suspense -> Final reveal of the mechanism.'
  },
  problem_solution: {
    id: 'problem_solution',
    label: 'Problem → Solution',
    narrativeArc: 'Define a painful problem/bug -> Show the consequences -> Introduce the fix -> Contrast the performance shift.'
  },
  timeline: {
    id: 'timeline',
    label: 'Timeline',
    narrativeArc: 'Chronological progression through key releases or execution stages -> Future outlook.'
  },
  success_story: {
    id: 'success_story',
    label: 'Success Story',
    narrativeArc: 'Start with humble beginnings or scale limits -> The breakthrough event -> Growth explosion -> Triumph and lessons.'
  },
  case_study: {
    id: 'case_study',
    label: 'Case Study',
    narrativeArc: 'Autopsy of a real production event/outage -> Forensic diagnostics -> The key discovery -> Practical takeaway.'
  },
  comparison: {
    id: 'comparison',
    label: 'Comparison',
    narrativeArc: 'Introduce two candidates -> Side-by-side battle on latency/simplicity -> Pros/cons -> Final recommendation.'
  },
  before_after: {
    id: 'before_after',
    label: 'Before vs After',
    narrativeArc: 'Contrast the slow/messy way vs the optimized way -> Step-by-step migration -> The dramatic performance results.'
  },
  documentary: {
    id: 'documentary',
    label: 'Documentary',
    narrativeArc: 'Cinematic backdrop -> Historic setup -> Critical engineering milestones -> Broad ecosystem impact.'
  },
  shocking_facts: {
    id: 'shocking_facts',
    label: 'Shocking Facts',
    narrativeArc: 'Start with an unbelievable statistic -> Prove it via code/CLI -> Explain the counter-intuitive mechanism -> Takeaway.'
  },
  rise_fall: {
    id: 'rise_fall',
    label: 'Rise & Fall',
    narrativeArc: 'Dominance of a popular tech -> The systemic limits/warnings -> The collapse/deprecation -> Cautionary lessons.'
  },
  custom: {
    id: 'custom',
    label: 'Custom Storyline',
    narrativeArc: 'Dynamic structure tailored uniquely by the AI to fit the specific nuance of the topic.'
  }
};

export const VIRAL_PATTERNS: Record<ViralPatternType, ViralPatternSpec> = {
  myth_busting: {
    id: 'myth_busting',
    label: 'Myth Busting',
    description: 'Deconstruct a commonly held belief in tech that is actually wrong.',
    hookFormula: 'Everyone thinks X is fast, but they are completely wrong.',
    retentionAngle: 'Keep viewers waiting to see the benchmark data that disproves the myth.'
  },
  hidden_truth: {
    id: 'hidden_truth',
    label: 'Hidden Truth',
    description: 'Expose a hidden mechanism in a system that changes how it is used.',
    hookFormula: 'X has a secret mechanism that nobody is telling you about.',
    retentionAngle: 'Tease the secret immediately and build layers of investigation before revealing it.'
  },
  battle: {
    id: 'battle',
    label: 'Battle',
    description: 'Head-to-head performance combat between two popular tools.',
    hookFormula: 'We put X and Y into a performance ring. The winner will shock you.',
    retentionAngle: 'Create alternating visual blows (statistics, speed metrics) until the final bell rings.'
  },
  race: {
    id: 'race',
    label: 'Race',
    description: 'Chronological comparison of speed, latency, or throughput.',
    hookFormula: 'Can X process a million events before Y even starts up?',
    retentionAngle: 'Use counters and progress indicators to show a literal race between systems.'
  },
  countdown: {
    id: 'countdown',
    label: 'Countdown',
    description: 'Structured list count of items, mistakes, or architectural patterns.',
    hookFormula: 'The top 3 architecture mistakes that will crash your app tonight.',
    retentionAngle: 'Count down from 3 to 1 to force viewers to stay until number 1.'
  },
  unexpected_twist: {
    id: 'unexpected_twist',
    label: 'Unexpected Twist',
    description: 'Start with a normal technical flow that suddenly takes a dramatic turn.',
    hookFormula: 'We added one line of code to optimize our server. Then our database caught fire.',
    retentionAngle: 'Set up a routine activity and introduce a sudden shock beat, holding the explanation until the end.'
  },
  before_after: {
    id: 'before_after',
    label: 'Before vs After',
    description: 'Dramatic comparison of a system before and after refactoring/optimizing.',
    hookFormula: 'This is what happens to your latency when you delete 90% of your SQL queries.',
    retentionAngle: 'Show the painful "Before" visual, then tease the "After" metrics, slowly explaining the migration bridge.'
  },
  survival_story: {
    id: 'survival_story',
    label: 'Survival Story',
    description: 'How an engineering team managed to survive a massive system outage/scale spike.',
    hookFormula: 'How our database survived a 100x traffic spike with one single setting.',
    retentionAngle: 'Start with intense stress (graphs pulsing red), walk through failures, ending in the heroic fix.'
  },
  mystery_box: {
    id: 'mystery_box',
    label: 'Mystery Box',
    description: 'Present an unknown file or process that holds the key to an optimization.',
    hookFormula: 'This tiny 5-kilobyte file is the reason why X runs 10x faster.',
    retentionAngle: 'Hide the contents of the "box" until a critical reveal beat halfway through.'
  }
};
