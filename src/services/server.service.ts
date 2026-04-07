import { getPrisma } from '../config/database';
import { formatChannel, formatRole, formatMember } from '../utils/format';

export class ServerService {
  async getServerInfo() {
    const prisma = getPrisma();
    const server = await prisma.serverSelf.findFirst();
    if (!server) return null;
    return {
      id: server.id,
      name: server.name,
      description: server.description,
      iconUrl: server.iconUrl,
      bannerUrl: server.bannerUrl,
      ownerId: server.ownerId,
      isPublic: server.isPublic,
      verificationLevel: server.verificationLevel,
      isVerified: server.isVerified,
      isPartner: server.isPartner,
    };
  }

  async updateServerInfo(data: Partial<{
    name: string;
    description: string;
    iconUrl: string;
    bannerUrl: string;
    ownerId: string;
    isPublic: boolean;
    verificationLevel: number;
  }>) {
    const prisma = getPrisma();
    const server = await prisma.serverSelf.findFirst();
    if (!server) return null;
    return prisma.serverSelf.update({
      where: { id: server.id },
      data,
    });
  }

  async getFullServerData() {
    const prisma = getPrisma();
    const channels = await prisma.channel.findMany({ orderBy: { position: 'asc' } });
    const roles = await prisma.role.findMany({ orderBy: { position: 'desc' } });
    const members = await prisma.member.findMany({
      where: { isBanned: false },
      include: { memberRoles: true },
    });
    return {
      channels: channels.map(formatChannel),
      roles: roles.map(formatRole),
      members: members.map(formatMember),
    };
  }

  async ensureServerExists(id: string, name?: string) {
    const prisma = getPrisma();
    const existing = await prisma.serverSelf.findFirst();
    if (existing) return existing;
    return prisma.serverSelf.create({
      data: {
        id,
        name: name || 'Mon Serveur',
      },
    });
  }
}
