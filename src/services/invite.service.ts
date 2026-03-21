import { getPrisma } from '../config/database';
import { formatInvite } from '../utils/format';
import { v4 as uuid } from 'uuid';

function generateCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export class InviteService {
  async list() {
    const prisma = getPrisma();
    const invites = await prisma.serverSelfInvite.findMany({ orderBy: { createdAt: 'desc' } });
    return invites.map(formatInvite);
  }

  async create(data: {
    serverId: string;
    creatorId: string;
    customSlug?: string;
    maxUses?: number;
    isPermanent?: boolean;
    expiresIn?: number;
  }) {
    const prisma = getPrisma();
    const code = data.customSlug || generateCode();
    const expiresAt = data.isPermanent || !data.expiresIn
      ? null
      : new Date(Date.now() + data.expiresIn * 1000).toISOString();

    const invite = await prisma.serverSelfInvite.create({
      data: {
        id: uuid(),
        code,
        serverId: data.serverId,
        creatorId: data.creatorId,
        maxUses: data.maxUses || null,
        expiresAt,
      },
    });
    return formatInvite(invite);
  }

  async verify(code: string) {
    const prisma = getPrisma();
    const invite = await prisma.serverSelfInvite.findUnique({ where: { code } });
    if (!invite) return { valid: false, reason: 'NOT_FOUND' };
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return { valid: false, reason: 'EXPIRED' };
    if (invite.maxUses && invite.uses >= invite.maxUses) return { valid: false, reason: 'MAX_USES' };

    await prisma.serverSelfInvite.update({
      where: { code },
      data: { uses: invite.uses + 1 },
    });
    return { valid: true, invite: formatInvite(invite) };
  }

  async getByCode(code: string) {
    const prisma = getPrisma();
    const invite = await prisma.serverSelfInvite.findUnique({ where: { code } });
    return invite ? formatInvite(invite) : null;
  }

  async delete(id: string) {
    const prisma = getPrisma();
    await prisma.serverSelfInvite.delete({ where: { id } });
  }
}
