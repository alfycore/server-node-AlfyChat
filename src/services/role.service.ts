import { getPrisma } from '../config/database';
import { formatRole } from '../utils/format';
import { v4 as uuid } from 'uuid';

const DEFAULT_PERMISSIONS = 0x1 | 0x2 | 0x4; // READ | SEND | REACT

export class RoleService {
  async list() {
    const prisma = getPrisma();
    const roles = await prisma.role.findMany({ orderBy: { position: 'desc' } });
    return roles.map(formatRole);
  }

  async getById(id: string) {
    const prisma = getPrisma();
    return prisma.role.findUnique({ where: { id } });
  }

  async create(data: { name: string; color?: string; permissions?: number; emoji?: string }) {
    const prisma = getPrisma();
    const maxPos = await prisma.role.aggregate({ _max: { position: true } });
    const position = (maxPos._max.position ?? 0) + 1;

    const role = await prisma.role.create({
      data: {
        id: uuid(),
        name: data.name,
        color: data.color || '#99AAB5',
        permissions: data.permissions ?? DEFAULT_PERMISSIONS,
        emoji: data.emoji || null,
        position,
      },
    });
    return formatRole(role);
  }

  async update(roleId: string, data: Partial<{ name: string; color: string; permissions: number; position: number; mentionable: boolean; emoji: string; iconEmoji: string }>) {
    const prisma = getPrisma();
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return null;

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.permissions !== undefined) updateData.permissions = data.permissions;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.mentionable !== undefined) updateData.mentionable = data.mentionable;
    if (data.emoji !== undefined) updateData.emoji = data.emoji;
    if (data.iconEmoji !== undefined) updateData.emoji = data.iconEmoji;

    const updated = await prisma.role.update({ where: { id: roleId }, data: updateData });
    return formatRole(updated);
  }

  async delete(roleId: string) {
    const prisma = getPrisma();
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role || role.isDefault) return;
    // Cascade is handled by Prisma relations, but let's be explicit
    await prisma.memberRole.deleteMany({ where: { roleId } });
    await prisma.role.delete({ where: { id: roleId } });
  }

  async reorder(items: Array<{ id: string; position: number }>) {
    const prisma = getPrisma();
    for (const item of items) {
      await prisma.role.update({ where: { id: item.id }, data: { position: item.position } });
    }
  }

  async getDefaultRole() {
    const prisma = getPrisma();
    return prisma.role.findFirst({ where: { isDefault: true } });
  }

  async ensureDefaults() {
    const prisma = getPrisma();
    const existing = await prisma.role.findFirst({ where: { isDefault: true } });
    if (existing) return;
    await prisma.role.create({
      data: {
        id: uuid(),
        name: 'Membre',
        color: '#99AAB5',
        permissions: DEFAULT_PERMISSIONS,
        position: 0,
        isDefault: true,
      },
    });
  }
}
