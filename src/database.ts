// ==========================================
// ALFYCHAT SERVER-NODE — Base de données SQLite
// Stockage local : serveur, salons, rôles, membres, messages, fichiers
// ==========================================

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

let db: Database.Database;

export function initDatabase(dataDir: string): Database.Database {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'server.db');
  db = new Database(dbPath);

  // WAL mode pour de meilleures performances concurrentes
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- ════════════════════════════════════
    -- Infos du serveur (clé-valeur)
    -- ════════════════════════════════════
    CREATE TABLE IF NOT EXISTS server_info (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- ════════════════════════════════════
    -- Salons (text & voice)
    -- ════════════════════════════════════
    CREATE TABLE IF NOT EXISTS channels (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'voice', 'category', 'announcement')),
      topic       TEXT DEFAULT '',
      position    INTEGER NOT NULL DEFAULT 0,
      parent_id   TEXT,
      is_nsfw     INTEGER NOT NULL DEFAULT 0,
      slowmode    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES channels(id) ON DELETE SET NULL
    );

    -- ════════════════════════════════════
    -- Rôles
    -- ════════════════════════════════════
    CREATE TABLE IF NOT EXISTS roles (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      color       TEXT NOT NULL DEFAULT '#99AAB5',
      permissions INTEGER NOT NULL DEFAULT 0,
      position    INTEGER NOT NULL DEFAULT 0,
      is_default  INTEGER NOT NULL DEFAULT 0,
      mentionable INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ════════════════════════════════════
    -- Membres du serveur
    -- ════════════════════════════════════
    CREATE TABLE IF NOT EXISTS members (
      user_id      TEXT PRIMARY KEY,
      username     TEXT NOT NULL,
      display_name TEXT,
      avatar_url   TEXT,
      nickname     TEXT,
      role_ids     TEXT NOT NULL DEFAULT '[]',
      joined_at    TEXT NOT NULL DEFAULT (datetime('now')),
      is_banned    INTEGER NOT NULL DEFAULT 0,
      ban_reason   TEXT
    );

    -- ════════════════════════════════════
    -- Messages
    -- ════════════════════════════════════
    CREATE TABLE IF NOT EXISTS messages (
      id                  TEXT PRIMARY KEY,
      channel_id          TEXT NOT NULL,
      sender_id           TEXT NOT NULL,
      sender_username     TEXT NOT NULL,
      sender_display_name TEXT,
      sender_avatar_url   TEXT,
      content             TEXT NOT NULL DEFAULT '',
      attachments         TEXT DEFAULT '[]',
      reply_to_id         TEXT,
      is_edited           INTEGER NOT NULL DEFAULT 0,
      is_deleted          INTEGER NOT NULL DEFAULT 0,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_channel
      ON messages(channel_id, created_at DESC);

    -- ════════════════════════════════════
    -- Réactions
    -- ════════════════════════════════════
    CREATE TABLE IF NOT EXISTS reactions (
      id         TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      emoji      TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(message_id, user_id, emoji),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    -- ════════════════════════════════════
    -- Fichiers uploadés
    -- ════════════════════════════════════
    CREATE TABLE IF NOT EXISTS files (
      id            TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      stored_name   TEXT NOT NULL,
      mime_type     TEXT NOT NULL,
      size          INTEGER NOT NULL,
      uploader_id   TEXT NOT NULL,
      channel_id    TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ════════════════════════════════════
    -- Invitations
    -- ════════════════════════════════════
    CREATE TABLE IF NOT EXISTS invites (
      id         TEXT PRIMARY KEY,
      code       TEXT NOT NULL UNIQUE,
      creator_id TEXT NOT NULL,
      max_uses   INTEGER,
      uses       INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ════════════════════════════════════
    -- Permissions par salon par rôle (overrides)
    -- ════════════════════════════════════
    CREATE TABLE IF NOT EXISTS channel_permissions (
      channel_id  TEXT NOT NULL,
      role_id     TEXT NOT NULL,
      allow       INTEGER NOT NULL DEFAULT 0,
      deny        INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (channel_id, role_id),
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );
  `);

  // ── Migrations ───────────────────────────────────────────────────────

  // Migration: ajouter colonne is_system aux messages
  try {
    const msgCols = db.prepare("PRAGMA table_info(messages)").all() as any[];
    if (!msgCols.some((c: any) => c.name === 'is_system')) {
      db.exec(`ALTER TABLE messages ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0`);
    }
  } catch { /* colonne déjà existante */ }

  // Migration: si la table channels n'a pas 'announcement' dans le CHECK, recréer
  try {
    const tblSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='channels'").get() as any)?.sql || '';
    if (tblSql && !tblSql.includes('announcement')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS channels_new (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          type        TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'voice', 'category', 'announcement')),
          topic       TEXT DEFAULT '',
          position    INTEGER NOT NULL DEFAULT 0,
          parent_id   TEXT,
          is_nsfw     INTEGER NOT NULL DEFAULT 0,
          slowmode    INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (parent_id) REFERENCES channels(id) ON DELETE SET NULL
        );
        INSERT INTO channels_new SELECT id, name, type, topic, position, parent_id, is_nsfw, slowmode, created_at FROM channels;
        DROP TABLE channels;
        ALTER TABLE channels_new RENAME TO channels;
      `);
    }
  } catch (e) { console.warn('Migration channels CHECK:', e); }

  // ── Données par défaut ──────────────────────────────────────────────
  // Rôle @everyone par défaut
  const existingDefault = db.prepare('SELECT id FROM roles WHERE is_default = 1').get();
  if (!existingDefault) {
    const defaultRoleId = uuidv4();
    db.prepare(`
      INSERT INTO roles (id, name, color, permissions, position, is_default)
      VALUES (?, '@everyone', '#99AAB5', ?, 0, 1)
    `).run(defaultRoleId, 0x1 | 0x2 | 0x4 | 0x10); // VIEW + SEND + READ_HISTORY + CONNECT
  }

  // Salon #général par défaut
  const existingChannel = db.prepare('SELECT id FROM channels LIMIT 1').get();
  if (!existingChannel) {
    db.prepare(`INSERT INTO channels (id, name, type, position) VALUES (?, 'général', 'text', 0)`)
      .run(uuidv4());
    db.prepare(`INSERT INTO channels (id, name, type, position) VALUES (?, 'Vocal', 'voice', 1)`)
      .run(uuidv4());
  }

  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized — call initDatabase() first');
  return db;
}

// ── Helpers pour server_info (clé-valeur) ──

export function getServerInfo(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM server_info WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setServerInfo(key: string, value: string): void {
  getDb().prepare('INSERT OR REPLACE INTO server_info (key, value) VALUES (?, ?)').run(key, value);
}

export function getAllServerInfo(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM server_info').all() as { key: string; value: string }[];
  const info: Record<string, string> = {};
  for (const row of rows) info[row.key] = row.value;
  return info;
}

