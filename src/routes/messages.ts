import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';

const router = Router();

// GET /messages?channelId=&before=&limit=
router.get('/', (req: Request, res: Response) => {
  const { channelId, before, limit = '50' } = req.query as Record<string, string>;

  if (!channelId) {
    return res.status(400).json({ error: 'channelId requis' });
  }

  const db = getDb();
  const limitNum = Math.min(parseInt(limit), 100);

  const params: (string | number)[] = [channelId];
  let whereBefore = '';
  if (before) {
    whereBefore = 'AND created_at < ?';
    params.push(before);
  }
  params.push(limitNum);

  const messages = db.prepare(`
    SELECT * FROM messages
    WHERE channel_id = ? AND is_deleted = 0
    ${whereBefore}
    ORDER BY created_at DESC
    LIMIT ?
  `).all(...params) as Record<string, unknown>[];

  const result = messages
    .map(formatMessage)
    .reverse(); // Chronological order

  res.json(result);
});

// POST /messages
router.post('/', (req: Request, res: Response) => {
  const { channelId, content, sender, attachments, replyToId, senderId } = req.body;

  if (!channelId || !senderId) {
    return res.status(400).json({ error: 'channelId et senderId requis' });
  }
  if (!content && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ error: 'content ou attachments requis' });
  }

  const db = getDb();

  // Vérifier que le salon existe
  const channel = db.prepare('SELECT id FROM channels WHERE id = ?').get(channelId);
  if (!channel) return res.status(404).json({ error: 'Salon introuvable' });

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO messages (
      id, channel_id, sender_id,
      sender_username, sender_display_name, sender_avatar_url,
      content, attachments, reply_to_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    channelId,
    senderId,
    sender?.username || senderId,
    sender?.displayName || null,
    sender?.avatarUrl || null,
    content || '',
    JSON.stringify(attachments || []),
    replyToId || null,
    now,
    now
  );

  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json(formatMessage(msg));
});

// PATCH /messages/:messageId
router.patch('/:messageId', (req: Request, res: Response) => {
  const { messageId } = req.params;
  const { content, senderId } = req.body;

  const db = getDb();
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as Record<string, unknown> | undefined;

  if (!message) return res.status(404).json({ error: 'Message non trouvé' });
  if (message.sender_id !== senderId) return res.status(403).json({ error: 'Non autorisé' });

  const now = new Date().toISOString();
  db.prepare('UPDATE messages SET content = ?, is_edited = 1, updated_at = ? WHERE id = ?')
    .run(content, now, messageId);

  const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as Record<string, unknown>;
  res.json(formatMessage(updated));
});

// DELETE /messages/:messageId
router.delete('/:messageId', (req: Request, res: Response) => {
  const { messageId } = req.params;
  const senderId = req.body.senderId || req.body.userId || req.headers['x-user-id'] as string;

  const db = getDb();
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as Record<string, unknown> | undefined;

  if (!message) return res.status(404).json({ error: 'Message non trouvé' });
  // Le sender ou un admin peut supprimer
  if (message.sender_id !== senderId) {
    // TODO: vérifier perms MANAGE_MESSAGES via le header
  }

  db.prepare('UPDATE messages SET is_deleted = 1, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), messageId);

  res.json({ success: true });
});

function formatMessage(m: Record<string, unknown>) {
  return {
    id: m.id,
    channelId: m.channel_id,
    senderId: m.sender_id,
    sender: {
      id: m.sender_id,
      username: m.sender_username,
      displayName: m.sender_display_name || null,
      avatarUrl: m.sender_avatar_url || null,
    },
    content: m.content,
    attachments: JSON.parse((m.attachments as string) || '[]'),
    replyToId: m.reply_to_id || null,
    isEdited: Boolean(m.is_edited),
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  };
}

export default router;
