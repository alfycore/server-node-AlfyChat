#!/usr/bin/env node
// ==========================================
// ALFYCHAT — SERVER NODE v2 (self-hosted)
//
// Application standalone que les utilisateurs
// téléchargent et lancent sur leur PC/VPS
//
// Architecture : Prisma + Express + Socket.IO client
// Supporte : SQLite, PostgreSQL, MySQL
// ==========================================

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const program = new Command();

program
  .name('alfychat-server')
  .description('AlfyChat — nœud serveur communautaire self-hosted v2')
  .version('2.0.0');

program
  .command('start')
  .description('Démarrer le nœud serveur')
  .option('--server-id <id>', 'ID du serveur (depuis les paramètres AlfyChat)')
  .option('--token <token>', "Token d'authentification du nœud")
  .option('--name <name>', "Nom du serveur (utilisé lors de l'enregistrement automatique)")
  .option('--port <port>', 'Port HTTP local', '4100')
  .option('--gateway <url>', 'URL du gateway AlfyChat', 'https://gateway.alfychat.app')
  .option('--data-dir <dir>', 'Dossier de données (DB + uploads)', './alfychat-data')
  .action(async (options) => {
    const { loadConfig } = await import('./config');
    const config = loadConfig(options);

    let serverId = config.gateway.serverId;
    let nodeToken = config.gateway.nodeToken;
    const port = config.server.port;
    const gatewayUrl = config.gateway.url;
    const dataDir = config.server.dataDir;
    const envPath = path.resolve(process.cwd(), '.env');

    // ── Auto-registration if no credentials ──
    if (!serverId || !nodeToken) {
      console.log('');
      console.log('✨ Aucune configuration trouvée — enregistrement automatique du serveur...');
      console.log(`   Gateway : ${gatewayUrl}`);
      console.log('');

      let serverName = options.name;
      if (!serverName) {
        const os = await import('os');
        serverName = `Serveur de ${os.hostname()}`;
      }

      try {
        const { registerOnGateway } = await import('./gateway');
        const creds = await registerOnGateway(gatewayUrl, serverName, port);

        serverId = creds.serverId;
        nodeToken = creds.nodeToken;

        // Update config
        config.gateway.serverId = serverId;
        config.gateway.nodeToken = nodeToken;

        // Save to .env
        const dbType = config.db.type;
        let databaseUrl: string;
        if (dbType === 'sqlite') {
          const dbPath = config.db.database.endsWith('.db')
            ? config.db.database
            : path.join(dataDir, 'server.db');
          databaseUrl = `file:${path.resolve(dbPath)}`;
        } else if (dbType === 'postgres') {
          databaseUrl = `postgresql://${config.db.username}:${config.db.password}@${config.db.host}:${config.db.port}/${config.db.database}`;
        } else {
          databaseUrl = `mysql://${config.db.username}:${config.db.password}@${config.db.host}:${config.db.port}/${config.db.database}`;
        }

        const dbProvider = dbType === 'sqlite' ? 'sqlite' : dbType === 'postgres' ? 'postgresql' : 'mysql';
        const envContent = [
          `# AlfyChat Server Node v2 — généré automatiquement`,
          `SERVER_ID=${creds.serverId}`,
          `NODE_TOKEN=${creds.nodeToken}`,
          `GATEWAY_URL=${gatewayUrl}`,
          `PORT=${port}`,
          `DATA_DIR=${dataDir}`,
          `DB_TYPE=${dbType}`,
          `DB_PROVIDER=${dbProvider}`,
          `DATABASE_URL=${databaseUrl}`,
        ].join('\n') + '\n';

        fs.writeFileSync(envPath, envContent, 'utf8');

        const border = '═'.repeat(56);
        console.log('\n╔' + border + '╗');
        console.log('║  ✅ SERVEUR ENREGISTRÉ AVEC SUCCÈS                    ║');
        console.log('╠' + border + '╣');
        console.log(`║  Nom       : ${creds.serverName.padEnd(42)}║`);
        console.log(`║  Server ID : ${creds.serverId.substring(0, 42).padEnd(42)}║`);
        console.log(`║  Invitation: ${creds.inviteCode.padEnd(42)}║`);
        console.log('╠' + border + '╣');
        console.log('║  Credentials sauvegardés dans .env                    ║');
        console.log('║  Au prochain démarrage, la config sera chargée auto.  ║');
        console.log('╚' + border + '╝\n');
      } catch (err: any) {
        console.error(`❌ Enregistrement échoué : ${err.message}`);
        console.error('   Vérifiez que le gateway AlfyChat est accessible :', gatewayUrl);
        process.exit(1);
      }
    }

    // ── Ensure data directory ──
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // ── Initialize database (Prisma) ──
    // Set DATABASE_URL before prisma db push
    const dbType = config.db.type;
    if (dbType === 'sqlite') {
      const dbPath = config.db.database.endsWith('.db')
        ? config.db.database
        : path.join(dataDir, 'server.db');
      process.env.DATABASE_URL = `file:${path.resolve(dbPath)}`;
    } else if (dbType === 'postgres') {
      process.env.DATABASE_URL = `postgresql://${config.db.username}:${config.db.password}@${config.db.host}:${config.db.port}/${config.db.database}`;
    } else {
      process.env.DATABASE_URL = `mysql://${config.db.username}:${config.db.password}@${config.db.host}:${config.db.port}/${config.db.database}`;
    }

    const { execSync } = await import('child_process');
    // Detect available package runner (bunx on production, npx as fallback)
    const pkgRunner = (() => {
      try { execSync('bunx --version', { stdio: 'ignore' }); return 'bunx'; } catch { /* no bunx */ }
      try { execSync('npx --version', { stdio: 'ignore' }); return 'npx'; } catch { /* no npx */ }
      // Last resort: local binary
      return path.resolve(process.cwd(), 'node_modules', '.bin', 'prisma');
    })();

    // Prisma 6+ interdit env() dans le champ provider.
    // On substitue la valeur réelle avant db push, puis on restaure.
    const prismaProvider = dbType === 'sqlite' ? 'sqlite' : dbType === 'postgres' ? 'postgresql' : 'mysql';
    const schemaPath = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
    const schemaOriginal = fs.readFileSync(schemaPath, 'utf8');
    const schemaPatchedForPush = schemaOriginal.replace(
      /provider\s*=\s*env\("DB_PROVIDER"\)/,
      `provider = "${prismaProvider}"`
    );
    const schemaWasPatched = schemaPatchedForPush !== schemaOriginal;
    if (schemaWasPatched) {
      fs.writeFileSync(schemaPath, schemaPatchedForPush, 'utf8');
    }

    // Auto-push schema to DB (creates tables if needed)
    try {
      execSync(`${pkgRunner} prisma db push --skip-generate`, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    } catch (pushErr: any) {
      // SQLite ne peut pas modifier des index PRIMARY KEY/UNIQUE en place.
      // Si la DB est vide ou corrompue, --force-reset est sans danger.
      const msg: string = pushErr?.message ?? String(pushErr);
      const isSQLiteConstraintErr =
        msg.includes('index associated with UNIQUE or PRIMARY KEY') ||
        msg.includes('cannot drop index');
      if (isSQLiteConstraintErr && config.db.type === 'sqlite') {
        console.warn('⚠️  Migration SQLite impossible (contrainte index). Réinitialisation automatique de la base...');
        try {
          execSync(`${pkgRunner} prisma db push --force-reset --skip-generate`, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
        } catch (resetErr: any) {
          if (schemaWasPatched) { fs.writeFileSync(schemaPath, schemaOriginal, 'utf8'); }
          console.error('❌ Échec de la réinitialisation Prisma :', resetErr?.message ?? String(resetErr));
          process.exit(1);
        }
      } else {
        if (schemaWasPatched) { fs.writeFileSync(schemaPath, schemaOriginal, 'utf8'); }
        console.error('❌ Erreur Prisma db push :', msg);
        process.exit(1);
      }
    } finally {
      if (schemaWasPatched) { fs.writeFileSync(schemaPath, schemaOriginal, 'utf8'); }
    }
    const { initializeDatabase } = await import('./config/database');
    await initializeDatabase(config);
    const { logger } = await import('./utils/logger');
    logger.info(`Base de données initialisée (${config.db.type})`);

    // ── Initialize Redis (optional) ──
    const { initializeRedis } = await import('./config/redis');
    await initializeRedis(config);

    // ── Seed defaults ──
    const { ServerService } = await import('./services/server.service');
    const { RoleService } = await import('./services/role.service');
    const { ChannelService } = await import('./services/channel.service');

    const serverService = new ServerService();
    const roleService = new RoleService();
    const channelService = new ChannelService();

    await serverService.ensureServerExists(serverId, options.name || `Serveur ${serverId.substring(0, 8)}`);
    await roleService.ensureDefaults();
    await channelService.ensureDefaults();

    // ── Uploads directory ──
    const uploadsDir = path.join(dataDir, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    for (const sub of ['avatars', 'banners', 'icons', 'attachments']) {
      const subDir = path.join(uploadsDir, sub);
      if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
    }

    const { setUploadsDir } = await import('./routes/file.routes');
    setUploadsDir(uploadsDir);

    // ── Express app ──
    const { createApp } = await import('./app');
    const app = createApp(config, uploadsDir);

    app.listen(port, () => {
      const border = '═'.repeat(56);
      console.log('\n╔' + border + '╗');
      console.log('║  🚀 AlfyChat Server Node v2 — En ligne                ║');
      console.log('╠' + border + '╣');
      console.log(`║  Port      : ${String(port).padEnd(42)}║`);
      console.log(`║  Server ID : ${serverId.substring(0, 42).padEnd(42)}║`);
      console.log(`║  Gateway   : ${gatewayUrl.padEnd(42)}║`);
      console.log(`║  Données   : ${dataDir.padEnd(42)}║`);
      console.log(`║  DB Type   : ${config.db.type.padEnd(42)}║`);
      console.log('╚' + border + '╝\n');
    });

    // ── Connect to gateway ──
    const { connectToGateway, registerOnGateway } = await import('./gateway');
    const gwSocket = connectToGateway({ gatewayUrl, serverId, nodeToken, port });

    // ── Auto re-register on auth failure ──
    let reregistering = false;
    gwSocket.on('connect_error', async (err) => {
      if (reregistering) return;
      if (err.message.includes('Token') || err.message.includes('Authentification') || err.message.includes('401')) {
        reregistering = true;
        logger.warn('Token invalide — re-registration automatique en cours...');
        gwSocket.disconnect();
        try {
          const info = await serverService.getServerInfo();
          const creds = await registerOnGateway(gatewayUrl, info?.name || options.name, port);
          serverId = creds.serverId;
          nodeToken = creds.nodeToken;

          // Update .env
          const envContent = [
            `# AlfyChat Server Node v2 — généré automatiquement`,
            `SERVER_ID=${creds.serverId}`,
            `NODE_TOKEN=${creds.nodeToken}`,
            `GATEWAY_URL=${gatewayUrl}`,
            `PORT=${port}`,
            `DATA_DIR=${dataDir}`,
            `DB_TYPE=${config.db.type}`,
          ].join('\n') + '\n';
          fs.writeFileSync(envPath, envContent, 'utf8');

          logger.info(`Re-registration réussie ! Nouveau server ID: ${creds.serverId}`);
          connectToGateway({ gatewayUrl, serverId, nodeToken, port });
        } catch (reErr: any) {
          logger.error(`Re-registration échouée: ${reErr.message}`);
          reregistering = false;
        }
      }
    });

    // ── Graceful shutdown ──
    const shutdown = () => {
      console.log('\n👋 Arrêt du server node...');
      gwSocket.disconnect();
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  });

program.parse();
