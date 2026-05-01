import { Socket } from 'socket.io-client';
import { MemberService } from '../../services/member.service';
import { PermissionService } from '../../services/permission.service';
import { Permission } from '../../enums/Permission';
import { formatMember } from '../../utils/format';
import { broadcast } from '../broadcast';
import { logger } from '../../utils/logger';

const memberService = new MemberService();
const permissionService = new PermissionService();

export function registerMemberHandlers(socket: Socket) {
  socket.on('MEMBER_LIST', async (_data: any, callback: Function) => {
    try {
      const members = await memberService.list();
      if (typeof callback === 'function') callback({ members: members });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('MEMBER_JOIN', async (data: any, callback: Function) => {
    try {
      const result = await memberService.join({
        userId: data.userId,
        username: data.username,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
      });
      if (result && 'error' in result) {
        if (typeof callback === 'function') callback(result);
        return;
      }
      const formatted = result ?? null;
      broadcast('MEMBER_JOIN', { member: formatted });
      if (typeof callback === 'function') callback({ success: true, member: formatted });
    } catch (err: any) {
      logger.error(`MEMBER_JOIN: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('MEMBER_UPDATE', async (data: any, callback: Function) => {
    try {
      const member = await memberService.update(data.userId, {
        nickname: data.nickname,
        roleIds: data.roleIds,
      });
      const formatted = member ?? null;
      broadcast('MEMBER_UPDATE', { member: formatted });
      if (typeof callback === 'function') callback({ success: true, member: formatted });
    } catch (err: any) {
      logger.error(`MEMBER_UPDATE: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('MEMBER_KICK', async (data: any, callback: Function) => {
    try {
      // Permission check: KICK_MEMBERS
      // - selfLeave: l'utilisateur se retire lui-même (actorId === userId)
      // - systemCleanup: nettoyage automatique du gateway (membres orphelins)
      // - sinon: actorId OBLIGATOIRE avec permission KICK
      if (!data.selfLeave && !data.systemCleanup) {
        if (!data.actorId) {
          if (typeof callback === 'function') callback({ error: 'ACTOR_REQUIRED' });
          return;
        }
        const base = await permissionService.computeMemberPermissions(data.actorId);
        if (!(base & Permission.ADMINISTRATOR) && !(base & Permission.KICK_MEMBERS)) {
          if (typeof callback === 'function') callback({ error: 'PERMISSION_DENIED' });
          return;
        }
      } else if (data.selfLeave && data.actorId !== data.userId) {
        if (typeof callback === 'function') callback({ error: 'SELF_LEAVE_MISMATCH' });
        return;
      }

      await memberService.kick(data.userId);
      broadcast('MEMBER_KICK', { userId: data.userId });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      logger.error(`MEMBER_KICK: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('MEMBER_BAN', async (data: any, callback: Function) => {
    try {
      // Permission check: BAN_MEMBERS — actorId est OBLIGATOIRE
      if (!data.actorId) {
        if (typeof callback === 'function') callback({ error: 'ACTOR_REQUIRED' });
        return;
      }
      const base = await permissionService.computeMemberPermissions(data.actorId);
      if (!(base & Permission.ADMINISTRATOR) && !(base & Permission.BAN_MEMBERS)) {
        if (typeof callback === 'function') callback({ error: 'PERMISSION_DENIED' });
        return;
      }

      await memberService.ban(data.userId, data.reason);
      broadcast('MEMBER_BAN', { userId: data.userId });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      logger.error(`MEMBER_BAN: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('MEMBER_UNBAN', async (data: any, callback: Function) => {
    try {
      await memberService.unban(data.userId);
      if (typeof callback === 'function') callback({ success: true });
    } catch (err: any) {
      logger.error(`MEMBER_UNBAN: ${err.message}`);
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('MEMBER_CHECK', async (data: any, callback: Function) => {
    try {
      const member = await memberService.getByUserId(data.userId);
      const isMember = !!member && !member.isBanned;
      if (typeof callback === 'function') callback({ isMember });
    } catch (err: any) {
      if (typeof callback === 'function') callback({ isMember: false });
    }
  });
}
