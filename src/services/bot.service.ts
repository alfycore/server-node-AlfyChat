import { getPrisma } from '../config/database';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';

export class BotService {
  async register(name: string, ownerId: string) {
    const prisma = getPrisma();
    const rawToken = uuid() + '-' + uuid();
    const hashedToken = await bcrypt.hash(rawToken, 10);

    const bot = await prisma.bot.create({
      data: {
        id: uuid(),
        name,
        token: hashedToken,
        ownerId,
      },
    });

    return { id: bot.id, name: bot.name, token: rawToken };
  }

  async authenticate(botId: string, rawToken: string) {
    const prisma = getPrisma();
    const bot = await prisma.bot.findFirst({ where: { id: botId, isActive: true } });
    if (!bot) return null;
    const valid = await bcrypt.compare(rawToken, bot.token);
    return valid ? bot : null;
  }

  async list() {
    const prisma = getPrisma();
    return prisma.bot.findMany({
      select: { id: true, name: true, avatarUrl: true, ownerId: true, permissions: true, isActive: true, createdAt: true },
    });
  }

  async delete(id: string) {
    const prisma = getPrisma();
    await prisma.bot.delete({ where: { id } });
  }
}
