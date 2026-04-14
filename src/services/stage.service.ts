import { getPrisma } from '../config/database';

export class StageService {
  async get(channelId: string) {
    const prisma = getPrisma();
    return prisma.stageState.findUnique({ where: { channelId } });
  }

  async getOrCreate(channelId: string) {
    const prisma = getPrisma();
    const existing = await prisma.stageState.findUnique({ where: { channelId } });
    if (existing) return this.parseState(existing);

    const created = await prisma.stageState.create({
      data: { channelId, topic: '', isLive: false, speakerIds: '[]', listenerIds: '[]' },
    });
    return this.parseState(created);
  }

  async start(channelId: string, startedBy: string, topic = '') {
    const prisma = getPrisma();
    const state = await prisma.stageState.upsert({
      where: { channelId },
      create: {
        channelId,
        topic,
        isLive: true,
        speakerIds: JSON.stringify([startedBy]),
        listenerIds: '[]',
        startedAt: new Date(),
        startedBy,
      },
      update: {
        topic,
        isLive: true,
        speakerIds: JSON.stringify([startedBy]),
        listenerIds: '[]',
        startedAt: new Date(),
        startedBy,
      },
    });
    return this.parseState(state);
  }

  async end(channelId: string) {
    const prisma = getPrisma();
    const state = await prisma.stageState.update({
      where: { channelId },
      data: {
        isLive: false,
        speakerIds: '[]',
        listenerIds: '[]',
        startedAt: null,
        startedBy: null,
      },
    });
    return this.parseState(state);
  }

  async updateTopic(channelId: string, topic: string) {
    const prisma = getPrisma();
    const state = await prisma.stageState.upsert({
      where: { channelId },
      create: { channelId, topic, isLive: false, speakerIds: '[]', listenerIds: '[]' },
      update: { topic },
    });
    return this.parseState(state);
  }

  async addSpeaker(channelId: string, userId: string) {
    const prisma = getPrisma();
    const state = await this.getOrCreate(channelId);
    if (state.speakerIds.includes(userId)) return state;

    const speakers = [...state.speakerIds, userId];
    const listeners = state.listenerIds.filter((id) => id !== userId);
    const updated = await prisma.stageState.update({
      where: { channelId },
      data: {
        speakerIds: JSON.stringify(speakers),
        listenerIds: JSON.stringify(listeners),
      },
    });
    return this.parseState(updated);
  }

  async removeSpeaker(channelId: string, userId: string) {
    const prisma = getPrisma();
    const state = await this.getOrCreate(channelId);
    const speakers = state.speakerIds.filter((id) => id !== userId);
    const listeners = [...state.listenerIds, userId];
    const updated = await prisma.stageState.update({
      where: { channelId },
      data: {
        speakerIds: JSON.stringify(speakers),
        listenerIds: JSON.stringify(listeners),
      },
    });
    return this.parseState(updated);
  }

  async joinAsListener(channelId: string, userId: string) {
    const prisma = getPrisma();
    const state = await this.getOrCreate(channelId);
    if (state.listenerIds.includes(userId) || state.speakerIds.includes(userId)) return state;

    const listeners = [...state.listenerIds, userId];
    const updated = await prisma.stageState.update({
      where: { channelId },
      data: { listenerIds: JSON.stringify(listeners) },
    });
    return this.parseState(updated);
  }

  async leave(channelId: string, userId: string) {
    const prisma = getPrisma();
    const state = await this.getOrCreate(channelId);
    const speakers = state.speakerIds.filter((id) => id !== userId);
    const listeners = state.listenerIds.filter((id) => id !== userId);
    const updated = await prisma.stageState.update({
      where: { channelId },
      data: {
        speakerIds: JSON.stringify(speakers),
        listenerIds: JSON.stringify(listeners),
      },
    });
    return this.parseState(updated);
  }

  private parseState(state: {
    channelId: string;
    topic: string;
    isLive: boolean;
    speakerIds: string;
    listenerIds: string;
    startedAt: Date | null;
    startedBy: string | null;
  }) {
    return {
      ...state,
      speakerIds: (() => { try { return JSON.parse(state.speakerIds) as string[]; } catch { return []; } })(),
      listenerIds: (() => { try { return JSON.parse(state.listenerIds) as string[]; } catch { return []; } })(),
    };
  }
}
