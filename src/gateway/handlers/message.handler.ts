import { Socket } from 'socket.io-client';
import { MessageService } from '../../services/message.service';
import { formatMessage } from '../../utils/format';
import { broadcast } from '../broadcast';
import { logger } from '../../utils/logger';

const messageService = new MessageService();

export function registerMessageHandlers(socket: Socket) {
  // ── Receive message from gateway, store, broadcast ──
  socket.on('MSG_FORWARD', async (data: any, callback: Function) => {
    try {
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

      const message = formatMessage(result!);
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
      const messages = await messageService.getHistory(
        data.channelId,
        data.before,
        data.limit || 50,
      );
      if (typeof callback === 'function') {
        callback({ messages: messages.map(formatMessage) });
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
      const result = await messageService.delete(data.messageId);
      if ('error' in result) {
        if (typeof callback === 'function') callback({ error: result.error });
        return;
      }
      broadcast('MSG_DELETE', { messageId: data.messageId, channelId: data.channelId });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      logger.error(`MSG_DELETE: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });
}
