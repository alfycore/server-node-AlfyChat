import { Router, Response } from 'express';
import { StageService } from '../services/stage.service';
import { PermissionService } from '../services/permission.service';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const stageService = new StageService();
const permissionService = new PermissionService();

async function isAdminOrMod(userId: string): Promise<boolean> {
  const perms = await permissionService.computeMemberPermissions(userId);
  return (perms & 0x40) !== 0 || (perms & 0x20) !== 0;
}

// GET /stage/:channelId — état du salon de conférence
router.get('/:channelId', async (req: AuthRequest, res: Response) => {
  try {
    const state = await stageService.getOrCreate(req.params.channelId);
    res.json(state);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /stage/:channelId/start — démarrer le stage (admin/mod)
router.post('/:channelId/start', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdminOrMod(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const { topic } = req.body;
    const state = await stageService.start(req.params.channelId, userId, topic ?? '');
    res.json(state);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /stage/:channelId/end — terminer le stage (admin/mod)
router.post('/:channelId/end', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdminOrMod(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const state = await stageService.end(req.params.channelId);
    res.json(state);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /stage/:channelId/topic — modifier le sujet (admin/mod)
router.patch('/:channelId/topic', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdminOrMod(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const { topic } = req.body;
    if (typeof topic !== 'string') return res.status(400).json({ error: 'topic requis' });
    const state = await stageService.updateTopic(req.params.channelId, topic);
    res.json(state);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /stage/:channelId/join — rejoindre en tant qu'auditeur
router.post('/:channelId/join', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const state = await stageService.joinAsListener(req.params.channelId, userId);
    res.json(state);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /stage/:channelId/leave — quitter le stage
router.post('/:channelId/leave', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const state = await stageService.leave(req.params.channelId, userId);
    res.json(state);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /stage/:channelId/speakers/:userId — promouvoir en speaker (admin/mod)
router.post('/:channelId/speakers/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const actorId = req.user?.userId;
    if (!actorId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdminOrMod(actorId))) return res.status(403).json({ error: 'Accès refusé' });

    const state = await stageService.addSpeaker(req.params.channelId, req.params.userId);
    res.json(state);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /stage/:channelId/speakers/:userId — retirer du panel (admin/mod)
router.delete('/:channelId/speakers/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const actorId = req.user?.userId;
    if (!actorId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdminOrMod(actorId))) return res.status(403).json({ error: 'Accès refusé' });

    const state = await stageService.removeSpeaker(req.params.channelId, req.params.userId);
    res.json(state);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
