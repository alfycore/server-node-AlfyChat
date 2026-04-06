import { Socket } from 'socket.io-client';
import { RoleService } from '../../services/role.service';
import { PermissionService } from '../../services/permission.service';
import { Permission } from '../../enums/Permission';
import { formatRole } from '../../utils/format';
import { broadcast } from '../broadcast';
import { logger } from '../../utils/logger';

const roleService = new RoleService();
const permissionService = new PermissionService();

/** Helper: check MANAGE_ROLES or ADMIN */
async function requireManageRoles(userId: string | undefined, callback: Function): Promise<boolean> {
  if (!userId) return true; // no userId means gateway already checked
  const base = await permissionService.computeMemberPermissions(userId);
  if ((base & Permission.ADMINISTRATOR) || (base & Permission.MANAGE_ROLES)) return true;
  if (typeof callback === 'function') callback({ error: 'PERMISSION_DENIED' });
  return false;
}

export function registerRoleHandlers(socket: Socket) {
  socket.on('ROLE_LIST', async (_data: any, callback: Function) => {
    try {
      const roles = await roleService.list();
      if (typeof callback === 'function') callback({ roles: roles });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('ROLE_CREATE', async (data: any, callback: Function) => {
    try {
      if (!(await requireManageRoles(data.userId, callback))) return;

      const role = await roleService.create({
        name: data.name,
        color: data.color,
        permissions: data.permissions,
        emoji: data.emoji,
      });
      const formatted = role ?? null;
      broadcast('ROLE_CREATE', { role: formatted });
      if (typeof callback === 'function') callback({ success: true, role: formatted });
    } catch (err: any) {
      logger.error(`ROLE_CREATE: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('ROLE_UPDATE', async (data: any, callback: Function) => {
    try {
      if (!(await requireManageRoles(data.userId, callback))) return;

      const role = await roleService.update(data.roleId, {
        name: data.name,
        color: data.color,
        permissions: data.permissions,
        position: data.position,
        mentionable: data.mentionable,
        emoji: data.emoji,
      });
      const formatted = role ?? null;
      broadcast('ROLE_UPDATE', { role: formatted });
      if (typeof callback === 'function') callback({ success: true, role: formatted });
    } catch (err: any) {
      logger.error(`ROLE_UPDATE: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('ROLE_DELETE', async (data: any, callback: Function) => {
    try {
      if (!(await requireManageRoles(data.userId, callback))) return;

      await roleService.delete(data.roleId);
      broadcast('ROLE_DELETE', { roleId: data.roleId });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      logger.error(`ROLE_DELETE: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });
}
