import { Router, Response } from 'express';
import { EventService } from '../services/event.service';
import { PermissionService } from '../services/permission.service';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const eventService = new EventService();
const permissionService = new PermissionService();

async function isAdminOrMod(userId: string): Promise<boolean> {
  const perms = await permissionService.computeMemberPermissions(userId);
  return (perms & 0x40) !== 0 || (perms & 0x20) !== 0;
}

// GET /events — liste des événements
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query as { status?: string };
    const validStatuses = ['scheduled', 'active', 'ended', 'canceled'];
    const filtered = validStatuses.includes(status ?? '') ? (status as any) : undefined;
    const events = await eventService.list(filtered);
    res.json(events);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /events/:id — détail d'un événement
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const event = await eventService.getById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Événement introuvable' });
    res.json(event);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /events — créer un événement (admin/mod)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdminOrMod(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const { title, description, coverUrl, channelId, location, type, startsAt, endsAt, recurrence } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Le titre est requis' });
    if (!startsAt) return res.status(400).json({ error: 'La date de début est requise' });

    const startDate = new Date(startsAt);
    if (isNaN(startDate.getTime())) return res.status(400).json({ error: 'Date de début invalide' });

    const event = await eventService.create({
      creatorId: userId,
      title,
      description,
      coverUrl,
      channelId,
      location,
      type,
      startsAt: startDate,
      endsAt: endsAt ? new Date(endsAt) : undefined,
      recurrence,
    });
    res.status(201).json(event);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /events/:id — modifier un événement (admin/mod)
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdminOrMod(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const data = { ...req.body };
    if (data.startsAt) data.startsAt = new Date(data.startsAt);
    if (data.endsAt) data.endsAt = new Date(data.endsAt);

    const event = await eventService.update(req.params.id, data);
    if (!event) return res.status(404).json({ error: 'Événement introuvable' });
    res.json(event);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /events/:id — supprimer un événement (admin/mod)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdminOrMod(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const result = await eventService.delete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Événement introuvable' });
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /events/:id/status — changer le statut (admin/mod)
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdminOrMod(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const validStatuses = ['scheduled', 'active', 'ended', 'canceled'];
    const { status } = req.body;
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Statut invalide. Valeurs: ${validStatuses.join(', ')}` });
    }
    const event = await eventService.setStatus(req.params.id, status);
    res.json(event);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /events/:id/interest — marquer son intérêt (toggle)
router.post('/:id/interest', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const interested = await eventService.toggleInterest(req.params.id, userId);
    res.json({ interested });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /events/:id/interest/me — vérifier si l'utilisateur est intéressé
router.get('/:id/interest/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const interested = await eventService.isInterested(req.params.id, userId);
    res.json({ interested });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
