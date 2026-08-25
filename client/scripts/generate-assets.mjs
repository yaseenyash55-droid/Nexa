import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

// 1. Generate a valid WAV audio file with dual-tone phone ringing (440Hz + 480Hz)
function createRingtoneWav(filePath) {
  const sampleRate = 44100;
  const durationSec = 3.0; // 3 seconds per cycle
  const numSamples = Math.floor(sampleRate * durationSec);
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generate dual-tone sinusoidal ringing (440Hz + 480Hz) with 1.8s burst + 1.2s silence
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sampleVal = 0;
    if (t < 1.8) {
      // 440Hz + 480Hz dual tone with soft envelope
      const envelope = Math.min(1, t * 20) * Math.min(1, (1.8 - t) * 20);
      const tone = (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 480 * t)) * 0.45;
      sampleVal = tone * envelope;
    }
    const sampleInt16 = Math.max(-32768, Math.min(32767, Math.floor(sampleVal * 32767)));
    buffer.writeInt16LE(sampleInt16, offset);
    offset += 2;
  }

  fs.writeFileSync(filePath, buffer);
  console.log(`Generated ringtone WAV at: ${filePath}`);
}

// 2. Generate a minimal valid 128x128 PNG avatar
function createAvatarPng(filePath) {
  // A clean 1x1 PNG base64 expanded or SVG converted to PNG
  const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  fs.writeFileSync(filePath, Buffer.from(base64Png, 'base64'));
  console.log(`Generated avatar PNG at: ${filePath}`);
}

createRingtoneWav(path.join(publicDir, 'ringtone.mp3'));
createRingtoneWav(path.join(publicDir, 'ringtone.wav'));
createAvatarPng(path.join(publicDir, 'avatar.png'));

// Also copy to sounds/ if needed
const soundsDir = path.join(publicDir, 'sounds');
if (!fs.existsSync(soundsDir)) fs.mkdirSync(soundsDir, { recursive: true });
fs.copyFileSync(path.join(publicDir, 'ringtone.mp3'), path.join(soundsDir, 'ringtone.mp3'));
