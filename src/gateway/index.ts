import { io, Socket } from 'socket.io-client';
import { setSocket } from './broadcast';
import { registerMessageHandlers } from './handlers/message.handler';
import { registerChannelHandlers } from './handlers/channel.handler';
import { registerRoleHandlers } from './handlers/role.handler';
import { registerMemberHandlers } from './handlers/member.handler';
import { registerServerHandlers } from './handlers/server.handler';
import { registerInviteHandlers } from './handlers/invite.handler';
import { registerTypingHandlers } from './handlers/typing.handler';
import { registerSetupHandlers } from './handlers/setup.handler';
import { MemberService } from '../services/member.service';
import { ServerService } from '../services/server.service';
import { logger } from '../utils/logger';

export interface GatewayConfig {
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

const memberService = new MemberService();
const serverService = new ServerService();

/**
 * Connect to the AlfyChat gateway via Socket.IO namespace /server-nodes.
 * Registers all event handlers.
 */
export function connectToGateway(config: GatewayConfig): Socket {
  logger.info(`Connexion au gateway AlfyChat: ${config.gatewayUrl}`);

  const socket = io(`${config.gatewayUrl}/server-nodes`, {
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

  setSocket(socket);

  socket.on('connect', async () => {
    logger.info(`Server-node connecté au gateway (id: ${socket.id})`);

    // Send online status
    try {
      const info = await serverService.getServerInfo();
      const count = await memberService.count();
      socket.emit('NODE_STATUS', {
        serverId: config.serverId,
        status: 'online',
        name: info?.name || 'Mon Serveur',
        memberCount: count,
      });
    } catch (err: any) {
      logger.warn(`NODE_STATUS envoi échoué: ${err.message}`);
    }
  });

  socket.on('disconnect', (reason) => {
    logger.warn(`Déconnexion du gateway: ${reason} — reconnexion automatique...`);
  });

  socket.on('connect_error', (err) => {
    logger.error(`Erreur de connexion au gateway: ${err.message}`);
    if (err.message.includes('Token') || err.message.includes('Authentification') || err.message.includes('401')) {
      logger.info('Le token semble invalide. Supprimez le fichier .env et relancez pour ré-enregistrer.');
    }
  });

  // Register all event handlers
  registerMessageHandlers(socket);
  registerChannelHandlers(socket);
  registerRoleHandlers(socket);
  registerMemberHandlers(socket);
  registerServerHandlers(socket);
  registerInviteHandlers(socket);
  registerTypingHandlers(socket);
  registerSetupHandlers(socket);

  return socket;
}

/**
 * Auto-register a new server node with the gateway.
 * Returns credentials to save in .env.
 */
export function registerOnGateway(
  gatewayUrl: string,
  serverName?: string,
  port?: number,
): Promise<RegisteredCredentials> {
  return new Promise((resolve, reject) => {
    logger.info(`Enregistrement auprès du gateway: ${gatewayUrl}`);

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
      reject(new Error(data.message || data.error || "Échec de l'enregistrement"));
    });

    tempSocket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Impossible de joindre le gateway: ${err.message}`));
    });
  });
}
