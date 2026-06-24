import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

export interface WordTiming {
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export interface AudioTTSResult {
  audioPath: string;
  duration: number;
  wordTimings: WordTiming[];
}

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WINDOWS_FILE_TIME_EPOCH = 11644473600n;
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split('.')[0];
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;

/**
 * Generates Microsoft's Sec-MS-GEC anti-abuse token.
 * Uses Windows File Time epoch, rounded to 5-minute ticks, hashed via SHA-256.
 */
function generateSecMsGecToken(): string {
  // Current time in 100-nanosecond intervals (ticks) since Windows File Time Epoch (1601)
  const ticks = BigInt(Math.floor((Date.now() / 1000) + Number(WINDOWS_FILE_TIME_EPOCH))) * 10000000n;
  
  // Round down to the nearest 5-minute interval (3,000,000,000 ticks)
  const roundedTicks = ticks - (ticks % 3000000000n);
  
  const strToHash = `${roundedTicks}${TRUSTED_CLIENT_TOKEN}`;
  const hash = createHash('sha256');
  hash.update(strToHash, 'ascii');
  
  return hash.digest('hex').toUpperCase();
}

/**
 * Return Javascript-style date string in GMT/UTC timezone.
 */
function getJavascriptDateString(): string {
  const d = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayName = days[d.getUTCDay()];
  const monthName = months[d.getUTCMonth()];
  const date = d.getUTCDate().toString().padStart(2, '0');
  const year = d.getUTCFullYear();
  const hours = d.getUTCHours().toString().padStart(2, '0');
  const minutes = d.getUTCMinutes().toString().padStart(2, '0');
  const seconds = d.getUTCSeconds().toString().padStart(2, '0');
  
  return `${dayName} ${monthName} ${date} ${year} ${hours}:${minutes}:${seconds} GMT+0000 (UTC)`;
}

/**
 * Generates speech for a given text using Microsoft Edge Neural TTS.
 * Captures word boundary metadata for millisecond-perfect subtitle timing.
 */
export function generateEdgeTTS(
  text: string,
  outputPath: string,
  voice: string = 'en-IN-PrabhatNeural',
  prosodyRate: string = '+0%',
  prosodyPitch: string = '+0Hz',
  prosodyVolume: string = '+10%'
): Promise<AudioTTSResult> {
  return new Promise((resolve, reject) => {
    const cleanText = text.replace(/[*_`~]/g, '');
    const connectionId = uuidv4().replace(/-/g, '').toUpperCase();
    const token = generateSecMsGecToken();
    const wssUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connectionId}&Sec-MS-GEC=${token}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    const ws = new WebSocket(wssUrl, {
      headers: {
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'Origin': 'chrome-extension://jdiccldimpdaibdccjnbnjonhinjcaha'
      }
    });

    const audioChunks: Buffer[] = [];
    const wordTimings: WordTiming[] = [];
    let audioDuration = 0;

    ws.on('open', () => {
      // 1. Send speech.config message
      const timestamp = getJavascriptDateString();
      const configMessage = `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-96kbitrate-mono-mp3"}}}}`;
      ws.send(configMessage);

      // 2. Send SSML message with emotion-aware prosody
      const requestId = uuidv4().replace(/-/g, '').toUpperCase();
      const ssmlMessage = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}Z\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='${prosodyPitch}' rate='${prosodyRate}' volume='${prosodyVolume}'>${escapeXml(cleanText)}</prosody></voice></speak>`;
      ws.send(ssmlMessage);
    });

    ws.on('message', (data: WebSocket.Data, isBinary: boolean) => {
      if (!isBinary) {
        const text = data.toString('utf8');
        // Handle text message (headers and metadata)
        const parts = text.split('\r\n\r\n');
        if (parts.length < 2) return;
        const headers = parts[0];
        const body = parts[1];

        // Parse path from headers
        const pathMatch = headers.match(/Path:([a-z\.]+)/i);
        const pathValue = pathMatch ? pathMatch[1].trim() : '';

        if (pathValue === 'audio.metadata') {
          try {
            const metaJson = JSON.parse(body);
            if (metaJson.Metadata) {
              for (const item of metaJson.Metadata) {
                if (item.Type === 'WordBoundary') {
                  // Offset and Duration are in ticks (1 tick = 100ns = 0.1 microseconds = 0.0000001 seconds)
                  const startSec = item.Data.Offset / 10000000;
                  const durationSec = item.Data.Duration / 10000000;
                  const wordText = item.Data.text.Text;

                  wordTimings.push({
                    word: wordText,
                    start: startSec,
                    end: startSec + durationSec
                  });
                }
              }
            }
          } catch (e) {
            console.error('Failed parsing Edge TTS metadata:', e);
          }
        } else if (pathValue === 'turn.end') {
          ws.close();
        }
      } else if (Buffer.isBuffer(data)) {
        // Handle binary message (audio stream data)
        if (data.length < 2) return;
        const headerLength = data.readInt16BE(0);
        if (data.length < 2 + headerLength) return;

        const headers = data.toString('utf-8', 2, 2 + headerLength);
        const audioData = data.subarray(2 + headerLength);

        if (headers.includes('Path:audio')) {
          audioChunks.push(audioData);
        }
      }
    });

    ws.on('close', (code, reason) => {
      if (audioChunks.length === 0) {
        return reject(new Error(`Edge TTS generated zero audio bytes. Close code: ${code}, reason: ${reason.toString('utf8')}`));
      }

      // Combine audio buffers and write to disk
      const combinedBuffer = Buffer.concat(audioChunks);
      fs.writeFileSync(outputPath, combinedBuffer);

      // Calculate total duration (approximated from word timings if available, otherwise read file meta)
      if (wordTimings.length > 0) {
        audioDuration = wordTimings[wordTimings.length - 1].end;
      } else {
        // Simple fallback estimate: 130 words per minute
        const words = cleanText.split(/\s+/).length;
        audioDuration = (words / 130) * 60;
      }

      resolve({
        audioPath: outputPath,
        duration: audioDuration,
        wordTimings
      });
    });

    ws.on('error', (err) => {
      reject(err);
    });
  });
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
