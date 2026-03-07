// ==========================================
// Routes : Gestion des rôles
// ==========================================

import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Bits de permissions
export const Permissions = {
  VIEW_CHANNELS:    0x1,
  SEND_MESSAGES:    0x2,
  READ_HISTORY:     0x4,
  ATTACH_FILES:     0x8,
  CONNECT_VOICE:    0x10,
  SPEAK:            0x20,
  ADMINISTRATOR:    0x40,
  MANAGE_CHANNELS:  0x80,
  MANAGE_ROLES:     0x100,
  MANAGE_MESSAGES:  0x200,
  KICK_MEMBERS:     0x400,
  BAN_MEMBERS:      0x800,
  MANAGE_SERVER:    0x1000,
  MANAGE_INVITES:   0x2000,
  MENTION_EVERYONE: 0x4000,
  USE_EMOJIS:       0x8000,
} as const;

interface RoleRow {
  id: string;
  name: string;
  color: string;
  permissions: number;
  position: number;
  is_default: number;
  mentionable: number;
  created_at: string;
}

// GET / — Liste des rôles
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const roles = db.prepare('SELECT * FROM roles ORDER BY position DESC').all() as RoleRow[];
  res.json(roles.map(formatRole));
});

// POST / — Créer un rôle
router.post('/', (req: Request, res: Response) => {
  const { name, color, permissions, mentionable } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Le nom du rôle est requis' });
  }

  const db = getDb();
  const id = uuidv4();

  // Position = max + 1
  const maxPos = db.prepare('SELECT MAX(position) as mp FROM roles').get() as { mp: number | null };
  const position = (maxPos.mp ?? -1) + 1;

  db.prepare(`
    INSERT INTO roles (id, name, color, permissions, position, mentionable)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), color || '#99AAB5', permissions || 0, position, mentionable ? 1 : 0);

  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as RoleRow;
  res.status(201).json(formatRole(role));
});

// PATCH /:roleId — Modifier un rôle
router.patch('/:roleId', (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.roleId) as RoleRow | undefined;
  if (!existing) return res.status(404).json({ error: 'Rôle introuvable' });

  const { name, color, permissions, position, mentionable } = req.body;
  const updates: string[] = [];
  const params: any[] = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
  if (color !== undefined) { updates.push('color = ?'); params.push(color); }
  if (permissions !== undefined) { updates.push('permissions = ?'); params.push(permissions); }
  if (position !== undefined) { updates.push('position = ?'); params.push(position); }
  if (mentionable !== undefined) { updates.push('mentionable = ?'); params.push(mentionable ? 1 : 0); }

  if (updates.length > 0) {
    params.push(req.params.roleId);
    db.prepare(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.roleId) as RoleRow;
  res.json(formatRole(role));
});

// DELETE /:roleId — Supprimer un rôle
router.delete('/:roleId', (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.roleId) as RoleRow | undefined;
  if (!existing) return res.status(404).json({ error: 'Rôle introuvable' });
  if (existing.is_default) return res.status(400).json({ error: 'Impossible de supprimer le rôle par défaut' });

  // Retirer ce rôle de tous les membres
  const members = db.prepare('SELECT user_id, role_ids FROM members').all() as { user_id: string; role_ids: string }[];
  const updateStmt = db.prepare('UPDATE members SET role_ids = ? WHERE user_id = ?');
  for (const m of members) {
    try {
      const ids: string[] = JSON.parse(m.role_ids);
      const filtered = ids.filter((id) => id !== req.params.roleId);
      if (filtered.length !== ids.length) {
        updateStmt.run(JSON.stringify(filtered), m.user_id);
      }
    } catch { /* skip */ }
  }

  db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.roleId);
  res.json({ success: true });
});

// PUT /reorder — Réorganiser les rôles
router.put('/reorder', (req: Request, res: Response) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order[] requis' });

  const db = getDb();
  const stmt = db.prepare('UPDATE roles SET position = ? WHERE id = ?');
  const tx = db.transaction((items: { id: string; position: number }[]) => {
    for (const item of items) stmt.run(item.position, item.id);
  });
  tx(order);

  const roles = db.prepare('SELECT * FROM roles ORDER BY position DESC').all() as RoleRow[];
  res.json(roles.map(formatRole));
});

function formatRole(r: RoleRow) {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    permissions: r.permissions,
    position: r.position,
    isDefault: r.is_default === 1,
    mentionable: r.mentionable === 1,
    createdAt: r.created_at,
  };
}

export default router;
