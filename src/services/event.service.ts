import { getPrisma } from '../config/database';
import { v4 as uuid } from 'uuid';

export type EventStatus = 'scheduled' | 'active' | 'ended' | 'canceled';
export type EventType = 'voice' | 'stage' | 'external';
export type EventRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export class EventService {
  async list(status?: EventStatus) {
    const prisma = getPrisma();
    return prisma.serverEvent.findMany({
      where: status ? { status } : undefined,
      orderBy: { startsAt: 'asc' },
      include: { interests: true },
    });
  }

  async getById(id: string) {
    const prisma = getPrisma();
    return prisma.serverEvent.findUnique({
      where: { id },
      include: { interests: true },
    });
  }

  async create(data: {
    creatorId: string;
    title: string;
    description?: string;
    coverUrl?: string;
    channelId?: string;
    location?: string;
    type?: EventType;
    startsAt: Date;
    endsAt?: Date;
    recurrence?: EventRecurrence;
  }) {
    const prisma = getPrisma();
    return prisma.serverEvent.create({
      data: {
        id: uuid(),
        creatorId: data.creatorId,
        title: data.title.trim(),
        description: data.description?.trim() ?? '',
        coverUrl: data.coverUrl ?? null,
        channelId: data.channelId ?? null,
        location: data.location ?? null,
        type: data.type ?? 'voice',
        status: 'scheduled',
        startsAt: data.startsAt,
        endsAt: data.endsAt ?? null,
        recurrence: data.recurrence ?? 'none',
      },
    });
  }

  async update(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      coverUrl: string | null;
      channelId: string | null;
      location: string | null;
      type: EventType;
      status: EventStatus;
      startsAt: Date;
      endsAt: Date | null;
      recurrence: EventRecurrence;
    }>
  ) {
    const prisma = getPrisma();
    const event = await prisma.serverEvent.findUnique({ where: { id } });
    if (!event) return null;
    return prisma.serverEvent.update({ where: { id }, data });
  }

  async delete(id: string) {
    const prisma = getPrisma();
    const event = await prisma.serverEvent.findUnique({ where: { id } });
    if (!event) return null;
    await prisma.serverEvent.delete({ where: { id } });
    return { success: true };
  }

  async setStatus(id: string, status: EventStatus) {
    const prisma = getPrisma();
    return prisma.serverEvent.update({ where: { id }, data: { status } });
  }

  async toggleInterest(eventId: string, userId: string): Promise<boolean> {
    const prisma = getPrisma();
    const existing = await prisma.serverEventInterest.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (existing) {
      await prisma.serverEventInterest.delete({
        where: { eventId_userId: { eventId, userId } },
      });
      await prisma.serverEvent.update({
        where: { id: eventId },
        data: { interestedCount: { decrement: 1 } },
      });
      return false; // removed interest
    }

    await prisma.serverEventInterest.create({ data: { eventId, userId } });
    await prisma.serverEvent.update({
      where: { id: eventId },
      data: { interestedCount: { increment: 1 } },
    });
    return true; // added interest
  }

  async isInterested(eventId: string, userId: string): Promise<boolean> {
    const prisma = getPrisma();
    const entry = await prisma.serverEventInterest.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    return !!entry;
  }
}
