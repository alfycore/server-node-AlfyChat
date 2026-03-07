// ==========================================
// Routes : Invitations
// ==========================================

import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface InviteRow {
  id: string;
  code: string;
  creator_id: string;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  created_at: string;
}

// GET / — Liste des invitations
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const invites = db.prepare('SELECT * FROM invites ORDER BY created_at DESC').all() as InviteRow[];
  res.json(invites.map(formatInvite));
});

// POST / — Créer une invitation
router.post('/', (req: Request, res: Response) => {
  const { maxUses, expiresIn } = req.body;
  const creatorId = req.body.creatorId || req.body.userId || req.headers['x-user-id'] as string;

  if (!creatorId) return res.status(400).json({ error: 'creatorId requis' });

  const db = getDb();
  const id = uuidv4();

  // Générer un code aléatoire de 8 caractères
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];

  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

  db.prepare(`
    INSERT INTO invites (id, code, creator_id, max_uses, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, code, creatorId, maxUses || null, expiresAt);

  const invite = db.prepare('SELECT * FROM invites WHERE id = ?').get(id) as InviteRow;
  res.status(201).json(formatInvite(invite));
});

// GET /:code — Vérifier une invitation
router.get('/:code', (req: Request, res: Response) => {
  const db = getDb();
  const invite = db.prepare('SELECT * FROM invites WHERE code = ?').get(req.params.code) as InviteRow | undefined;

  if (!invite) return res.status(404).json({ error: 'Invitation introuvable' });

  // Vérifier expiration
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Invitation expirée' });
  }

  // Vérifier utilisation max
  if (invite.max_uses && invite.uses >= invite.max_uses) {
    return res.status(410).json({ error: 'Invitation épuisée' });
  }

  res.json(formatInvite(invite));
});

// POST /:code/use — Utiliser une invitation
router.post('/:code/use', (req: Request, res: Response) => {
  const db = getDb();
  const invite = db.prepare('SELECT * FROM invites WHERE code = ?').get(req.params.code) as InviteRow | undefined;

  if (!invite) return res.status(404).json({ error: 'Invitation introuvable' });
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Invitation expirée' });
  }
  if (invite.max_uses && invite.uses >= invite.max_uses) {
    return res.status(410).json({ error: 'Invitation épuisée' });
  }

  db.prepare('UPDATE invites SET uses = uses + 1 WHERE id = ?').run(invite.id);
  res.json({ success: true });
});

// DELETE /:inviteId — Supprimer une invitation
router.delete('/:inviteId', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM invites WHERE id = ?').run(req.params.inviteId);
  res.json({ success: true });
});

function formatInvite(inv: InviteRow) {
  return {
    id: inv.id,
    code: inv.code,
    creatorId: inv.creator_id,
    maxUses: inv.max_uses,
    uses: inv.uses,
    expiresAt: inv.expires_at,
    createdAt: inv.created_at,
  };
}

export default router;
