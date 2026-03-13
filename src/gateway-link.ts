// ==========================================
// ALFYCHAT SERVER-NODE — Lien vers le Gateway
// Communication bidirectionnelle via Socket.IO
// Le gateway est la passerelle entre les clients et le server-node
// ==========================================

import { io, Socket } from 'socket.io-client';
import { getDb, getAllServerInfo, setServerInfo } from './database';
import { v4 as uuidv4 } from 'uuid';

interface ServerNodeConfig {
  gatewayUrl: string;
  serverId: string;
  nodeToken: string;
  port: number;
}

export interface RegisteredCredentials {
  serverId: string;
  nodeToken: string;
  serverName: string;
  inviteCode: string;
}

let socket: Socket | null = null;

// ── Cache pour le schéma de la table messages ──
let schemaChecked = false;
let hasServerIdCol = false;
let hasIsSystemCol = false;

function checkMessageSchema(): void {
  if (schemaChecked) return;
  try {
    const db = getDb();
    const info = db.prepare("PRAGMA table_info(messages)").all() as any[];
    hasServerIdCol = info.some((col: any) => col.name === 'server_id');
    hasIsSystemCol = info.some((col: any) => col.name === 'is_system');
    schemaChecked = true;
  } catch { /* will retry next time */ }
}

// ── Broadcast helper — envoie un événement à tous les membres via le gateway ──
export function broadcast(event: string, data: any): void {
  if (socket?.connected) {
    socket.emit('NODE_BROADCAST', { event, data });
  }
}

export function getGatewaySocket(): Socket | null {
  return socket;
}

// ── Connexion principale au gateway ──────────────────────────────────────────
export function connectToGateway(config: ServerNodeConfig): Socket {
  console.log(`🔌 Connexion au gateway AlfyChat: ${config.gatewayUrl}`);

  socket = io(`${config.gatewayUrl}/server-nodes`, {
    auth: {
      nodeToken: config.nodeToken,
      serverId: config.serverId,
      endpoint: `http://localhost:${config.port}`,
    },
    reconnection: true,
    reconnectionDelay: 5000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    console.log(`✅ Server-node connecté au gateway (id: ${socket?.id})`);
    // Envoyer le status online avec les infos du serveur
    const info = getAllServerInfo();
    const countRow = getDb().prepare('SELECT COUNT(*) as c FROM members WHERE is_banned = 0').get() as any;
    socket?.emit('NODE_STATUS', {
      serverId: config.serverId,
      status: 'online',
      name: info.name || 'Mon Serveur',
      memberCount: countRow?.c || 0,
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Déconnexion du gateway: ${reason} — reconnexion automatique...`);
  });

  socket.on('connect_error', (err) => {
    console.error(`❌ Erreur de connexion au gateway: ${err.message}`);
    // Si le token est invalide, proposer la re-registration
    if (err.message.includes('Token') || err.message.includes('Authentification') || err.message.includes('401')) {
      console.log('');
      console.log('💡 Le token semble invalide. Supprimez le fichier .env et relancez');
      console.log('   pour ré-enregistrer automatiquement le serveur.');
      console.log('');
    }
  });

  // ── Code admin à usage unique ──
  socket.on('SETUP_CODE', ({ code, expiresIn }: { code: string; serverId: string; expiresIn: number }) => {
    const border = '═'.repeat(54);
    const minutes = Math.floor(expiresIn / 60);
    console.log('\n╔' + border + '╗');
    console.log('║    ⚠️  CODE ADMIN — RÉCLAMEZ VOS DROITS            ║');
    console.log('╠' + border + '╣');
    console.log(`║  Code    : ${code.padEnd(44)}║`);
    console.log(`║  Expire  : dans ${String(minutes).padEnd(36)} min ║`);
    console.log('╠' + border + '╣');
    console.log('║  → Paramètres du serveur > Server Node             ║');
    console.log('║    → "Réclamer les droits admin"                   ║');
    console.log('╚' + border + '╝\n');
  });

  // ════════════════════════════════════════════════════════════════
  // Le gateway forwarde les requêtes des clients vers le server-node
  // Chaque événement a un callback (acknowledge) pour renvoyer la réponse
  // ════════════════════════════════════════════════════════════════

  // ── Messages ──
  socket.on('MSG_FORWARD', (data, callback) => {
    try {
      const db = getDb();
      const id = uuidv4();
      const now = new Date().toISOString();
      const isSystem = data.isSystem ? 1 : 0;

      // Vérifier que le salon existe
      const channel = db.prepare('SELECT id FROM channels WHERE id = ?').get(data.channelId);
      if (!channel) {
        if (typeof callback === 'function') callback({ error: 'Salon introuvable' });
        return;
      }

      // Utiliser le cache du schéma (évite PRAGMA sur chaque message)
      checkMessageSchema();

      if (hasServerIdCol) {
        const cols = `id, channel_id, server_id, sender_id, sender_username, sender_display_name, sender_avatar_url, content, attachments, reply_to_id, created_at, updated_at${hasIsSystemCol ? ', is_system' : ''}`;
        const placeholders = `?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${hasIsSystemCol ? ', ?' : ''}`;
        const params: any[] = [
          id, data.channelId, data.serverId || '', data.senderId,
          data.sender?.username || data.senderId,
          data.sender?.displayName || null,
          data.sender?.avatarUrl || null,
          data.content || '',
          JSON.stringify(data.attachments || []),
          data.replyToId || null,
          now, now,
        ];
        if (hasIsSystemCol) params.push(isSystem);
        db.prepare(`INSERT INTO messages (${cols}) VALUES (${placeholders})`).run(...params);
      } else {
        const cols = `id, channel_id, sender_id, sender_username, sender_display_name, sender_avatar_url, content, attachments, reply_to_id, created_at, updated_at${hasIsSystemCol ? ', is_system' : ''}`;
        const placeholders = `?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${hasIsSystemCol ? ', ?' : ''}`;
        const params: any[] = [
          id, data.channelId, data.senderId,
          data.sender?.username || data.senderId,
          data.sender?.displayName || null,
          data.sender?.avatarUrl || null,
          data.content || '',
          JSON.stringify(data.attachments || []),
          data.replyToId || null,
          now, now,
        ];
        if (hasIsSystemCol) params.push(isSystem);
        db.prepare(`INSERT INTO messages (${cols}) VALUES (${placeholders})`).run(...params);
      }

      const message = {
        id, channelId: data.channelId, senderId: data.senderId,
        sender: data.sender || { id: data.senderId, username: data.senderId },
        content: data.content || '', attachments: data.attachments || [],
        replyToId: data.replyToId || null, isEdited: false,
        isSystem: !!data.isSystem,
        createdAt: now, updatedAt: now,
      };

      // Broadcast à tous les membres connectés
      broadcast('MSG_BROADCAST', { channelId: data.channelId, message });

      if (typeof callback === 'function') callback({ success: true, message });
    } catch (err: any) {
      console.error('Erreur MSG_FORWARD:', err);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // ── Salons ──
  socket.on('CHANNEL_LIST', (_data, callback) => {
    const db = getDb();
    const channels = db.prepare('SELECT * FROM channels ORDER BY position ASC').all();
    if (typeof callback === 'function') callback({ channels: (channels as any[]).map(formatChannel) });
  });

  socket.on('CHANNEL_CREATE', (data, callback) => {
    try {
      const db = getDb();
      const id = uuidv4();
      const maxPos = db.prepare('SELECT MAX(position) as mp FROM channels').get() as { mp: number | null };
      const position = (maxPos.mp ?? -1) + 1;

      db.prepare(`INSERT INTO channels (id, name, type, topic, position) VALUES (?, ?, ?, ?, ?)`)
        .run(id, data.name, data.type || 'text', data.topic || '', position);

      const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
      const formatted = formatChannel(channel as any);
      broadcast('CHANNEL_CREATE', { channel: formatted });
      if (typeof callback === 'function') callback({ success: true, channel: formatted });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('CHANNEL_UPDATE', (data, callback) => {
    try {
      const db = getDb();
      const updates: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
      if (data.topic !== undefined) { updates.push('topic = ?'); params.push(data.topic); }
      if (data.position !== undefined) { updates.push('position = ?'); params.push(data.position); }
      if (data.type !== undefined) { updates.push('type = ?'); params.push(data.type); }

      if (updates.length > 0) {
        params.push(data.channelId);
        db.prepare(`UPDATE channels SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(data.channelId);
      const formatted = formatChannel(channel as any);
      broadcast('CHANNEL_UPDATE', { channel: formatted });
      if (typeof callback === 'function') callback({ success: true, channel: formatted });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('CHANNEL_DELETE', (data, callback) => {
    try {
      const db = getDb();
      db.prepare('DELETE FROM channels WHERE id = ?').run(data.channelId);
      broadcast('CHANNEL_DELETE', { channelId: data.channelId });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // ── Channel Permissions ──
  socket.on('CHANNEL_PERMS_GET', (data, callback) => {
    try {
      const db = getDb();
      const perms = db.prepare('SELECT * FROM channel_permissions WHERE channel_id = ?').all(data.channelId) as any[];
      const formatted = perms.map((p: any) => ({
        channelId: p.channel_id,
        roleId: p.role_id,
        allow: p.allow,
        deny: p.deny,
      }));
      if (typeof callback === 'function') callback({ permissions: formatted });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('CHANNEL_PERMS_SET', (data, callback) => {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO channel_permissions (channel_id, role_id, allow, deny)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(channel_id, role_id) DO UPDATE SET allow = excluded.allow, deny = excluded.deny
      `).run(data.channelId, data.roleId, data.allow || 0, data.deny || 0);
      broadcast('CHANNEL_PERMS_UPDATE', { channelId: data.channelId, roleId: data.roleId, allow: data.allow || 0, deny: data.deny || 0 });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // ── Rôles ──
  socket.on('ROLE_LIST', (_data, callback) => {
    const db = getDb();
    const roles = db.prepare('SELECT * FROM roles ORDER BY position DESC').all();
    if (typeof callback === 'function') callback({ roles: (roles as any[]).map(formatRole) });
  });

  socket.on('ROLE_CREATE', (data, callback) => {
    try {
      const db = getDb();
      const id = uuidv4();
      const maxPos = db.prepare('SELECT MAX(position) as mp FROM roles').get() as { mp: number | null };
      const position = (maxPos.mp ?? -1) + 1;

      db.prepare(`INSERT INTO roles (id, name, color, permissions, position, mentionable) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(id, data.name, data.color || '#99AAB5', data.permissions || 0, position, data.mentionable ? 1 : 0);

      const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
      const formatted = formatRole(role as any);
      broadcast('ROLE_CREATE', { role: formatted });
      if (typeof callback === 'function') callback({ success: true, role: formatted });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('ROLE_UPDATE', (data, callback) => {
    try {
      const db = getDb();
      const updates: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
      if (data.color !== undefined) { updates.push('color = ?'); params.push(data.color); }
      if (data.permissions !== undefined) { updates.push('permissions = ?'); params.push(data.permissions); }
      if (data.position !== undefined) { updates.push('position = ?'); params.push(data.position); }
      if (data.mentionable !== undefined) { updates.push('mentionable = ?'); params.push(data.mentionable ? 1 : 0); }

      if (updates.length > 0) {
        params.push(data.roleId);
        db.prepare(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(data.roleId);
      const formatted = formatRole(role as any);
      broadcast('ROLE_UPDATE', { role: formatted });
      if (typeof callback === 'function') callback({ success: true, role: formatted });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('ROLE_DELETE', (data, callback) => {
    try {
      const db = getDb();
      const existing = db.prepare('SELECT is_default FROM roles WHERE id = ?').get(data.roleId) as any;
      if (existing?.is_default) {
        if (typeof callback === 'function') callback({ error: 'Impossible de supprimer le rôle par défaut' });
        return;
      }
      db.prepare('DELETE FROM roles WHERE id = ?').run(data.roleId);
      broadcast('ROLE_DELETE', { roleId: data.roleId });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // ── Membres ──
  socket.on('MEMBER_LIST', (_data, callback) => {
    const db = getDb();
    const members = db.prepare('SELECT * FROM members WHERE is_banned = 0 ORDER BY joined_at ASC').all();
    if (typeof callback === 'function') callback({ members: (members as any[]).map(formatMember) });
  });

  socket.on('MEMBER_JOIN', (data, callback) => {
    try {
      const db = getDb();

      // Vérifier ban
      const existing = db.prepare('SELECT * FROM members WHERE user_id = ?').get(data.userId) as any;
      if (existing?.is_banned) {
        if (typeof callback === 'function') callback({ error: 'Utilisateur banni', reason: existing.ban_reason });
        return;
      }

      if (existing) {
        db.prepare('UPDATE members SET username = ?, display_name = ?, avatar_url = ? WHERE user_id = ?')
          .run(data.username, data.displayName || null, data.avatarUrl || null, data.userId);
      } else {
        const defaultRole = db.prepare('SELECT id FROM roles WHERE is_default = 1').get() as any;
        const roleIds = defaultRole ? JSON.stringify([defaultRole.id]) : '[]';
        db.prepare('INSERT INTO members (user_id, username, display_name, avatar_url, role_ids) VALUES (?, ?, ?, ?, ?)')
          .run(data.userId, data.username, data.displayName || null, data.avatarUrl || null, roleIds);
      }

      const member = db.prepare('SELECT * FROM members WHERE user_id = ?').get(data.userId);
      broadcast('MEMBER_JOIN', { member: formatMember(member as any) });
      if (typeof callback === 'function') callback({ success: true, member: formatMember(member as any) });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('MEMBER_UPDATE', (data, callback) => {
    try {
      const db = getDb();
      const updates: string[] = [];
      const params: any[] = [];

      if (data.nickname !== undefined) { updates.push('nickname = ?'); params.push(data.nickname || null); }
      if (data.roleIds !== undefined) { updates.push('role_ids = ?'); params.push(JSON.stringify(data.roleIds)); }

      if (updates.length > 0) {
        params.push(data.userId);
        db.prepare(`UPDATE members SET ${updates.join(', ')} WHERE user_id = ?`).run(...params);
      }

      const member = db.prepare('SELECT * FROM members WHERE user_id = ?').get(data.userId);
      broadcast('MEMBER_UPDATE', { member: formatMember(member as any) });
      if (typeof callback === 'function') callback({ success: true, member: formatMember(member as any) });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('MEMBER_KICK', (data, callback) => {
    try {
      const db = getDb();
      db.prepare('DELETE FROM members WHERE user_id = ?').run(data.userId);
      broadcast('MEMBER_KICK', { userId: data.userId });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('MEMBER_BAN', (data, callback) => {
    try {
      const db = getDb();
      db.prepare('UPDATE members SET is_banned = 1, ban_reason = ? WHERE user_id = ?')
        .run(data.reason || null, data.userId);
      broadcast('MEMBER_BAN', { userId: data.userId });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('MEMBER_UNBAN', (data, callback) => {
    try {
      const db = getDb();
      db.prepare('UPDATE members SET is_banned = 0, ban_reason = NULL WHERE user_id = ?').run(data.userId);
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // ── Infos du serveur ──
  socket.on('SERVER_INFO', (_data, callback) => {
    const info = getAllServerInfo();
    if (typeof callback === 'function') callback({
      name: info.name || 'Mon Serveur',
      description: info.description || '',
      iconUrl: info.icon_url || null,
      bannerUrl: info.banner_url || null,
      isPublic: info.is_public === 'true',
      ownerId: info.owner_id || null,
    });
  });

  socket.on('SERVER_UPDATE', (data, callback) => {
    try {
      if (data.name !== undefined) setServerInfo('name', data.name);
      if (data.description !== undefined) setServerInfo('description', data.description);
      if (data.iconUrl !== undefined) setServerInfo('icon_url', data.iconUrl);
      if (data.bannerUrl !== undefined) setServerInfo('banner_url', data.bannerUrl);
      if (data.isPublic !== undefined) setServerInfo('is_public', String(data.isPublic));

      const info = getAllServerInfo();
      const result = {
        name: info.name || 'Mon Serveur',
        description: info.description || '',
        iconUrl: info.icon_url || null,
        bannerUrl: info.banner_url || null,
        isPublic: info.is_public === 'true',
        ownerId: info.owner_id || null,
      };
      broadcast('SERVER_UPDATE', result);
      if (typeof callback === 'function') callback({ success: true, ...result });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // ── Invitations ──
  socket.on('INVITE_CREATE', (data, callback) => {
    try {
      const db = getDb();
      const id = uuidv4();
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let code = '';
      for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
      const expiresAt = data.expiresIn ? new Date(Date.now() + data.expiresIn * 1000).toISOString() : null;

      db.prepare('INSERT INTO invites (id, code, creator_id, max_uses, expires_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, code, data.creatorId || data.userId, data.maxUses || null, expiresAt);

      if (typeof callback === 'function') callback({ success: true, code, id });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('INVITE_LIST', (data, callback) => {
    try {
      const db = getDb();
      const invites = db.prepare('SELECT * FROM invites ORDER BY created_at DESC').all() as any[];
      const formatted = invites.map((inv: any) => ({
        id: inv.id,
        code: inv.code,
        creatorId: inv.creator_id,
        maxUses: inv.max_uses,
        uses: inv.uses || 0,
        expiresAt: inv.expires_at,
        isPermanent: !inv.expires_at,
        createdAt: inv.created_at,
      }));
      if (typeof callback === 'function') callback({ invites: formatted });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ invites: [], error: err.message });
    }
  });

  socket.on('INVITE_DELETE', (data, callback) => {
    try {
      const db = getDb();
      db.prepare('DELETE FROM invites WHERE id = ?').run(data.inviteId);
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('INVITE_VERIFY', (data, callback) => {
    try {
      const db = getDb();
      const invite = db.prepare('SELECT * FROM invites WHERE code = ?').get(data.code) as any;
      if (!invite) {
        if (typeof callback === 'function') callback({ error: 'Invitation introuvable' });
        return;
      }
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        if (typeof callback === 'function') callback({ error: 'Invitation expirée' });
        return;
      }
      if (invite.max_uses && invite.uses >= invite.max_uses) {
        if (typeof callback === 'function') callback({ error: 'Invitation épuisée' });
        return;
      }

      // Incrémenter les utilisations
      db.prepare('UPDATE invites SET uses = uses + 1 WHERE id = ?').run(invite.id);
      if (typeof callback === 'function') callback({ success: true, invite });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // ── Messages history ──
  socket.on('MSG_HISTORY', (data, callback) => {
    try {
      const db = getDb();
      const limit = Math.min(data.limit || 50, 100);
      const params: any[] = [data.channelId];
      let whereBefore = '';
      if (data.before) {
        whereBefore = 'AND created_at < ?';
        params.push(data.before);
      }
      params.push(limit);

      const messages = db.prepare(`
        SELECT * FROM messages
        WHERE channel_id = ? AND is_deleted = 0 ${whereBefore}
        ORDER BY created_at DESC LIMIT ?
      `).all(...params) as any[];

      const result = messages.map(formatMessage).reverse();

      if (typeof callback === 'function') callback({ messages: result });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // ── Typing indicators ──
  socket.on('TYPING_START', (data) => {
    broadcast('TYPING_START', { channelId: data.channelId, userId: data.userId, username: data.username });
  });

  socket.on('TYPING_STOP', (data) => {
    broadcast('TYPING_STOP', { channelId: data.channelId, userId: data.userId });
  });

  // ── Message edit/delete ──
  socket.on('MSG_EDIT', (data, callback) => {
    try {
      const db = getDb();
      const msg = db.prepare('SELECT sender_id FROM messages WHERE id = ?').get(data.messageId) as any;
      if (!msg) {
        if (typeof callback === 'function') callback({ error: 'Message introuvable' });
        return;
      }
      if (msg.sender_id !== data.userId) {
        if (typeof callback === 'function') callback({ error: 'Non autorisé' });
        return;
      }
      const now = new Date().toISOString();
      db.prepare('UPDATE messages SET content = ?, is_edited = 1, updated_at = ? WHERE id = ?')
        .run(data.content, now, data.messageId);

      broadcast('MSG_EDIT', { messageId: data.messageId, content: data.content, channelId: data.channelId });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('MSG_DELETE', (data, callback) => {
    try {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare('UPDATE messages SET is_deleted = 1, updated_at = ? WHERE id = ?')
        .run(now, data.messageId);

      broadcast('MSG_DELETE', { messageId: data.messageId, channelId: data.channelId });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  return socket;
}

// ── Auto-enregistrement auprès du gateway ─────────────────────────────────
export function registerOnGateway(
  gatewayUrl: string,
  serverName?: string,
  port?: number
): Promise<RegisteredCredentials> {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Enregistrement auprès du gateway: ${gatewayUrl}`);

    const tempSocket = io(`${gatewayUrl}/server-nodes`, {
      auth: {
        register: true,
        name: serverName || 'Mon Serveur',
        endpoint: port ? `http://localhost:${port}` : undefined,
      },
      reconnection: false,
    });

    const timeout = setTimeout(() => {
      tempSocket.disconnect();
      reject(new Error('Timeout : le gateway ne répond pas (30s)'));
    }, 30000);

    tempSocket.on('REGISTERED', (data: RegisteredCredentials) => {
      clearTimeout(timeout);
      tempSocket.disconnect();
      resolve(data);
    });

    tempSocket.on('REGISTER_ERROR', (data: { message?: string; error?: string }) => {
      clearTimeout(timeout);
      tempSocket.disconnect();
      reject(new Error(data.message || data.error || 'Échec de l\'enregistrement'));
    });

    tempSocket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Impossible de joindre le gateway: ${err.message}`));
    });
  });
}

// ── Helpers format ──

function formatChannel(ch: any) {
  return {
    id: ch.id,
    name: ch.name,
    type: ch.type,
    topic: ch.topic || '',
    position: ch.position,
    parentId: ch.parent_id || null,
    isNsfw: ch.is_nsfw === 1,
    slowmode: ch.slowmode || 0,
    createdAt: ch.created_at,
  };
}

function formatRole(r: any) {
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

function formatMember(m: any) {
  let roleIds: string[] = [];
  try { roleIds = JSON.parse(m.role_ids || '[]'); } catch { /* skip */ }
  return {
    userId: m.user_id,
    username: m.username,
    displayName: m.display_name,
    avatarUrl: m.avatar_url,
    nickname: m.nickname,
    roleIds,
    joinedAt: m.joined_at,
    isBanned: m.is_banned === 1,
  };
}

function formatMessage(m: any) {
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
    attachments: JSON.parse(m.attachments || '[]'),
    replyToId: m.reply_to_id || null,
    isEdited: Boolean(m.is_edited),
    isSystem: Boolean(m.is_system),
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  };
}
