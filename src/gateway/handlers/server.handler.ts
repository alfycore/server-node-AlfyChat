import { Socket } from 'socket.io-client';
import { ServerService } from '../../services/server.service';
import { broadcast } from '../broadcast';
import { logger } from '../../utils/logger';

const serverService = new ServerService();

export function registerServerHandlers(socket: Socket) {
  socket.on('SERVER_INFO', async (_data: any, callback: Function) => {
    try {
      const info = await serverService.getServerInfo();
      if (typeof callback === 'function') callback(info || {});
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('SERVER_UPDATE', async (data: any, callback: Function) => {
    try {
      const result = await serverService.updateServerInfo({
        name: data.name,
        description: data.description,
        iconUrl: data.iconUrl,
        bannerUrl: data.bannerUrl,
        isPublic: data.isPublic,
      });
      broadcast('SERVER_UPDATE', result);
      if (typeof callback === 'function') callback({ success: true, ...result });
    } catch (err: any) {
      logger.error(`SERVER_UPDATE: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });
}
