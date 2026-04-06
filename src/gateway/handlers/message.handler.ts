import { Socket } from 'socket.io-client';
import { MessageService } from '../../services/message.service';
import { PermissionService } from '../../services/permission.service';
import { Permission } from '../../enums/Permission';
import { formatMessage } from '../../utils/format';
import { broadcast } from '../broadcast';
import { logger } from '../../utils/logger';

const messageService = new MessageService();
const permissionService = new PermissionService();

export function registerMessageHandlers(socket: Socket) {
  // ── Receive message from gateway, store, broadcast ──
  socket.on('MSG_FORWARD', async (data: any, callback: Function) => {
    try {
      // ── Permission check: SEND_MESSAGES in this channel ──
      if (data.senderId && data.channelId) {
        const allowed = await permissionService.hasChannelPermission(
          data.senderId,
          data.channelId,
          Permission.SEND_MESSAGES,
        );
        if (!allowed) {
          if (typeof callback === 'function') callback({ error: 'PERMISSION_DENIED' });
          return;
        }
      }

      const result = await messageService.create({
        channelId: data.channelId,
        serverId: data.serverId,
        senderId: data.senderId,
        senderUsername: data.sender?.username || data.senderUsername || data.senderId,
        senderDisplayName: data.sender?.displayName || data.senderDisplayName,
        senderAvatarUrl: data.sender?.avatarUrl || data.senderAvatarUrl,
        content: data.content,
        attachments: data.attachments,
        replyToId: data.replyToId,
        isSystem: data.isSystem,
      });

      if (result && 'error' in result) {
        if (typeof callback === 'function') callback({ error: result.error });
        return;
      }

      const message = result!;
      broadcast('MSG_BROADCAST', { channelId: data.channelId, message });
      if (typeof callback === 'function') callback({ success: true, message });
    } catch (err: any) {
      logger.error(`MSG_FORWARD: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // ── Message history ──
  socket.on('MSG_HISTORY', async (data: any, callback: Function) => {
    try {
      // ── Permission check: VIEW_CHANNELS + READ_HISTORY ──
      if (data.userId && data.channelId) {
        const allowed = await permissionService.hasChannelPermission(
          data.userId,
          data.channelId,
          Permission.VIEW_CHANNELS,
        );
        if (!allowed) {
          if (typeof callback === 'function') callback({ messages: [] });
          return;
        }
      }

      const messages = await messageService.getHistory(
        data.channelId,
        data.before,
        data.limit || 50,
      );
      if (typeof callback === 'function') {
        callback({ messages: messages });
      }
    } catch (err: any) {
      logger.error(`MSG_HISTORY: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // ── Edit message ──
  socket.on('MSG_EDIT', async (data: any, callback: Function) => {
    try {
      const result = await messageService.edit(data.messageId, data.content, data.userId);
      if ('error' in result) {
        if (typeof callback === 'function') callback({ error: result.error });
        return;
      }
      broadcast('MSG_EDIT', { messageId: data.messageId, content: data.content, channelId: data.channelId });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      logger.error(`MSG_EDIT: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // ── Delete message ──
  socket.on('MSG_DELETE', async (data: any, callback: Function) => {
    try {
      // ── Permission check: owner can always delete own; others need MANAGE_MESSAGES ──
      if (data.userId && data.channelId) {
        const msg = await messageService.getById(data.messageId);
        if (msg && msg.senderId !== data.userId) {
          const allowed = await permissionService.hasChannelPermission(
            data.userId,
            data.channelId,
            Permission.MANAGE_MESSAGES,
          );
          if (!allowed) {
            if (typeof callback === 'function') callback({ error: 'PERMISSION_DENIED' });
            return;
          }
        }
      }

      await messageService.delete(data.messageId);
      broadcast('MSG_DELETE', { messageId: data.messageId, channelId: data.channelId });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      logger.error(`MSG_DELETE: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });
}
