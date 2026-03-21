import { Router, Request, Response } from 'express';
import { RoleService } from '../services/role.service';
import { formatRole } from '../utils/format';

const router = Router();
const roleService = new RoleService();

// GET /
router.get('/', async (_req: Request, res: Response) => {
  try {
    const roles = await roleService.list();
    res.json(roles.map(formatRole));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, color, permissions, mentionable, emoji } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Le nom du rôle est requis' });

    const role = await roleService.create({ name, color, permissions, mentionable, emoji });
    res.status(201).json(role ? formatRole(role) : null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:roleId
router.patch('/:roleId', async (req: Request, res: Response) => {
  try {
    const role = await roleService.update(req.params.roleId, req.body);
    if (!role) return res.status(404).json({ error: 'Rôle introuvable' });
    res.json(formatRole(role));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:roleId
router.delete('/:roleId', async (req: Request, res: Response) => {
  try {
    const result = await roleService.delete(req.params.roleId);
    if ('error' in result) return res.status(400).json(result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /reorder
router.put('/reorder', async (req: Request, res: Response) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order[] requis' });
    const roles = await roleService.reorder(order);
    res.json(roles.map(formatRole));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
