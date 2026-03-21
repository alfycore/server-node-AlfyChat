import { getPrisma } from '../config/database';

const ALL_PERMISSIONS = 0xFFFF;

export class PermissionService {
  async computeMemberPermissions(userId: string): Promise<number> {
    const prisma = getPrisma();
    const server = await prisma.serverSelf.findFirst();
    if (server && server.ownerId === userId) return ALL_PERMISSIONS;

    const memberRoles = await prisma.memberRole.findMany({
      where: { memberId: userId },
      include: { role: true },
    });

    let permissions = 0;
    for (const mr of memberRoles) {
      permissions |= mr.role.permissions;
    }
    return permissions;
  }

  async computeChannelPermissions(userId: string, channelId: string): Promise<number> {
    let base = await this.computeMemberPermissions(userId);
    if ((base & 0x40) !== 0) return ALL_PERMISSIONS; // ADMIN

    const prisma = getPrisma();
    const memberRoles = await prisma.memberRole.findMany({
      where: { memberId: userId },
    });
    const roleIds = new Set(memberRoles.map((mr) => mr.roleId));

    const overwrites = await prisma.channelPermissionOverwrite.findMany({
      where: { channelId },
    });

    for (const ow of overwrites) {
      if (ow.targetType === 'role' && roleIds.has(ow.targetId)) {
        base &= ~ow.deny;
        base |= ow.allow;
      }
    }

    // Member-specific overwrites
    for (const ow of overwrites) {
      if (ow.targetType === 'member' && ow.targetId === userId) {
        base &= ~ow.deny;
        base |= ow.allow;
      }
    }

    return base;
  }

  async hasChannelPermission(userId: string, channelId: string, flag: number): Promise<boolean> {
    const perms = await this.computeChannelPermissions(userId, channelId);
    return (perms & flag) !== 0;
  }
}
