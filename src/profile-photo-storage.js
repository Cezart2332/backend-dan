import fs from 'fs';
import path from 'path';

const { mkdir, unlink } = fs.promises;

const DEFAULT_PROFILE_PHOTOS_DIR =
  process.platform === 'win32'
    ? path.resolve(process.cwd(), 'media/photos')
    : '/app/media/photos';

const MIME_TO_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function isSafeFileName(fileName) {
  return /^[a-zA-Z0-9._-]+$/.test(String(fileName || ''));
}

export function getProfilePhotosDir() {
  const configured =
    process.env.PROFILE_PHOTOS_DIR ||
    process.env.CORE_PROFILE_PHOTOS_DIR ||
    DEFAULT_PROFILE_PHOTOS_DIR;

  return path.resolve(configured);
}

export async function ensureProfilePhotosDir() {
  const dir = getProfilePhotosDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export function resolveProfilePhotoPath(fileName) {
  const normalized = String(fileName || '').trim();
  if (!isSafeFileName(normalized)) return null;

  const baseDir = getProfilePhotosDir();
  const resolvedBaseDir = path.resolve(baseDir);
  const resolvedFilePath = path.resolve(path.join(resolvedBaseDir, normalized));

  if (resolvedFilePath !== resolvedBaseDir && !resolvedFilePath.startsWith(`${resolvedBaseDir}${path.sep}`)) {
    return null;
  }

  return resolvedFilePath;
}

export function inferAvatarContentType(fileName) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

export function extractAvatarFileName(avatarUrl) {
  const raw = String(avatarUrl || '').trim();
  if (!raw) return null;

  let pathname = raw;
  try {
    pathname = new URL(raw).pathname;
  } catch {
    // Allow relative paths as fallback.
  }

  let lastSegment = '';
  try {
    lastSegment = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '');
  } catch {
    return null;
  }
  if (!isSafeFileName(lastSegment)) return null;
  return lastSegment;
}

function decodeAvatarPayload(avatarBase64) {
  const rawPayload = String(avatarBase64 || '').trim();
  if (!rawPayload) return { payload: '', dataUriMimeType: null };

  const dataUriMatch = rawPayload.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUriMatch) {
    return {
      payload: String(dataUriMatch[2] || '').trim(),
      dataUriMimeType: String(dataUriMatch[1] || '').trim().toLowerCase(),
    };
  }

  const commaIndex = rawPayload.indexOf(',');
  if (rawPayload.startsWith('data:') && commaIndex >= 0) {
    return {
      payload: rawPayload.slice(commaIndex + 1).trim(),
      dataUriMimeType: null,
    };
  }

  return {
    payload: rawPayload,
    dataUriMimeType: null,
  };
}

/**
 * Saves an avatar image from base64 payload and returns the generated file name.
 *
 * @param {{ userId: number, avatarBase64: string, avatarMimeType?: string|null }} params
 * @returns {Promise<{ fileName: string, bytes: number }>}
 */
export async function saveAvatarBase64({ userId, avatarBase64, avatarMimeType = null }) {
  const { payload, dataUriMimeType } = decodeAvatarPayload(avatarBase64);
  const normalizedPayload = payload.replace(/\s+/g, '');

  if (!normalizedPayload.length) {
    throw new Error('Avatar payload is empty');
  }

  let imageBuffer;
  try {
    imageBuffer = Buffer.from(normalizedPayload, 'base64');
  } catch {
    throw new Error('Avatar payload is not valid base64');
  }

  if (!imageBuffer?.length) {
    throw new Error('Avatar payload is not valid base64');
  }

  const maxBytes = 3 * 1024 * 1024;
  if (imageBuffer.length > maxBytes) {
    throw new Error('Avatar image too large');
  }

  const normalizedMime = String(avatarMimeType || dataUriMimeType || '').trim().toLowerCase();
  const extension = MIME_TO_EXTENSION[normalizedMime] || 'jpg';

  await ensureProfilePhotosDir();
  const fileName = `u${Number(userId)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const resolvedPath = resolveProfilePhotoPath(fileName);

  if (!resolvedPath) {
    throw new Error('Invalid avatar file path');
  }

  await fs.promises.writeFile(resolvedPath, imageBuffer);
  return { fileName, bytes: imageBuffer.length };
}

export async function deleteAvatarFileByFileName(fileName) {
  const resolvedPath = resolveProfilePhotoPath(fileName);
  if (!resolvedPath) return;

  try {
    await unlink(resolvedPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export async function deleteAvatarFileByUrl(avatarUrl) {
  const fileName = extractAvatarFileName(avatarUrl);
  if (!fileName) return;
  await deleteAvatarFileByFileName(fileName);
}

function pickForwardedHeaderValue(value) {
  if (Array.isArray(value)) {
    return String(value[0] || '').split(',')[0].trim();
  }
  return String(value || '').split(',')[0].trim();
}

export function buildAvatarUrlFromRequest(request, fileName) {
  const publicBaseUrl = String(process.env.PROFILE_PUBLIC_BASE_URL || process.env.CORE_PROFILE_PUBLIC_BASE_URL || '').trim();
  const encodedName = encodeURIComponent(String(fileName || '').trim());
  const pathPart = `/api/profile/photos/${encodedName}`;

  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/+$/, '')}${pathPart}`;
  }

  const forwardedProto = pickForwardedHeaderValue(request?.headers?.['x-forwarded-proto']);
  const forwardedHost = pickForwardedHeaderValue(request?.headers?.['x-forwarded-host']);
  const host = forwardedHost || pickForwardedHeaderValue(request?.headers?.host);
  const protocol = forwardedProto || request?.protocol || 'http';

  if (!host) return pathPart;
  return `${protocol}://${host}${pathPart}`;
}
