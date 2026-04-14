import { Router, Response } from 'express';
import { AutomodService } from '../services/automod.service';
import { PermissionService } from '../services/permission.service';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const automodService = new AutomodService();
const permissionService = new PermissionService();

async function isAdmin(userId: string): Promise<boolean> {
  const perms = await permissionService.computeMemberPermissions(userId);
  return (perms & 0x40) !== 0; // ADMIN uniquement pour automod
}

// GET /automod — liste des règles
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const rules = await automodService.list();
    res.json(rules);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /automod/:id — détail d'une règle
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const rule = await automodService.getById(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Règle introuvable' });
    res.json(rule);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /automod — créer une règle
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const validTriggers = ['keyword', 'spam', 'mention_spam', 'link', 'invite'];
    const validActions = ['block', 'alert', 'timeout', 'delete'];
    const { name, triggerType, triggerMetadata, actionType, actionMetadata } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis' });
    if (!validTriggers.includes(triggerType)) {
      return res.status(400).json({ error: `triggerType invalide. Valeurs: ${validTriggers.join(', ')}` });
    }
    if (!validActions.includes(actionType)) {
      return res.status(400).json({ error: `actionType invalide. Valeurs: ${validActions.join(', ')}` });
    }

    const rule = await automodService.create(userId, { name, triggerType, triggerMetadata, actionType, actionMetadata });
    res.status(201).json(rule);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /automod/:id — modifier une règle
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const rule = await automodService.update(req.params.id, req.body);
    if (!rule) return res.status(404).json({ error: 'Règle introuvable' });
    res.json(rule);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /automod/:id/toggle — activer/désactiver
router.patch('/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled requis (boolean)' });

    const rule = await automodService.toggle(req.params.id, enabled);
    res.json(rule);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /automod/:id — supprimer une règle
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const result = await automodService.delete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Règle introuvable' });
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
