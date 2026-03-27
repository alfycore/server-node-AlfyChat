import { Router, Request, Response } from 'express';
import { BotService } from '../services/bot.service';

const router = Router();
const botService = new BotService();

// POST /register — Register a new bot
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, ownerId } = req.body;
    if (!name || !ownerId) return res.status(400).json({ error: 'name et ownerId requis' });

    const bot = await botService.register(name, ownerId);
    res.status(201).json(bot);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET / — List bots
router.get('/', async (_req: Request, res: Response) => {
  try {
    const bots = await botService.list();
    res.json(bots);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /:botId
router.delete('/:botId', async (req: Request, res: Response) => {
  try {
    await botService.delete(req.params.botId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
