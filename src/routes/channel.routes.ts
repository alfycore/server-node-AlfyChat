import { Router, Request, Response } from 'express';
import { ChannelService } from '../services/channel.service';
import { formatChannel } from '../utils/format';
import { parseChannelType } from '../enums/ChannelType';

const router = Router();
const channelService = new ChannelService();

// GET / — List all channels
router.get('/', async (_req: Request, res: Response) => {
  try {
    const channels = await channelService.list();
    res.json(channels);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /:channelId
router.get('/:channelId', async (req: Request, res: Response) => {
  try {
    const channel = await channelService.getById(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });
    res.json(formatChannel(channel));
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST / — Create channel
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, type, topic, parentId, isNsfw } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Le nom du salon est requis' });

    const channel = await channelService.create({ name, type: parseChannelType(type ?? 'text'), topic, parentId, isNsfw });
    res.status(201).json(channel ?? null);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /:channelId — Update channel
router.patch('/:channelId', async (req: Request, res: Response) => {
  try {
    const channel = await channelService.update(req.params.channelId, req.body);
    if (!channel) return res.status(404).json({ error: 'Salon introuvable' });
    res.json(channel);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /:channelId
router.delete('/:channelId', async (req: Request, res: Response) => {
  try {
    await channelService.delete(req.params.channelId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /reorder
router.put('/reorder', async (req: Request, res: Response) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order[] requis' });
    await channelService.reorder(order);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
