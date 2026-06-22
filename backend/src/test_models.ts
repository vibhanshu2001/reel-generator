import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env configuration
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const apiKey = process.env.GEMINI_API_KEY || '';
console.log(`🔑 Testing API Key (length: ${apiKey.length})...`);

const models = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-1.5-pro',
  'gemini-2.5-pro'
];

async function testAll() {
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY is not defined in backend/.env');
    process.exit(1);
  }

  for (const m of models) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent('Hello! Tell me your name in 4 words.');
      const text = result.response.text().trim();
      console.log(`✅ SUCCESS [${m}]: "${text}"`);
    } catch (err: any) {
      console.log(`❌ FAILED  [${m}]: ${err.message || err}`);
    }
  }
}

testAll();
