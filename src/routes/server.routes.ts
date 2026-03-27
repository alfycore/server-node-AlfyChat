import { Router, Request, Response } from 'express';
import { ServerService } from '../services/server.service';

const router = Router();
const serverService = new ServerService();

// GET / — Full server data (with channels, roles, members)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const data = await serverService.getFullServerData();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH / — Update server info
router.patch('/', async (req: Request, res: Response) => {
  try {
    const { name, description, iconUrl, bannerUrl, isPublic } = req.body;
    const result = await serverService.updateServerInfo({ name, description, iconUrl, bannerUrl, isPublic });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
