import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load env variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Ensure directories exist for outputs and temp audio
const outputsDir = path.join(__dirname, '..', 'outputs');
const tempAudioDir = path.join(__dirname, '..', 'temp_audio');

if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}
if (!fs.existsSync(tempAudioDir)) {
  fs.mkdirSync(tempAudioDir, { recursive: true });
}

// Serve output video files and temp audio files
app.use('/outputs', express.static(outputsDir));
app.use('/audio', express.static(tempAudioDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Import and use routes (to be created)
import projectRoutes from './routes/projects.js';
app.use('/api/projects', projectRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Output assets directory: ${outputsDir}`);
  console.log(`📁 Audio assets directory: ${tempAudioDir}`);
});
