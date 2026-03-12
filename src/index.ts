#!/usr/bin/env node
// ==========================================
// ALFYCHAT — SERVER NODE (self-hosted)
// Application standalone que les utilisateurs
// téléchargent et lancent sur leur PC/VPS
//
// Gère : salons, rôles, membres, messages,
// invitations, uploads, paramètres serveur
//
// Le backend AlfyChat central est juste une
// passerelle — toutes les données sont locales
// ==========================================

import { Command } from 'commander';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();

program
  .name('alfychat-server')
  .description('AlfyChat — nœud serveur communautaire self-hosted')
  .version('1.0.0');

program
  .command('start')
  .description('Démarrer le nœud serveur')
  .option('--server-id <id>', 'ID du serveur (depuis les paramètres AlfyChat)')
  .option('--token <token>', 'Token d\'authentification du nœud')
  .option('--name <name>', 'Nom du serveur (utilisé lors de l\'enregistrement automatique)')
  .option('--port <port>', 'Port HTTP local', '4100')
  .option('--gateway <url>', 'URL du gateway AlfyChat', 'http://localhost:3000')
  .option('--data-dir <dir>', 'Dossier de données (SQLite + uploads)', './alfychat-data')
  .action(async (options) => {
    let serverId: string = options.serverId || process.env.SERVER_ID || '';
    let nodeToken: string = options.token || process.env.NODE_TOKEN || '';
    const port = parseInt(options.port || process.env.PORT || '4100');
    const gatewayUrl: string = options.gateway || process.env.GATEWAY_URL || 'https://gateway.alfychat.app';
    const dataDir: string = path.resolve(options.dataDir || process.env.DATA_DIR || './alfychat-data');
    const envPath = path.resolve(process.cwd(), '.env');

    // ── Auto-enregistrement si pas de credentials ──────────────────────
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
        const { registerOnGateway } = await import('./gateway-link');
        const creds = await registerOnGateway(gatewayUrl, serverName, port);

        serverId = creds.serverId;
        nodeToken = creds.nodeToken;

        // Sauvegarder dans .env pour les prochains démarrages
        const envContent = [
          `# AlfyChat Server Node — généré automatiquement`,
          `SERVER_ID=${creds.serverId}`,
          `NODE_TOKEN=${creds.nodeToken}`,
          `GATEWAY_URL=${gatewayUrl}`,
          `PORT=${port}`,
          `DATA_DIR=${dataDir}`,
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

    // ── Initialisation DB ──────────────────────────────────────────────
    const { initDatabase, setServerInfo, getServerInfo } = await import('./database');
    initDatabase(dataDir);
    console.log(`✅ Base de données initialisée dans ${dataDir}`);

    // Initialiser le nom du serveur si pas encore fait
    if (!getServerInfo('name')) {
      setServerInfo('name', options.name || `Serveur ${serverId.substring(0, 8)}`);
    }
    if (!getServerInfo('owner_id')) {
      // On mettra le vrai owner_id quand quelqu'un réclame les droits admin
      setServerInfo('owner_id', '');
    }

    // ── Dossier uploads ────────────────────────────────────────────────
    const uploadsDir = path.join(dataDir, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    // Sous-dossiers pour les médias
    for (const sub of ['avatars', 'banners', 'icons', 'attachments']) {
      const subDir = path.join(uploadsDir, sub);
      if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
    }

    const { setUploadsDir } = await import('./routes/files');
    setUploadsDir(uploadsDir);

    // ── Express app ────────────────────────────────────────────────────
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));

    // Import routers
    const serverRouter = (await import('./routes/server')).default;
    const channelsRouter = (await import('./routes/channels')).default;
    const rolesRouter = (await import('./routes/roles')).default;
    const membersRouter = (await import('./routes/members')).default;
    const messagesRouter = (await import('./routes/messages')).default;
    const filesRouter = (await import('./routes/files')).default;
    const invitesRouter = (await import('./routes/invites')).default;

    // Routes REST (accessible directement et via proxy gateway)
    app.use('/server', serverRouter);
    app.use('/channels', channelsRouter);
    app.use('/roles', rolesRouter);
    app.use('/members', membersRouter);
    app.use('/messages', messagesRouter);
    app.use('/files', filesRouter);
    app.use('/invites', invitesRouter);

    // Servir les fichiers statiques uploadés
    app.use('/uploads', express.static(uploadsDir));

    // Health check
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', serverId, port, gatewayUrl });
    });

    app.listen(port, () => {
      const border = '═'.repeat(56);
      console.log('\n╔' + border + '╗');
      console.log('║  🚀 AlfyChat Server Node — En ligne                   ║');
      console.log('╠' + border + '╣');
      console.log(`║  Port      : ${String(port).padEnd(42)}║`);
      console.log(`║  Server ID : ${serverId.substring(0, 42).padEnd(42)}║`);
      console.log(`║  Gateway   : ${gatewayUrl.padEnd(42)}║`);
      console.log(`║  Données   : ${dataDir.padEnd(42)}║`);
      console.log('╚' + border + '╝\n');
    });

    // ── Connexion au gateway ───────────────────────────────────────────
    const { connectToGateway, registerOnGateway } = await import('./gateway-link');
    const gwSocket = connectToGateway({ gatewayUrl, serverId, nodeToken, port });

    // Si l'auth échoue (token expiré/invalide), re-register automatiquement
    let reregistering = false;
    gwSocket.on('connect_error', async (err) => {
      if (reregistering) return;
      if (err.message.includes('Token') || err.message.includes('Authentification') || err.message.includes('401')) {
        reregistering = true;
        console.log('\n🔄 Token invalide — re-registration automatique en cours...');
        gwSocket.disconnect();
        try {
          const creds = await registerOnGateway(gatewayUrl, getServerInfo('name') || options.name, port);
          serverId = creds.serverId;
          nodeToken = creds.nodeToken;

          // Mettre à jour .env
          const envContent = [
            `# AlfyChat Server Node — généré automatiquement`,
            `SERVER_ID=${creds.serverId}`,
            `NODE_TOKEN=${creds.nodeToken}`,
            `GATEWAY_URL=${gatewayUrl}`,
            `PORT=${port}`,
            `DATA_DIR=${dataDir}`,
          ].join('\n') + '\n';
          fs.writeFileSync(envPath, envContent, 'utf8');

          console.log(`✅ Re-registration réussie ! Nouveau server ID: ${creds.serverId}`);
          console.log('🔌 Reconnexion au gateway...');
          connectToGateway({ gatewayUrl, serverId, nodeToken, port });
        } catch (reErr: any) {
          console.error(`❌ Re-registration échouée: ${reErr.message}`);
          reregistering = false;
        }
      }
    });

    // ── Arrêt gracieux ─────────────────────────────────────────────────
    const shutdown = () => {
      console.log('\n👋 Arrêt du server node...');
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  });

program.parse();
