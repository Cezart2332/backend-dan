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
  const threads = process.env.HLS_THREADS || '2';
  const args = [
    '-y',
    '-i', `"${inputPath}"`,
    '-threads', threads,
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
  const cpuLimit = process.env.HLS_CPU_LIMIT;
  const prefix = cpuLimit ? `cpulimit --limit=${cpuLimit} -- ` : 'nice -n 15 ';
  return `${prefix}ffmpeg ${args.join(' ')}`;
}

/**
 * Encode a single video to HLS.
 * @param {string} videoId - The sanitized video id / storage key
 * @param {boolean} force - Re-encode even if playlist exists
 * @returns {Promise<{videoId: string, skipped: boolean, success: boolean}>}
 */
export async function encodeVideoToHls(videoId, force = false) {
  const basePath = getBasePath();
  if (!basePath) throw new Error('FileStorage__BasePath is not configured');

  const id = sanitizeId(videoId);
  if (!id) throw new Error('Invalid video id');

  const originalsDir = path.join(basePath, 'original');
  const hlsRoot = path.join(basePath, 'hls');
  const outputDir = path.join(hlsRoot, id);
  const playlistPath = path.join(outputDir, 'master.m3u8');

  const already = await pathExists(playlistPath);
  if (already && !force) {
    return { videoId: id, skipped: true, success: true };
  }

  const mp4Path = path.join(originalsDir, `${id}.mp4`);
  const movPath = path.join(originalsDir, `${id}.mov`);
  const hasMp4 = await pathExists(mp4Path);
  const hasMov = await pathExists(movPath);
  const inputPath = hasMp4 ? mp4Path : hasMov ? movPath : null;

  if (!inputPath) {
    throw new Error(`Original file not found for ${id} (.mp4 or .mov)`);
  }

  await fs.mkdir(outputDir, { recursive: true });
  const cmd = buildFfmpegCommand(inputPath, outputDir);
  const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
  if (stdout) console.log(`[ffmpeg:stdout] ${id}\n${stdout}`);
  if (stderr) console.log(`[ffmpeg:stderr] ${id}\n${stderr}`);
  return { videoId: id, skipped: false, success: true };
}

/**
 * Save uploaded file to the originals directory.
 * @param {Buffer|Stream} data
 * @param {string} filename
 */
export async function saveOriginalFile(data, filename) {
  const basePath = getBasePath();
  if (!basePath) throw new Error('FileStorage__BasePath is not configured');

  const originalsDir = path.join(basePath, 'original');
  await fs.mkdir(originalsDir, { recursive: true });

  const safeName = path.basename(filename);
  const targetPath = path.join(originalsDir, safeName);
  await fs.writeFile(targetPath, data);
  return targetPath;
}
