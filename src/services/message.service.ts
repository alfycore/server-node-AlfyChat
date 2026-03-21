import { getPrisma } from '../config/database';
import { formatMessage } from '../utils/format';
import { v4 as uuid } from 'uuid';

export class MessageService {
  async getHistory(channelId: string, before?: string, limit = 50) {
    const prisma = getPrisma();
    const messages = await prisma.message.findMany({
      where: {
        channelId,
        isDeleted: false,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { reactions: true },
    });
    return messages.reverse().map(formatMessage);
  }

  async create(data: {
    channelId: string;
    serverId?: string;
    senderId: string;
    senderUsername: string;
    senderDisplayName?: string;
    senderAvatarUrl?: string;
    content: string;
    attachments?: any[];
    replyToId?: string;
    isSystem?: boolean;
  }) {
    const prisma = getPrisma();
    const channel = await prisma.channel.findUnique({ where: { id: data.channelId } });
    if (!channel) throw new Error('CHANNEL_NOT_FOUND');

    const message = await prisma.message.create({
      data: {
        id: uuid(),
        channelId: data.channelId,
        serverId: data.serverId || '',
        senderId: data.senderId,
        senderUsername: data.senderUsername,
        senderDisplayName: data.senderDisplayName || null,
        senderAvatarUrl: data.senderAvatarUrl || null,
        content: data.content,
        attachments: JSON.stringify(data.attachments || []),
        replyToId: data.replyToId || null,
        isSystem: data.isSystem || false,
      },
      include: { reactions: true },
    });
    return formatMessage(message);
  }

  async edit(messageId: string, content: string, userId: string) {
    const prisma = getPrisma();
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new Error('MESSAGE_NOT_FOUND');
    if (message.senderId !== userId) throw new Error('NOT_AUTHOR');

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content, isEdited: true },
      include: { reactions: true },
    });
    return formatMessage(updated);
  }

  async delete(messageId: string) {
    const prisma = getPrisma();
    await prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true },
    });
  }

  async pin(messageId: string) {
    const prisma = getPrisma();
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new Error('MESSAGE_NOT_FOUND');
    await prisma.message.update({
      where: { id: messageId },
      data: { isPinned: !message.isPinned },
    });
  }
}
