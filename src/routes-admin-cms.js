import jwt from 'jsonwebtoken';
import { createHash, timingSafeEqual } from 'crypto';
import { mysqlPool } from './mysql.js';
import { encodeVideoToHls, saveOriginalFile } from './video-encoder.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.CORE_JWT_SECRET;

function loadAdminToken() {
  const raw = process.env.ADMIN_TOKEN || process.env.CORE_ADMIN_TOKEN || '';
  const trimmed = String(raw).trim();
  return trimmed.length ? trimmed : null;
}

const ADMIN_TOKEN = loadAdminToken();

function safeCompare(a, b) {
  const hashA = createHash('sha256').update(String(a)).digest();
  const hashB = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(hashA, hashB);
}

async function adminAuth(request) {
  const staticToken = String(request.headers['x-admin-token'] || '').trim();
  if (ADMIN_TOKEN && staticToken && safeCompare(staticToken, ADMIN_TOKEN)) return { admin: true, method: 'token' };

  const auth = request.headers['authorization'] || request.headers['Authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const [rows] = await mysqlPool.query(
        'SELECT id, email, name, is_admin FROM users WHERE id = ? LIMIT 1',
        [Number(payload.sub)]
      );
      if (rows.length && rows[0].is_admin) {
        return { admin: true, method: 'jwt', user: rows[0] };
      }
    } catch (e) { request.log.debug({ err: e }, 'Admin JWT verify failed'); }
  }
  return null;
}

function normalizeOptionalText(value) {
  const normalized = String(value || '').trim();
  return normalized.length ? normalized : null;
}

export async function registerAdminCmsRoutes(app) {
  // ─── Video Sections ───
  app.get('/api/admin/video-sections', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    try {
      const [rows] = await mysqlPool.query(
        `SELECT id, title, slug, description, sort_order, is_active, created_at, updated_at
         FROM cms_video_sections ORDER BY sort_order, id`
      );
      return reply.send({ items: rows });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS list sections failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.post('/api/admin/video-sections', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const { title, slug, description, sort_order = 0 } = request.body || {};
    const normalizedTitle = String(title || '').trim();
    const normalizedSlug = String(slug || '').trim();
    if (!normalizedTitle || !normalizedSlug) return reply.code(400).send({ error: 'Titlul si slug-ul sunt necesare' });
    try {
      const [res] = await mysqlPool.query(
        'INSERT INTO cms_video_sections (title, slug, description, sort_order) VALUES (?, ?, ?, ?)',
        [normalizedTitle, normalizedSlug, normalizeOptionalText(description), Number(sort_order)]
      );
      return reply.send({ id: res.insertId });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS create section failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.put('/api/admin/video-sections/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'ID invalid' });
    const { title, slug, description, sort_order, is_active } = request.body || {};
    const fields = [];
    const values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(String(title).trim()); }
    if (slug !== undefined) { fields.push('slug = ?'); values.push(String(slug).trim()); }
    if (description !== undefined) { fields.push('description = ?'); values.push(normalizeOptionalText(description)); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(Number(sort_order)); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    if (!fields.length) return reply.code(400).send({ error: 'Niciun camp de actualizat' });
    values.push(id);
    try {
      await mysqlPool.query(`UPDATE cms_video_sections SET ${fields.join(', ')} WHERE id = ?`, values);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS update section failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.delete('/api/admin/video-sections/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    try {
      await mysqlPool.query('DELETE FROM cms_video_sections WHERE id = ?', [id]);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS delete section failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Video Subsections ───
  app.get('/api/admin/video-subsections', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const sectionId = request.query.section_id ? Number(request.query.section_id) : null;
    try {
      let rows;
      if (sectionId) {
        [rows] = await mysqlPool.query(
          `SELECT id, section_id, title, description, icon_name, icon_color, icon_bg, sort_order, is_active
           FROM cms_video_subsections WHERE section_id = ? ORDER BY sort_order, id`,
          [sectionId]
        );
      } else {
        [rows] = await mysqlPool.query(
          `SELECT id, section_id, title, description, icon_name, icon_color, icon_bg, sort_order, is_active
           FROM cms_video_subsections ORDER BY sort_order, id`
        );
      }
      return reply.send({ items: rows });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS list subsections failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.post('/api/admin/video-subsections', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const { section_id, title, description, icon_name, icon_color, icon_bg, sort_order = 0 } = request.body || {};
    if (!section_id || !String(title || '').trim()) return reply.code(400).send({ error: 'section_id si titlul sunt necesare' });
    try {
      const [res] = await mysqlPool.query(
        `INSERT INTO cms_video_subsections (section_id, title, description, icon_name, icon_color, icon_bg, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [Number(section_id), String(title).trim(), normalizeOptionalText(description),
         icon_name || 'play-outline', icon_color || '#4a90e2', icon_bg || '#eaf3ff', Number(sort_order)]
      );
      return reply.send({ id: res.insertId });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS create subsection failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.put('/api/admin/video-subsections/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'ID invalid' });
    const { title, description, icon_name, icon_color, icon_bg, sort_order, is_active } = request.body || {};
    const fields = [];
    const values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(String(title).trim()); }
    if (description !== undefined) { fields.push('description = ?'); values.push(normalizeOptionalText(description)); }
    if (icon_name !== undefined) { fields.push('icon_name = ?'); values.push(icon_name); }
    if (icon_color !== undefined) { fields.push('icon_color = ?'); values.push(icon_color); }
    if (icon_bg !== undefined) { fields.push('icon_bg = ?'); values.push(icon_bg); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(Number(sort_order)); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    if (!fields.length) return reply.code(400).send({ error: 'Niciun camp de actualizat' });
    values.push(id);
    try {
      await mysqlPool.query(`UPDATE cms_video_subsections SET ${fields.join(', ')} WHERE id = ?`, values);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS update subsection failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.delete('/api/admin/video-subsections/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    try {
      await mysqlPool.query('DELETE FROM cms_video_subsections WHERE id = ?', [id]);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS delete subsection failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Videos ───
  app.get('/api/admin/videos', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const subsectionId = request.query.subsection_id ? Number(request.query.subsection_id) : null;
    try {
      let rows;
      if (subsectionId) {
        [rows] = await mysqlPool.query(
          `SELECT id, subsection_id, title, description, storage_key, badge, sort_order, encoding_status, is_active, created_at, updated_at
           FROM cms_videos WHERE subsection_id = ? ORDER BY sort_order, id`,
          [subsectionId]
        );
      } else {
        [rows] = await mysqlPool.query(
          `SELECT id, subsection_id, title, description, storage_key, badge, sort_order, encoding_status, is_active, created_at, updated_at
           FROM cms_videos ORDER BY sort_order, id`
        );
      }
      return reply.send({ items: rows });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS list videos failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.post('/api/admin/videos', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const { subsection_id, title, description, storage_key, badge, sort_order = 0 } = request.body || {};
    if (!subsection_id || !String(title || '').trim() || !String(storage_key || '').trim()) {
      return reply.code(400).send({ error: 'subsection_id, titlul si storage_key sunt necesare' });
    }
    try {
      const [res] = await mysqlPool.query(
        `INSERT INTO cms_videos (subsection_id, title, description, storage_key, badge, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(subsection_id), String(title).trim(), normalizeOptionalText(description),
         String(storage_key).trim(), badge || null, Number(sort_order)]
      );
      return reply.send({ id: res.insertId });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS create video failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.put('/api/admin/videos/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'ID invalid' });
    const { title, description, storage_key, badge, sort_order, is_active } = request.body || {};
    const fields = [];
    const values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(String(title).trim()); }
    if (description !== undefined) { fields.push('description = ?'); values.push(normalizeOptionalText(description)); }
    if (storage_key !== undefined) { fields.push('storage_key = ?'); values.push(String(storage_key).trim()); }
    if (badge !== undefined) { fields.push('badge = ?'); values.push(badge || null); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(Number(sort_order)); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    if (!fields.length) return reply.code(400).send({ error: 'Niciun camp de actualizat' });
    values.push(id);
    try {
      await mysqlPool.query(`UPDATE cms_videos SET ${fields.join(', ')} WHERE id = ?`, values);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS update video failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.delete('/api/admin/videos/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    try {
      const [rows] = await mysqlPool.query('SELECT storage_key FROM cms_videos WHERE id = ? LIMIT 1', [id]);
      const storageKey = Array.isArray(rows) && rows.length ? rows[0].storage_key : null;
      await mysqlPool.query('DELETE FROM cms_videos WHERE id = ?', [id]);
      // Clean up files if possible
      if (storageKey) {
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const basePath = process.env.FileStorage__BasePath || process.env.FILESTORAGE__BASEPATH || process.env.FILE_STORAGE_BASE_PATH;
          if (basePath) {
            const originalsDir = path.resolve(basePath, 'original');
            const hlsRoot = path.resolve(basePath, 'hls');
            const mp4Path = path.join(originalsDir, `${storageKey}.mp4`);
            const movPath = path.join(originalsDir, `${storageKey}.mov`);
            const hlsDir = path.join(hlsRoot, storageKey);
            for (const p of [mp4Path, movPath]) {
              try { await fs.unlink(p); } catch {}
            }
            try { await fs.rm(hlsDir, { recursive: true, force: true }); } catch {}
          }
        } catch (cleanupErr) {
          request.log.warn({ err: cleanupErr }, 'Video file cleanup failed');
        }
      }
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS delete video failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Video Upload + Auto-Encode ───
  app.post('/api/admin/videos/:id/upload', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'ID invalid' });

    try {
      // Always consume the multipart stream first so the client connection doesn't hang
      const data = await request.file();
      if (!data) return reply.code(400).send({ error: 'Niciun fisier primit' });

      const buffer = await data.toBuffer();
      const ext = String(data.filename || '').split('.').pop()?.toLowerCase() || 'mp4';

      // Now validate the video exists in DB
      const [rows] = await mysqlPool.query('SELECT storage_key FROM cms_videos WHERE id = ? LIMIT 1', [id]);
      if (!Array.isArray(rows) || !rows.length) {
        return reply.code(404).send({ error: 'Video inexistent' });
      }
      const storageKey = rows[0].storage_key;
      const targetFilename = `${storageKey}.${ext}`;

      await saveOriginalFile(buffer, targetFilename);

      // Mark as encoding
      await mysqlPool.query("UPDATE cms_videos SET encoding_status = 'encoding' WHERE id = ?", [id]);

      // Start encoding in background (do not await so response is immediate)
      encodeVideoToHls(storageKey).then(async () => {
        await mysqlPool.query("UPDATE cms_videos SET encoding_status = 'done' WHERE id = ?", [id]);
      }).catch(async (err) => {
        console.error(`[auto-encode:error] ${storageKey}:`, err.message);
        await mysqlPool.query("UPDATE cms_videos SET encoding_status = 'failed' WHERE id = ?", [id]);
      });

      return reply.send({ ok: true, message: 'Fisier salvat. Encoding a pornit in fundal.' });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS upload video failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Video Encode Status ───
  app.get('/api/admin/videos/:id/status', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    try {
      const [rows] = await mysqlPool.query(
        'SELECT id, storage_key, encoding_status FROM cms_videos WHERE id = ? LIMIT 1',
        [id]
      );
      if (!Array.isArray(rows) || !rows.length) return reply.code(404).send({ error: 'Video inexistent' });
      return reply.send(rows[0]);
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS video status failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Challenge Levels ───
  app.get('/api/admin/challenge-levels', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    try {
      const [rows] = await mysqlPool.query(
        `SELECT id, title, goal, color, gradient_colors, difficulty, duration, sort_order, is_active
         FROM cms_challenge_levels ORDER BY sort_order, id`
      );
      return reply.send({ items: rows });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS list challenge levels failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.post('/api/admin/challenge-levels', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const { title, goal, color, gradient_colors, difficulty, duration, sort_order = 0 } = request.body || {};
    if (!String(title || '').trim()) return reply.code(400).send({ error: 'Titlul este necesar' });
    try {
      const [res] = await mysqlPool.query(
        `INSERT INTO cms_challenge_levels (title, goal, color, gradient_colors, difficulty, duration, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [String(title).trim(), normalizeOptionalText(goal), color || '#5cb85c',
         gradient_colors || '#5cb85c,#4cae4c', difficulty || 'Ușor', duration || '5-10 min', Number(sort_order)]
      );
      return reply.send({ id: res.insertId });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS create challenge level failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.put('/api/admin/challenge-levels/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'ID invalid' });
    const { title, goal, color, gradient_colors, difficulty, duration, sort_order, is_active } = request.body || {};
    const fields = [];
    const values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(String(title).trim()); }
    if (goal !== undefined) { fields.push('goal = ?'); values.push(normalizeOptionalText(goal)); }
    if (color !== undefined) { fields.push('color = ?'); values.push(color); }
    if (gradient_colors !== undefined) { fields.push('gradient_colors = ?'); values.push(gradient_colors); }
    if (difficulty !== undefined) { fields.push('difficulty = ?'); values.push(difficulty); }
    if (duration !== undefined) { fields.push('duration = ?'); values.push(duration); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(Number(sort_order)); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    if (!fields.length) return reply.code(400).send({ error: 'Niciun camp de actualizat' });
    values.push(id);
    try {
      await mysqlPool.query(`UPDATE cms_challenge_levels SET ${fields.join(', ')} WHERE id = ?`, values);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS update challenge level failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.delete('/api/admin/challenge-levels/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    try {
      await mysqlPool.query('DELETE FROM cms_challenge_levels WHERE id = ?', [id]);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS delete challenge level failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  // ─── Challenges ───
  app.get('/api/admin/challenges', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const levelId = request.query.level_id ? Number(request.query.level_id) : null;
    try {
      let rows;
      if (levelId) {
        [rows] = await mysqlPool.query(
          `SELECT id, level_id, title, est, sort_order, is_active, created_at, updated_at
           FROM cms_challenges WHERE level_id = ? ORDER BY sort_order, id`,
          [levelId]
        );
      } else {
        [rows] = await mysqlPool.query(
          `SELECT id, level_id, title, est, sort_order, is_active, created_at, updated_at
           FROM cms_challenges ORDER BY sort_order, id`
        );
      }
      return reply.send({ items: rows });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS list challenges failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.post('/api/admin/challenges', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const { level_id, title, est, sort_order = 0 } = request.body || {};
    if (!level_id || !String(title || '').trim()) return reply.code(400).send({ error: 'level_id si titlul sunt necesare' });
    try {
      const [res] = await mysqlPool.query(
        `INSERT INTO cms_challenges (level_id, title, est, sort_order) VALUES (?, ?, ?, ?)`,
        [Number(level_id), String(title).trim(), est || '5 min', Number(sort_order)]
      );
      return reply.send({ id: res.insertId });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS create challenge failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.put('/api/admin/challenges/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'ID invalid' });
    const { title, est, sort_order, is_active } = request.body || {};
    const fields = [];
    const values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(String(title).trim()); }
    if (est !== undefined) { fields.push('est = ?'); values.push(est); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(Number(sort_order)); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    if (!fields.length) return reply.code(400).send({ error: 'Niciun camp de actualizat' });
    values.push(id);
    try {
      await mysqlPool.query(`UPDATE cms_challenges SET ${fields.join(', ')} WHERE id = ?`, values);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS update challenge failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });

  app.delete('/api/admin/challenges/:id', async (request, reply) => {
    const auth = await adminAuth(request);
    if (!auth) return reply.code(403).send({ error: 'Forbidden' });
    const id = Number(request.params.id);
    try {
      await mysqlPool.query('DELETE FROM cms_challenges WHERE id = ?', [id]);
      return reply.send({ ok: true });
    } catch (e) {
      request.log.error({ err: e }, 'Admin CMS delete challenge failed');
      return reply.code(500).send({ error: 'Eroare server' });
    }
  });
}
