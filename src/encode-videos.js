import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function getBasePath() {
  const p = process.env.FileStorage__BasePath || process.env.FILESTORAGE__BASEPATH || process.env.FILE_STORAGE_BASE_PATH;
  if (!p) return null;
  return path.resolve(p);
}

function sanitizeId(raw) {
  if (!raw) return null;
  const id = raw.toString().trim();
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) return null;
  return id;
}

function getVideoIdFromFilename(filename) {
  const base = path.basename(filename);
  const ext = path.extname(base).toLowerCase();
  if (ext !== '.mp4' && ext !== '.mov') return null;
  const id = base.slice(0, -ext.length);
  return sanitizeId(id);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildFfmpegCommand(inputPath, outputDir) {
  const segmentPattern = path.join(outputDir, 'segment_%03d.ts');
  const playlistPath = path.join(outputDir, 'master.m3u8');
  // Single-variant HLS tuned for low CPU (2 vCPU) and reasonable quality.
  const args = [
    '-y',
    '-i', `"${inputPath}"`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', process.env.HLS_CRF || '22',
    '-c:a', 'aac',
    '-ac', '2',
    '-ar', '48000',
    '-b:a', '128k',
    '-vf', process.env.HLS_SCALE || 'scale=-2:720',
    '-pix_fmt', 'yuv420p',
    '-hls_time', process.env.HLS_SEGMENT_TIME || '4',
    '-hls_list_size', '0',
    '-hls_segment_filename', `"${segmentPattern}"`,
    `"${playlistPath}"`,
  ];
  return `ffmpeg ${args.join(' ')}`;
}

async function encodeOne({ inputPath, outputDir, videoId, force }) {
  const playlistPath = path.join(outputDir, 'master.m3u8');
  const already = await pathExists(playlistPath);
  if (already && !force) {
    console.log(`[skip] ${videoId} — playlist exists at ${playlistPath}`);
    return { videoId, skipped: true };
  }

  await fs.mkdir(outputDir, { recursive: true });
  const cmd = buildFfmpegCommand(inputPath, outputDir);
  console.log(`[encode:start] ${videoId}`);
  try {
    const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
    if (stdout) console.log(`[ffmpeg:stdout] ${videoId}\n${stdout}`);
    if (stderr) console.log(`[ffmpeg:stderr] ${videoId}\n${stderr}`);
    console.log(`[encode:done] ${videoId}`);
    return { videoId, skipped: false };
  } catch (err) {
    console.error(`[encode:error] ${videoId}:`, err.message);
    throw err;
  }
}

async function main() {
  const basePath = getBasePath();
  if (!basePath) {
    console.error('FileStorage__BasePath is not set. Aborting.');
    process.exit(1);
  }

  const originalsDir = path.join(basePath, 'original');
  const hlsRoot = path.join(basePath, 'hls');

  if (!(await pathExists(originalsDir))) {
    console.error(`Originals directory not found: ${originalsDir}`);
    process.exit(1);
  }

  await fs.mkdir(hlsRoot, { recursive: true });

  const entries = await fs.readdir(originalsDir, { withFileTypes: true });
  const force = process.argv.includes('--force');

  const targets = entries
    .filter((e) => e.isFile())
    .map((e) => getVideoIdFromFilename(e.name))
    .filter(Boolean);

  if (targets.length === 0) {
    console.log('No input videos found in /original');
    return;
  }

  let success = 0;
  let skipped = 0;
  for (const id of targets) {
    const inputPath = path.join(originalsDir, `${id}.mp4`);
    const movPath = path.join(originalsDir, `${id}.mov`);
    const hasMp4 = await pathExists(inputPath);
    const hasMov = await pathExists(movPath);
    const chosenInput = hasMp4 ? inputPath : hasMov ? movPath : null;
    if (!chosenInput) {
      console.warn(`[skip] ${id} — file not found (.mp4 or .mov)`);
      continue;
    }

    const outputDir = path.join(hlsRoot, id);
    try {
      const result = await encodeOne({ inputPath: chosenInput, outputDir, videoId: id, force });
      if (result.skipped) skipped += 1; else success += 1;
    } catch (err) {
      console.error(`[failed] ${id}:`, err.message);
    }
  }

  console.log(`Encoding finished. success=${success} skipped=${skipped}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
