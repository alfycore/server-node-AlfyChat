import { Socket } from 'socket.io-client';
import { InviteService } from '../../services/invite.service';
import { formatInvite } from '../../utils/format';
import { logger } from '../../utils/logger';

const inviteService = new InviteService();

export function registerInviteHandlers(socket: Socket) {
  socket.on('INVITE_CREATE', async (data: any, callback: Function) => {
    try {
      const invite = await inviteService.create({
        serverId: data.serverId || process.env.SERVER_ID || '',
        creatorId: data.creatorId || data.userId,
        maxUses: data.maxUses,
        expiresIn: data.expiresIn,
      });
      if (typeof callback === 'function') callback({ success: true, code: invite.code, id: invite.id });
    } catch (err: any) {
      logger.error(`INVITE_CREATE: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('INVITE_LIST', async (_data: any, callback: Function) => {
    try {
      const invites = await inviteService.list();
      if (typeof callback === 'function') callback({ invites: invites });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ invites: [], error: err.message });
    }
  });

  socket.on('INVITE_DELETE', async (data: any, callback: Function) => {
    try {
      await inviteService.delete(data.inviteId);
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('INVITE_VERIFY', async (data: any, callback: Function) => {
    try {
      const result = await inviteService.verify(data.code);
      if ('error' in result) {
        if (typeof callback === 'function') callback({ error: result.error });
        return;
      }
      if (typeof callback === 'function') callback({ success: true, invite: result.invite });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });
}
