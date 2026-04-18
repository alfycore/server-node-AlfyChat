import { Router, Response } from 'express';
import { MemberService } from '../services/member.service';
import { PermissionService } from '../services/permission.service';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const memberService = new MemberService();
const permissionService = new PermissionService();

// Permission helpers (KICK=0x10, BAN=0x20, ADMIN=0x40)
async function hasPerm(userId: string, perm: number): Promise<boolean> {
  const perms = await permissionService.computeMemberPermissions(userId);
  return (perms & 0x40) !== 0 || (perms & perm) !== 0;
}

// GET /
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const showBanned = req.query.showBanned === 'true';
    const members = await memberService.list(showBanned);
    res.json(members);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /:userId
router.get('/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const member = await memberService.getByUserId(req.params.userId);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });
    res.json(member);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST / — Join : l'utilisateur s'inscrit lui-même, on force l'identité authentifiée
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { username, displayName, avatarUrl } = req.body;
    if (!username) return res.status(400).json({ error: 'username requis' });

    const result = await memberService.join({ userId, username, displayName, avatarUrl });
    if (result && 'error' in result) {
      return res.status(403).json(result);
    }
    res.status(201).json(result ?? null);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /:userId — modifier un membre (soi-même ou admin)
router.patch('/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const isSelf = userId === req.params.userId;
    if (!isSelf && !(await hasPerm(userId, 0x40))) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const member = await memberService.update(req.params.userId, req.body);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });
    res.json(member);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /:userId — Kick (KICK ou ADMIN)
router.delete('/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (userId === req.params.userId) return res.status(400).json({ error: 'Impossible de se kicker soi-même' });
    if (!(await hasPerm(userId, 0x10))) return res.status(403).json({ error: 'Accès refusé' });

    await memberService.kick(req.params.userId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /:userId/ban (BAN ou ADMIN)
router.post('/:userId/ban', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (userId === req.params.userId) return res.status(400).json({ error: 'Impossible de se bannir soi-même' });
    if (!(await hasPerm(userId, 0x20))) return res.status(403).json({ error: 'Accès refusé' });

    await memberService.ban(req.params.userId, req.body.reason);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /:userId/ban — Unban (BAN ou ADMIN)
router.delete('/:userId/ban', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await hasPerm(userId, 0x20))) return res.status(403).json({ error: 'Accès refusé' });

    await memberService.unban(req.params.userId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
