import { Composition } from 'remotion';
import { Main } from './Main';
import './style.css';

export const Root: React.FC = () => {
  // We use standard vertical 1080x1920 at 30 FPS.
  // The duration is dynamically calculated, but default is 300 frames (10 seconds) for preview.
  return (
    <>
      <Composition
        id="MainComposition"
        component={Main}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={({ props }) => {
          return {
            durationInFrames: (props as any).totalDurationInFrames || 300,
          };
        }}
        defaultProps={{
          projectId: 'preview-project',
          scenes: [
            {
              id: 1,
              text: 'Netflix processes over one trillion events daily using Apache Kafka.',
              template: 'architecture-diagram',
              templateData: {
                nodes: [
                  { id: 'producers', label: '100+ Microservices', x: 15, y: 50, highlight: false },
                  { id: 'kafka', label: 'Kafka Broker', x: 50, y: 50, highlight: true },
                  { id: 'consumers', label: 'Flink Streams', x: 85, y: 50, highlight: false }
                ],
                edges: [
                  { from: 'producers', to: 'kafka', animated: true },
                  { from: 'kafka', to: 'consumers', animated: true }
                ]
              },
              audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // placeholder
              duration: 5.0,
              startFrame: 0,
              endFrame: 150,
              wordTimings: [
                { word: 'Netflix', start: 0.1, end: 0.5 },
                { word: 'processes', start: 0.6, end: 1.1 },
                { word: 'over', start: 1.2, end: 1.4 },
                { word: 'one', start: 1.5, end: 1.7 },
                { word: 'trillion', start: 1.8, end: 2.2 },
                { word: 'events', start: 2.3, end: 2.7 },
                { word: 'daily', start: 2.8, end: 3.1 },
                { word: 'using', start: 3.2, end: 3.5 },
                { word: 'Apache', start: 3.6, end: 4.0 },
                { word: 'Kafka.', start: 4.1, end: 4.8 }
              ]
            },
            {
              id: 2,
              text: 'Here is how simple it is to publish messages.',
              template: 'code-card',
              templateData: {
                language: 'typescript',
                code: 'const producer = kafka.producer();\nawait producer.connect();\nawait producer.send({\n  topic: "events",\n  messages: [{ value: "Hello!" }]\n});',
                highlightLines: [3, 4]
              },
              audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', // placeholder
              duration: 5.0,
              startFrame: 150,
              endFrame: 300,
              wordTimings: [
                { word: 'Here', start: 0.1, end: 0.4 },
                { word: 'is', start: 0.5, end: 0.7 },
                { word: 'how', start: 0.8, end: 1.0 },
                { word: 'simple', start: 1.1, end: 1.5 },
                { word: 'it', start: 1.6, end: 1.8 },
                { word: 'is', start: 1.9, end: 2.1 },
                { word: 'to', start: 2.2, end: 2.4 },
                { word: 'publish', start: 2.5, end: 2.9 },
                { word: 'messages.', start: 3.0, end: 3.6 }
              ]
            }
          ],
          totalDurationInFrames: 300,
          fps: 30,
          width: 1080,
          height: 1920
        }}
      />
    </>
  );
};
export default Root;
