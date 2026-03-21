/**
 * Permission bitmask flags — compatible with the existing system.
 * Each permission is a single bit in a number.
 */
export const Permission = {
  VIEW_CHANNELS:    0x1,
  SEND_MESSAGES:    0x2,
  READ_HISTORY:     0x4,
  ATTACH_FILES:     0x8,
  CONNECT_VOICE:    0x10,
  SPEAK:            0x20,
  ADMINISTRATOR:    0x40,
  MANAGE_CHANNELS:  0x80,
  MANAGE_ROLES:     0x100,
  MANAGE_MESSAGES:  0x200,
  KICK_MEMBERS:     0x400,
  BAN_MEMBERS:      0x800,
  MANAGE_SERVER:    0x1000,
  MANAGE_INVITES:   0x2000,
  MENTION_EVERYONE: 0x4000,
  USE_EMOJIS:       0x8000,
} as const;

/** All permissions combined */
export const ALL_PERMISSIONS = Object.values(Permission).reduce((a, b) => a | b, 0);

/** Default @everyone permissions */
export const DEFAULT_PERMISSIONS = Permission.VIEW_CHANNELS | Permission.SEND_MESSAGES | Permission.READ_HISTORY | Permission.CONNECT_VOICE;

export function hasPermission(perms: number, flag: number): boolean {
  // Admin bypasses all
  if ((perms & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR) return true;
  return (perms & flag) === flag;
}

export function combinePermissions(...perms: number[]): number {
  return perms.reduce((a, b) => a | b, 0);
}

/**
 * Compute effective permissions for a member in a channel.
 * base = union of all role permissions
 * Then apply channel overwrites: deny removes bits, allow adds bits.
 * Admin always gets all.
 */
export function computeChannelPermissions(
  basePermissions: number,
  overwrites: Array<{ allow: number; deny: number }>,
): number {
  if (hasPermission(basePermissions, Permission.ADMINISTRATOR)) return ALL_PERMISSIONS;

  let perms = basePermissions;
  let totalDeny = 0;
  let totalAllow = 0;

  for (const ow of overwrites) {
    totalDeny |= ow.deny;
    totalAllow |= ow.allow;
  }

  perms &= ~totalDeny;
  perms |= totalAllow;

  return perms;
}
