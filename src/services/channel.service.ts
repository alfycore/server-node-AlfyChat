import { getPrisma } from '../config/database';
import { formatChannel } from '../utils/format';
import { v4 as uuid } from 'uuid';

export class ChannelService {
  async list() {
    const prisma = getPrisma();
    const channels = await prisma.channel.findMany({ orderBy: { position: 'asc' } });
    return channels.map(formatChannel);
  }

  async getById(id: string) {
    const prisma = getPrisma();
    return prisma.channel.findUnique({ where: { id } });
  }

  async create(data: { name: string; type?: number; parentId?: string; topic?: string; isNsfw?: boolean }) {
    const prisma = getPrisma();
    const maxPos = await prisma.channel.aggregate({ _max: { position: true } });
    const position = (maxPos._max.position ?? -1) + 1;

    const channel = await prisma.channel.create({
      data: {
        id: uuid(),
        name: data.name,
        type: data.type ?? 0,
        parentId: data.parentId || null,
        topic: data.topic || '',
        position,
        isNsfw: data.isNsfw ?? false,
      },
    });
    return formatChannel(channel);
  }

  async update(channelId: string, data: Partial<{ name: string; topic: string; position: number; parentId: string | null; isNsfw: boolean; slowmode: number }>) {
    const prisma = getPrisma();
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return null;
    const updated = await prisma.channel.update({
      where: { id: channelId },
      data,
    });
    return formatChannel(updated);
  }

  async delete(channelId: string) {
    const prisma = getPrisma();
    await prisma.channel.delete({ where: { id: channelId } });
  }

  async reorder(items: Array<{ id: string; position: number }>) {
    const prisma = getPrisma();
    for (const item of items) {
      await prisma.channel.update({ where: { id: item.id }, data: { position: item.position } });
    }
  }

  async getPermissions(channelId: string) {
    const prisma = getPrisma();
    return prisma.channelPermissionOverwrite.findMany({ where: { channelId } });
  }

  async setPermissions(channelId: string, targetId: string, allow: number, deny: number) {
    const prisma = getPrisma();
    await prisma.channelPermissionOverwrite.upsert({
      where: { channelId_targetId: { channelId, targetId } },
      update: { allow, deny },
      create: { channelId, targetId, allow, deny },
    });
  }

  async ensureDefaults() {
    const prisma = getPrisma();
    const count = await prisma.channel.count();
    if (count > 0) return;
    await prisma.channel.create({
      data: { id: uuid(), name: 'général', type: 0, position: 0 },
    });
    await prisma.channel.create({
      data: { id: uuid(), name: 'annonces', type: 5, position: 1 },
    });
  }
}
