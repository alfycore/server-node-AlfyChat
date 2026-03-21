import { getPrisma } from '../config/database';
import { v4 as uuid } from 'uuid';

export class AuditService {
  async log(actorId: string, actionType: string, targetId?: string, targetType?: string, changes?: Record<string, any>, reason?: string) {
    const prisma = getPrisma();
    await prisma.auditLog.create({
      data: {
        id: uuid(),
        actorId,
        actionType,
        targetId: targetId || null,
        targetType: targetType || null,
        changes: changes ? JSON.stringify(changes) : null,
        reason: reason || null,
      },
    });
  }

  async list(limit = 50) {
    const prisma = getPrisma();
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
