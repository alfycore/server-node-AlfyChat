// ==========================================
// Routes : Gestion des membres
// ==========================================

import { Router, Request, Response } from 'express';
import { getDb } from '../database';

const router = Router();

interface MemberRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  nickname: string | null;
  role_ids: string;
  joined_at: string;
  is_banned: number;
  ban_reason: string | null;
}

// GET / — Liste des membres (exclut les bannis par défaut)
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const showBanned = req.query.showBanned === 'true';
  const sql = showBanned
    ? 'SELECT * FROM members ORDER BY joined_at ASC'
    : 'SELECT * FROM members WHERE is_banned = 0 ORDER BY joined_at ASC';
  const members = db.prepare(sql).all() as MemberRow[];
  res.json(members.map(formatMember));
});

// GET /:userId — Détail d'un membre
router.get('/:userId', (req: Request, res: Response) => {
  const db = getDb();
  const member = db.prepare('SELECT * FROM members WHERE user_id = ?').get(req.params.userId) as MemberRow | undefined;
  if (!member) return res.status(404).json({ error: 'Membre introuvable' });
  res.json(formatMember(member));
});

// POST / — Ajouter un membre (appelé quand un user rejoint via le gateway)
router.post('/', (req: Request, res: Response) => {
  const { userId, username, displayName, avatarUrl } = req.body;

  if (!userId || !username) {
    return res.status(400).json({ error: 'userId et username requis' });
  }

  const db = getDb();

  // Vérifier si banni
  const existing = db.prepare('SELECT * FROM members WHERE user_id = ?').get(userId) as MemberRow | undefined;
  if (existing?.is_banned) {
    return res.status(403).json({ error: 'Utilisateur banni', reason: existing.ban_reason });
  }

  // Upsert : si déjà membre, mettre à jour ses infos
  if (existing) {
    db.prepare(`
      UPDATE members SET username = ?, display_name = ?, avatar_url = ?
      WHERE user_id = ?
    `).run(username, displayName || null, avatarUrl || null, userId);
  } else {
    // Assigner le rôle @everyone par défaut
    const defaultRole = db.prepare('SELECT id FROM roles WHERE is_default = 1').get() as { id: string } | undefined;
    const roleIds = defaultRole ? JSON.stringify([defaultRole.id]) : '[]';

    db.prepare(`
      INSERT INTO members (user_id, username, display_name, avatar_url, role_ids)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, username, displayName || null, avatarUrl || null, roleIds);
  }

  const member = db.prepare('SELECT * FROM members WHERE user_id = ?').get(userId) as MemberRow;
  res.status(201).json(formatMember(member));
});

// PATCH /:userId — Modifier un membre (nickname, rôles)
router.patch('/:userId', (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT user_id FROM members WHERE user_id = ?').get(req.params.userId);
  if (!existing) return res.status(404).json({ error: 'Membre introuvable' });

  const { nickname, roleIds } = req.body;
  const updates: string[] = [];
  const params: any[] = [];

  if (nickname !== undefined) { updates.push('nickname = ?'); params.push(nickname || null); }
  if (roleIds !== undefined) { updates.push('role_ids = ?'); params.push(JSON.stringify(roleIds)); }

  if (updates.length > 0) {
    params.push(req.params.userId);
    db.prepare(`UPDATE members SET ${updates.join(', ')} WHERE user_id = ?`).run(...params);
  }

  const member = db.prepare('SELECT * FROM members WHERE user_id = ?').get(req.params.userId) as MemberRow;
  res.json(formatMember(member));
});

// DELETE /:userId — Retirer un membre (kick)
router.delete('/:userId', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM members WHERE user_id = ?').run(req.params.userId);
  res.json({ success: true });
});

// POST /:userId/ban — Bannir un membre
router.post('/:userId/ban', (req: Request, res: Response) => {
  const { reason } = req.body;
  const db = getDb();
  db.prepare('UPDATE members SET is_banned = 1, ban_reason = ? WHERE user_id = ?')
    .run(reason || null, req.params.userId);
  res.json({ success: true });
});

// DELETE /:userId/ban — Débannir un membre
router.delete('/:userId/ban', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('UPDATE members SET is_banned = 0, ban_reason = NULL WHERE user_id = ?')
    .run(req.params.userId);
  res.json({ success: true });
});

function formatMember(m: MemberRow) {
  let roleIds: string[] = [];
  try { roleIds = JSON.parse(m.role_ids); } catch { /* skip */ }
  return {
    userId: m.user_id,
    username: m.username,
    displayName: m.display_name,
    avatarUrl: m.avatar_url,
    nickname: m.nickname,
    roleIds,
    joinedAt: m.joined_at,
    isBanned: m.is_banned === 1,
    banReason: m.ban_reason,
  };
}

export default router;
