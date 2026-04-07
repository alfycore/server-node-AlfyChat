import type {
  Channel,
  Role,
  Member,
  MemberRole,
  Message,
  Reaction,
  ServerSelfInvite,
} from '@prisma/client';
import { channelTypeToString } from '../enums/ChannelType';

type MemberWithRoles = Member & { memberRoles?: MemberRole[] };
type MessageWithReactions = Message & { reactions?: Reaction[] };

export function formatChannel(ch: Channel) {
  return {
    id: ch.id,
    name: ch.name,
    type: channelTypeToString(ch.type),
    topic: ch.topic || '',
    position: ch.position,
    parentId: ch.parentId || null,
    isNsfw: ch.isNsfw,
    slowmode: ch.slowmode || 0,
    createdAt: ch.createdAt instanceof Date ? ch.createdAt.toISOString() : ch.createdAt,
  };
}

export function formatRole(r: Role) {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    permissions: r.permissions,
    position: r.position,
    isDefault: r.isDefault,
    mentionable: r.mentionable,
    emoji: r.emoji || null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

export function formatMember(m: MemberWithRoles) {
  const roleIds = m.memberRoles ? m.memberRoles.map((mr) => mr.roleId) : [];
  return {
    userId: m.userId,
    username: m.username,
    displayName: m.displayName,
    avatarUrl: m.avatarUrl,
    nickname: m.nickname,
    roleIds,
    joinedAt: m.joinedAt instanceof Date ? m.joinedAt.toISOString() : m.joinedAt,
    isBanned: m.isBanned,
    banReason: m.banReason || null,
  };
}

export function formatMessage(m: MessageWithReactions) {
  let attachments: any[] = [];
  try { attachments = JSON.parse(m.attachments || '[]'); } catch { /* skip */ }

  return {
    id: m.id,
    channelId: m.channelId,
    senderId: m.senderId,
    sender: {
      id: m.senderId,
      username: m.senderUsername,
      displayName: m.senderDisplayName || null,
      avatarUrl: m.senderAvatarUrl || null,
    },
    content: m.content,
    attachments,
    replyToId: m.replyToId || null,
    isEdited: m.isEdited,
    isSystem: m.isSystem,
    isPinned: m.isPinned,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
    updatedAt: m.updatedAt instanceof Date ? m.updatedAt.toISOString() : m.updatedAt,
  };
}

export function formatInvite(inv: ServerSelfInvite) {
  return {
    id: inv.id,
    code: inv.code,
    creatorId: inv.creatorId,
    channelId: inv.channelId || null,
    maxUses: inv.maxUses,
    uses: inv.uses,
    expiresAt: inv.expiresAt,
    isPermanent: !inv.expiresAt,
    createdAt: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : inv.createdAt,
  };
}
