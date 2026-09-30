// Original, deterministic tones. No remote media or generated voice is needed.
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '..', 'assets', 'wellbeing');
fs.mkdirSync(dir, { recursive: true });
function wave(name, seconds, sample) {
  const rate = 22050, count = Math.round(seconds * rate);
  const bytes = Buffer.alloc(44 + count * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(36 + count * 2, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample(i / rate, seconds))) * 32767), 44 + i * 2);
  fs.writeFileSync(path.join(dir, name + '.wav'), bytes);
}
wave('ambient', 8, (t) => 0.12 * (Math.sin(2 * Math.PI * 110 * t) + 0.3 * Math.sin(2 * Math.PI * 165 * t)) * (0.8 + 0.2 * Math.cos(2 * Math.PI * t / 8)));
for (const [name, frequency] of [['inhale', 440], ['hold', 523.25], ['exhale', 330]]) {
  wave(name, 0.45, (t, duration) => 0.24 * Math.sin(2 * Math.PI * frequency * t) * Math.sin(Math.PI * t / duration) ** 2);
}
