import { getPrisma } from '../config/database';
import { formatInvite } from '../utils/format';
import { v4 as uuid } from 'uuid';
import { randomInt } from 'crypto';

// 12 chars sur 54 caractères = ~71 bits d'entropie, résistant au brute-force.
// randomInt utilise CSPRNG (vs Math.random qui est prédictible).
function generateCode(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[randomInt(chars.length)];
  return out;
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
