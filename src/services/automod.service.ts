import { getPrisma } from '../config/database';
import { v4 as uuid } from 'uuid';

export type AutomodTrigger = 'keyword' | 'spam' | 'mention_spam' | 'link' | 'invite';
export type AutomodAction = 'block' | 'alert' | 'timeout' | 'delete';

export interface AutomodRuleData {
  name: string;
  triggerType: AutomodTrigger;
  triggerMetadata?: Record<string, unknown>;
  actionType: AutomodAction;
  actionMetadata?: Record<string, unknown>;
}

export class AutomodService {
  async list() {
    const prisma = getPrisma();
    const rules = await prisma.automodRule.findMany({ orderBy: { createdAt: 'asc' } });
    return rules.map(this.parseRule);
  }

  async getById(id: string) {
    const prisma = getPrisma();
    const rule = await prisma.automodRule.findUnique({ where: { id } });
    return rule ? this.parseRule(rule) : null;
  }

  async create(createdBy: string, data: AutomodRuleData) {
    const prisma = getPrisma();
    const rule = await prisma.automodRule.create({
      data: {
        id: uuid(),
        name: data.name.trim(),
        triggerType: data.triggerType,
        triggerMetadata: JSON.stringify(data.triggerMetadata ?? {}),
        actionType: data.actionType,
        actionMetadata: JSON.stringify(data.actionMetadata ?? {}),
        createdBy,
      },
    });
    return this.parseRule(rule);
  }

  async update(
    id: string,
    data: Partial<AutomodRuleData & { enabled: boolean }>
  ) {
    const prisma = getPrisma();
    const rule = await prisma.automodRule.findUnique({ where: { id } });
    if (!rule) return null;

    const updated = await prisma.automodRule.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.triggerType !== undefined && { triggerType: data.triggerType }),
        ...(data.triggerMetadata !== undefined && {
          triggerMetadata: JSON.stringify(data.triggerMetadata),
        }),
        ...(data.actionType !== undefined && { actionType: data.actionType }),
        ...(data.actionMetadata !== undefined && {
          actionMetadata: JSON.stringify(data.actionMetadata),
        }),
      },
    });
    return this.parseRule(updated);
  }

  async delete(id: string) {
    const prisma = getPrisma();
    const rule = await prisma.automodRule.findUnique({ where: { id } });
    if (!rule) return null;
    await prisma.automodRule.delete({ where: { id } });
    return { success: true };
  }

  async toggle(id: string, enabled: boolean) {
    const prisma = getPrisma();
    const rule = await prisma.automodRule.update({ where: { id }, data: { enabled } });
    return this.parseRule(rule);
  }

  /**
   * Check a message content against all enabled rules.
   * Returns the first matching rule action, or null if no match.
   */
  async checkContent(content: string, authorId: string): Promise<{ action: AutomodAction; ruleId: string; ruleName: string } | null> {
    const prisma = getPrisma();
    const rules = await prisma.automodRule.findMany({ where: { enabled: true } });

    for (const rule of rules) {
      let meta: Record<string, unknown> = {};
      try {
        meta = JSON.parse(rule.triggerMetadata);
      } catch { /* ignore */ }

      if (rule.triggerType === 'keyword') {
        const keywords: string[] = Array.isArray(meta.keywords) ? (meta.keywords as string[]) : [];
        const lower = content.toLowerCase();
        if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
          return { action: rule.actionType as AutomodAction, ruleId: rule.id, ruleName: rule.name };
        }
      }

      if (rule.triggerType === 'invite') {
        if (/discord\.gg\/|discord\.com\/invite\//i.test(content)) {
          return { action: rule.actionType as AutomodAction, ruleId: rule.id, ruleName: rule.name };
        }
      }

      if (rule.triggerType === 'link') {
        if (/https?:\/\//i.test(content)) {
          return { action: rule.actionType as AutomodAction, ruleId: rule.id, ruleName: rule.name };
        }
      }

      if (rule.triggerType === 'mention_spam') {
        const threshold = typeof meta.threshold === 'number' ? meta.threshold : 5;
        const mentions = (content.match(/<@!?\d+>/g) ?? []).length;
        if (mentions >= threshold) {
          return { action: rule.actionType as AutomodAction, ruleId: rule.id, ruleName: rule.name };
        }
      }
    }

    return null;
  }

  private parseRule(rule: {
    id: string;
    name: string;
    enabled: boolean;
    triggerType: string;
    triggerMetadata: string;
    actionType: string;
    actionMetadata: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...rule,
      triggerMetadata: (() => {
        try { return JSON.parse(rule.triggerMetadata); } catch { return {}; }
      })(),
      actionMetadata: (() => {
        try { return JSON.parse(rule.actionMetadata); } catch { return {}; }
      })(),
    };
  }
}
