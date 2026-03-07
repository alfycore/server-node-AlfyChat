// ==========================================
// Routes : Informations du serveur
// ==========================================

import { Router, Request, Response } from 'express';
import { getAllServerInfo, setServerInfo, getDb } from '../database';

const router = Router();

// GET / — Infos complètes du serveur (avec members, roles, channels)
// Le frontend attend cette structure depuis getServer()
router.get('/', (_req: Request, res: Response) => {
  const info = getAllServerInfo();
  const db = getDb();

  // Channels
  const channels = (db.prepare('SELECT * FROM channels ORDER BY position ASC').all() as any[]).map(ch => ({
    id: ch.id,
    name: ch.name,
    type: ch.type,
    topic: ch.topic || '',
    position: ch.position,
    parentId: ch.parent_id || null,
    isNsfw: ch.is_nsfw === 1,
    slowmode: ch.slowmode || 0,
    createdAt: ch.created_at,
  }));

  // Members (excl. bannis)
  const members = (db.prepare('SELECT * FROM members WHERE is_banned = 0 ORDER BY joined_at ASC').all() as any[]).map(m => {
    let roleIds: string[] = [];
    try { roleIds = JSON.parse(m.role_ids || '[]'); } catch { /* */ }
    return {
      id: m.user_id,
      user_id: m.user_id,
      username: m.username,
      display_name: m.display_name,
      displayName: m.display_name,
      avatar_url: m.avatar_url,
      avatarUrl: m.avatar_url,
      nickname: m.nickname,
      role_ids: roleIds,
      roleIds,
      joinedAt: m.joined_at,
      status: 'offline', // La présence réelle vient de Redis côté gateway
    };
  });

  // Roles
  const roles = (db.prepare('SELECT * FROM roles ORDER BY position DESC').all() as any[]).map(r => ({
    id: r.id,
    name: r.name,
    color: r.color,
    permissions: r.permissions,
    position: r.position,
    isDefault: r.is_default === 1,
    mentionable: r.mentionable === 1,
    createdAt: r.created_at,
  }));

  res.json({
    id: info.server_id || null,
    name: info.name || 'Mon Serveur',
    description: info.description || '',
    iconUrl: info.icon_url || null,
    icon_url: info.icon_url || null,
    bannerUrl: info.banner_url || null,
    banner_url: info.banner_url || null,
    isPublic: info.is_public === 'true',
    ownerId: info.owner_id || null,
    owner_id: info.owner_id || null,
    channels,
    members,
    roles,
  });
});

// PATCH / — Modifier les infos du serveur
router.patch('/', (req: Request, res: Response) => {
  const { name, description, iconUrl, bannerUrl, isPublic } = req.body;

  if (name !== undefined) setServerInfo('name', name);
  if (description !== undefined) setServerInfo('description', description);
  if (iconUrl !== undefined) setServerInfo('icon_url', iconUrl);
  if (bannerUrl !== undefined) setServerInfo('banner_url', bannerUrl);
  if (isPublic !== undefined) setServerInfo('is_public', String(isPublic));

  const info = getAllServerInfo();
  res.json({
    name: info.name || 'Mon Serveur',
    description: info.description || '',
    iconUrl: info.icon_url || null,
    bannerUrl: info.banner_url || null,
    isPublic: info.is_public === 'true',
    ownerId: info.owner_id || null,
  });
});

export default router;
