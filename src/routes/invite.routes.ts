import { Router, Request, Response } from 'express';
import { InviteService } from '../services/invite.service';
import { formatInvite } from '../utils/format';

const router = Router();
const inviteService = new InviteService();

// GET /
router.get('/', async (_req: Request, res: Response) => {
  try {
    const invites = await inviteService.list();
    res.json(invites);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req: Request, res: Response) => {
  try {
    const creatorId = req.body.creatorId || req.body.userId || (req.headers['x-user-id'] as string);
    if (!creatorId) return res.status(400).json({ error: 'creatorId requis' });

    const invite = await inviteService.create({
      serverId: process.env.SERVER_ID || '',
      creatorId,
      maxUses: req.body.maxUses,
      expiresIn: req.body.expiresIn,
    });
    res.status(201).json(invite);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:code — Verify invite
router.get('/:code', async (req: Request, res: Response) => {
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:code/use
router.post('/:code/use', async (req: Request, res: Response) => {
  try {
    const result = await inviteService.verify(req.params.code);
    if ('error' in result) return res.status(410).json(result);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:inviteId
router.delete('/:inviteId', async (req: Request, res: Response) => {
  try {
    await inviteService.delete(req.params.inviteId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
