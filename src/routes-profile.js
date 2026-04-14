import fs from 'fs';
import jwt from 'jsonwebtoken';
import { mysqlPool } from './mysql.js';
import {
  buildAvatarUrlFromRequest,
  deleteAvatarFileByUrl,
  ensureProfilePhotosDir,
  inferAvatarContentType,
  resolveProfilePhotoPath,
  saveAvatarBase64,
} from './profile-photo-storage.js';

const { stat } = fs.promises;

const JWT_SECRET = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET;
if (!JWT_SECRET) throw new Error('CRITICAL: JWT_SECRET is required');

function authMiddleware(request) {
  const auth = request.headers['authorization'] || request.headers['Authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;

  const token = auth.slice(7);
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function normalizeDisplayName(value) {
  const normalized = String(value || '').trim();
  if (!normalized.length) return null;
  if (normalized.length < 2 || normalized.length > 60) return null;
  return normalized;
}

async function getProfileRowByUserId(userId) {
  const [rows] = await mysqlPool.query(
    'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ? LIMIT 1',
    [Number(userId)]
  );

  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function mapProfile(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    email: row.email || null,
    name: row.name || null,
    avatar_url: row.avatar_url || null,
    created_at: row.created_at || null,
  };
}

/**
 * Registers profile routes for viewing/updating user display name and avatar.
 *
 * @param {import('fastify').FastifyInstance} app
 * @returns {Promise<void>}
 */
export async function registerProfileRoutes(app) {
  app.get('/api/profile', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });

    try {
      const row = await getProfileRowByUserId(user.sub);
      if (!row) return reply.code(404).send({ error: 'Utilizator negasit' });
      return reply.send({ user: mapProfile(row) });
    } catch (error) {
      request.log.error({ err: error }, 'Get profile failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.put('/api/profile', async (request, reply) => {
    const user = authMiddleware(request);
    if (!user) return reply.code(401).send({ error: 'Neautorizat' });

    const body = request.body || {};
    const hasName = Object.prototype.hasOwnProperty.call(body, 'name');
    const hasAvatar = Object.prototype.hasOwnProperty.call(body, 'avatarBase64');
    const removeAvatar = body.removeAvatar === true;

    if (!hasName && !hasAvatar && !removeAvatar) {
      return reply.code(400).send({ error: 'Niciun camp de actualizat' });
    }

    try {
      const existing = await getProfileRowByUserId(user.sub);
      if (!existing) return reply.code(404).send({ error: 'Utilizator negasit' });

      let nextName = existing.name || null;
      let nextAvatarUrl = existing.avatar_url || null;

      if (hasName) {
        const normalizedName = normalizeDisplayName(body.name);
        if (!normalizedName) {
          return reply.code(400).send({ error: 'Numele trebuie sa aiba intre 2 si 60 de caractere' });
        }
        nextName = normalizedName;
      }

      if (removeAvatar) {
        nextAvatarUrl = null;
      }

      if (hasAvatar) {
        if (typeof body.avatarBase64 !== 'string' || !String(body.avatarBase64 || '').trim()) {
          return reply.code(400).send({ error: 'Avatar invalid' });
        }

        let savedAvatar;
        try {
          savedAvatar = await saveAvatarBase64({
            userId: Number(user.sub),
            avatarBase64: body.avatarBase64,
            avatarMimeType: body.avatarMimeType || null,
          });
        } catch (error) {
          const message = String(error?.message || '');
          if (message.includes('too large')) {
            return reply.code(400).send({ error: 'Avatarul este prea mare (max 3MB)' });
          }
          if (message.includes('base64')) {
            return reply.code(400).send({ error: 'Avatar invalid' });
          }
          throw error;
        }

        nextAvatarUrl = buildAvatarUrlFromRequest(request, savedAvatar.fileName);
      }

      await mysqlPool.query(
        'UPDATE users SET name = ?, avatar_url = ? WHERE id = ?',
        [nextName, nextAvatarUrl, Number(user.sub)]
      );

      if (existing.avatar_url && existing.avatar_url !== nextAvatarUrl) {
        await deleteAvatarFileByUrl(existing.avatar_url).catch(() => {});
      }

      const updated = await getProfileRowByUserId(user.sub);
      return reply.send({ user: mapProfile(updated) });
    } catch (error) {
      request.log.error({ err: error }, 'Update profile failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.get('/api/profile/photos/:fileName', async (request, reply) => {
    const fileName = String(request.params?.fileName || '').trim();
    const resolvedPath = resolveProfilePhotoPath(fileName);
    if (!resolvedPath) return reply.code(404).send({ error: 'Not found' });

    try {
      const fileStat = await stat(resolvedPath);
      if (!fileStat?.isFile()) return reply.code(404).send({ error: 'Not found' });

      await ensureProfilePhotosDir();
      reply.header('Content-Type', inferAvatarContentType(fileName));
      reply.header('Content-Length', fileStat.size);
      reply.header('Cache-Control', 'public, max-age=86400');
      return reply.send(fs.createReadStream(resolvedPath));
    } catch {
      return reply.code(404).send({ error: 'Not found' });
    }
  });
}
