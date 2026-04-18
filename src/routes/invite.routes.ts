import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { InviteService } from '../services/invite.service';
import { PermissionService } from '../services/permission.service';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const inviteService = new InviteService();
const permissionService = new PermissionService();

// MANAGE_ROLES (0x100) ou ADMIN (0x40) requis pour gérer les invitations
async function canManageInvites(userId: string): Promise<boolean> {
  const perms = await permissionService.computeMemberPermissions(userId);
  return (perms & 0x40) !== 0 || (perms & 0x100) !== 0;
}

const inviteCreationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop d'invitations créées, réessayez dans une minute." },
});

// GET / — liste des invitations (admin/manager uniquement)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await canManageInvites(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const invites = await inviteService.list();
    res.json(invites);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST / — créer une invitation
router.post('/', inviteCreationLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const creatorId = req.user?.userId;
    if (!creatorId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await canManageInvites(creatorId))) return res.status(403).json({ error: 'Accès refusé' });

    const invite = await inviteService.create({
      serverId: process.env.SERVER_ID || '',
      creatorId,
      maxUses: req.body.maxUses,
      expiresIn: req.body.expiresIn,
    });
    res.status(201).json(invite);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /:code — Verify invite (public, utilisé pour preview avant join)
router.get('/:code', async (req: AuthRequest, res: Response) => {
  try {
    const invite = await inviteService.getByCode(req.params.code);
    if (!invite) return res.status(404).json({ error: 'Invitation introuvable' });

    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Invitation expirée' });
    }
    if (invite.maxUses && invite.uses >= invite.maxUses) {
      return res.status(410).json({ error: 'Invitation épuisée' });
    }

    res.json(invite);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /:code/use — consommer une invitation
router.post('/:code/use', async (req: AuthRequest, res: Response) => {
  try {
    const result = await inviteService.verify(req.params.code);
    if ('error' in result) return res.status(410).json(result);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /:inviteId — supprimer une invitation
router.delete('/:inviteId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await canManageInvites(userId))) return res.status(403).json({ error: 'Accès refusé' });

    await inviteService.delete(req.params.inviteId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
