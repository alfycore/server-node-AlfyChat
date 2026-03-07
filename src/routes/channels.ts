// ==========================================
// Routes : Gestion des salons (channels)
// ==========================================

import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface ChannelRow {
  id: string;
  name: string;
  type: string;
  topic: string;
  position: number;
  parent_id: string | null;
  is_nsfw: number;
  slowmode: number;
  created_at: string;
}

// GET / — Liste de tous les salons
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const channels = db.prepare('SELECT * FROM channels ORDER BY position ASC').all() as ChannelRow[];
  res.json(channels.map(formatChannel));
});

// GET /:channelId — Détail d'un salon
router.get('/:channelId', (req: Request, res: Response) => {
  const db = getDb();
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId) as ChannelRow | undefined;
  if (!channel) return res.status(404).json({ error: 'Salon introuvable' });
  res.json(formatChannel(channel));
});

// POST / — Créer un salon
router.post('/', (req: Request, res: Response) => {
  const { name, type = 'text', topic, parentId, isNsfw } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Le nom du salon est requis' });
  }
  if (!['text', 'voice', 'category'].includes(type)) {
    return res.status(400).json({ error: 'Type invalide (text, voice, category)' });
  }

  const db = getDb();
  const id = uuidv4();

  // Position = max + 1
  const maxPos = db.prepare('SELECT MAX(position) as mp FROM channels').get() as { mp: number | null };
  const position = (maxPos.mp ?? -1) + 1;

  db.prepare(`
    INSERT INTO channels (id, name, type, topic, position, parent_id, is_nsfw)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), type, topic || '', position, parentId || null, isNsfw ? 1 : 0);

  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as ChannelRow;
  res.status(201).json(formatChannel(channel));
});

// PATCH /:channelId — Modifier un salon
router.patch('/:channelId', (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM channels WHERE id = ?').get(req.params.channelId);
  if (!existing) return res.status(404).json({ error: 'Salon introuvable' });

  const { name, topic, position, parentId, isNsfw, slowmode, type } = req.body;
  const updates: string[] = [];
  const params: any[] = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
  if (topic !== undefined) { updates.push('topic = ?'); params.push(topic); }
  if (position !== undefined) { updates.push('position = ?'); params.push(position); }
  if (parentId !== undefined) { updates.push('parent_id = ?'); params.push(parentId || null); }
  if (isNsfw !== undefined) { updates.push('is_nsfw = ?'); params.push(isNsfw ? 1 : 0); }
  if (slowmode !== undefined) { updates.push('slowmode = ?'); params.push(slowmode); }
  if (type !== undefined) { updates.push('type = ?'); params.push(type); }

  if (updates.length > 0) {
    params.push(req.params.channelId);
    db.prepare(`UPDATE channels SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.channelId) as ChannelRow;
  res.json(formatChannel(channel));
});

// DELETE /:channelId — Supprimer un salon
router.delete('/:channelId', (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM channels WHERE id = ?').get(req.params.channelId);
  if (!existing) return res.status(404).json({ error: 'Salon introuvable' });

  db.prepare('DELETE FROM channels WHERE id = ?').run(req.params.channelId);
  res.json({ success: true });
});

// Reorder channels
router.put('/reorder', (req: Request, res: Response) => {
  const { order } = req.body; // [{ id, position }]
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order[] requis' });

  const db = getDb();
  const stmt = db.prepare('UPDATE channels SET position = ? WHERE id = ?');
  const tx = db.transaction((items: { id: string; position: number }[]) => {
    for (const item of items) {
      stmt.run(item.position, item.id);
    }
  });
  tx(order);

  const channels = db.prepare('SELECT * FROM channels ORDER BY position ASC').all() as ChannelRow[];
  res.json(channels.map(formatChannel));
});

function formatChannel(ch: ChannelRow) {
  return {
    id: ch.id,
    name: ch.name,
    type: ch.type,
    topic: ch.topic,
    position: ch.position,
    parentId: ch.parent_id,
    isNsfw: ch.is_nsfw === 1,
    slowmode: ch.slowmode,
    createdAt: ch.created_at,
  };
}

export default router;
