import { getPrisma } from '../config/database';
import { formatMember } from '../utils/format';
import { RoleService } from './role.service';
import { v4 as uuid } from 'uuid';

export class MemberService {
  private roleService = new RoleService();

  async list(showBanned = false) {
    const prisma = getPrisma();
    const members = await prisma.member.findMany({
      where: showBanned ? {} : { isBanned: false },
      include: { memberRoles: true },
    });
    return members.map(formatMember);
  }

  async getByUserId(userId: string) {
    const prisma = getPrisma();
    const member = await prisma.member.findUnique({
      where: { userId },
      include: { memberRoles: true },
    });
    return member ? formatMember(member) : null;
  }

  async join(data: { userId: string; username: string; displayName?: string; avatarUrl?: string }) {
    const prisma = getPrisma();
    const existing = await prisma.member.findUnique({ where: { userId: data.userId } });

    if (existing) {
      if (existing.isBanned) throw new Error('USER_BANNED');
      await prisma.member.update({
        where: { userId: data.userId },
        data: { username: data.username, displayName: data.displayName, avatarUrl: data.avatarUrl },
      });
    } else {
      await prisma.member.create({
        data: {
          userId: data.userId,
          username: data.username,
          displayName: data.displayName || null,
          avatarUrl: data.avatarUrl || null,
        },
      });
    }

    // Assign default role
    const defaultRole = await this.roleService.getDefaultRole();
    if (defaultRole) {
      await prisma.memberRole.upsert({
        where: { memberId_roleId: { memberId: data.userId, roleId: defaultRole.id } },
        update: {},
        create: { memberId: data.userId, roleId: defaultRole.id },
      });
    }

    const member = await prisma.member.findUnique({
      where: { userId: data.userId },
      include: { memberRoles: true },
    });
    return member ? formatMember(member) : null;
  }

  async update(userId: string, data: { nickname?: string; roleIds?: string[] }) {
    const prisma = getPrisma();
    const member = await prisma.member.findUnique({ where: { userId } });
    if (!member) return null;

    if (data.nickname !== undefined) {
      await prisma.member.update({ where: { userId }, data: { nickname: data.nickname } });
    }

    if (data.roleIds) {
      await prisma.memberRole.deleteMany({ where: { memberId: userId } });
      for (const roleId of data.roleIds) {
        await prisma.memberRole.create({ data: { memberId: userId, roleId } });
      }
    }

    const updated = await prisma.member.findUnique({
      where: { userId },
      include: { memberRoles: true },
    });
    return updated ? formatMember(updated) : null;
  }

  async kick(userId: string) {
    const prisma = getPrisma();
    await prisma.memberRole.deleteMany({ where: { memberId: userId } });
    await prisma.member.delete({ where: { userId } });
  }

  async ban(userId: string, reason?: string, moderatorId?: string) {
    const prisma = getPrisma();
    await prisma.member.update({
      where: { userId },
      data: { isBanned: true, banReason: reason || null },
    });
    await prisma.ban.create({
      data: {
        id: uuid(),
        userId,
        reason: reason || null,
        moderatorId: moderatorId || null,
      },
    });
  }

  async unban(userId: string) {
    const prisma = getPrisma();
    await prisma.member.update({
      where: { userId },
      data: { isBanned: false, banReason: null },
    });
    await prisma.ban.deleteMany({ where: { userId } });
  }

  async count(excludeBanned = true) {
    const prisma = getPrisma();
    return prisma.member.count({
      where: excludeBanned ? { isBanned: false } : {},
    });
  }
}
