import { Router, Request, Response } from 'express';
import { RoleService } from '../services/role.service';
import { formatRole } from '../utils/format';

const router = Router();
const roleService = new RoleService();

// GET /
router.get('/', async (_req: Request, res: Response) => {
  try {
    const roles = await roleService.list();
    res.json(roles);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, color, permissions, emoji } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Le nom du rôle est requis' });

    const role = await roleService.create({ name, color, permissions, emoji });
    res.status(201).json(role ?? null);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /:roleId
router.patch('/:roleId', async (req: Request, res: Response) => {
  try {
    const role = await roleService.update(req.params.roleId, req.body);
    if (!role) return res.status(404).json({ error: 'Rôle introuvable' });
    res.json(role);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /:roleId
router.delete('/:roleId', async (req: Request, res: Response) => {
  try {
    await roleService.delete(req.params.roleId);
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
    await roleService.reorder(order);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
