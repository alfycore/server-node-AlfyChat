import { Socket } from 'socket.io-client';
import { ChannelService } from '../../services/channel.service';
import { formatChannel } from '../../utils/format';
import { parseChannelType } from '../../enums/ChannelType';
import { broadcast } from '../broadcast';
import { logger } from '../../utils/logger';

const channelService = new ChannelService();

export function registerChannelHandlers(socket: Socket) {
  socket.on('CHANNEL_LIST', async (_data: any, callback: Function) => {
    try {
      const channels = await channelService.list();
      if (typeof callback === 'function') callback({ channels: channels.map(formatChannel) });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('CHANNEL_CREATE', async (data: any, callback: Function) => {
    try {
      const channel = await channelService.create({
        name: data.name,
        type: parseChannelType(data.type ?? 'text'),
        topic: data.topic,
        parentId: data.parentId,
        isNsfw: data.isNsfw,
      });
      const formatted = channel ? formatChannel(channel) : null;
      broadcast('CHANNEL_CREATE', { channel: formatted });
      if (typeof callback === 'function') callback({ success: true, channel: formatted });
    } catch (err: any) {
      logger.error(`CHANNEL_CREATE: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('CHANNEL_UPDATE', async (data: any, callback: Function) => {
    try {
      const channel = await channelService.update(data.channelId, {
        name: data.name,
        topic: data.topic,
        position: data.position,
        type: data.type,
      });
      const formatted = channel ? formatChannel(channel) : null;
      broadcast('CHANNEL_UPDATE', { channel: formatted });
      if (typeof callback === 'function') callback({ success: true, channel: formatted });
    } catch (err: any) {
      logger.error(`CHANNEL_UPDATE: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('CHANNEL_DELETE', async (data: any, callback: Function) => {
    try {
      await channelService.delete(data.channelId);
      broadcast('CHANNEL_DELETE', { channelId: data.channelId });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      logger.error(`CHANNEL_DELETE: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // ── Channel Permissions ──
  socket.on('CHANNEL_PERMS_GET', async (data: any, callback: Function) => {
    try {
      const perms = await channelService.getPermissions(data.channelId);
      const formatted = perms.map((p) => ({
        channelId: p.channelId,
        roleId: p.targetId,
        targetType: p.targetType,
        allow: p.allow,
        deny: p.deny,
      }));
      if (typeof callback === 'function') callback({ permissions: formatted });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('CHANNEL_PERMS_SET', async (data: any, callback: Function) => {
    try {
      await channelService.setPermissions(data.channelId, data.roleId, data.allow || 0, data.deny || 0);
      broadcast('CHANNEL_PERMS_UPDATE', {
        channelId: data.channelId,
        roleId: data.roleId,
        allow: data.allow || 0,
        deny: data.deny || 0,
      });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });
}
