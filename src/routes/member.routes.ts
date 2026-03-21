import { Router, Request, Response } from 'express';
import { MemberService } from '../services/member.service';
import { formatMember } from '../utils/format';

const router = Router();
const memberService = new MemberService();

// GET /
router.get('/', async (req: Request, res: Response) => {
  try {
    const showBanned = req.query.showBanned === 'true';
    const members = await memberService.list(showBanned);
    res.json(members.map(formatMember));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:userId
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const member = await memberService.getByUserId(req.params.userId);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });
    res.json(formatMember(member));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST / — Join
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, username, displayName, avatarUrl } = req.body;
    if (!userId || !username) return res.status(400).json({ error: 'userId et username requis' });

    const result = await memberService.join({ userId, username, displayName, avatarUrl });
    if (result && 'error' in result) {
      return res.status(403).json(result);
    }
    res.status(201).json(result ? formatMember(result) : null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:userId
router.patch('/:userId', async (req: Request, res: Response) => {
  try {
    const member = await memberService.update(req.params.userId, req.body);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });
    res.json(formatMember(member));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:userId — Kick
router.delete('/:userId', async (req: Request, res: Response) => {
  try {
    await memberService.kick(req.params.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:userId/ban
router.post('/:userId/ban', async (req: Request, res: Response) => {
  try {
    await memberService.ban(req.params.userId, req.body.reason);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:userId/ban — Unban
router.delete('/:userId/ban', async (req: Request, res: Response) => {
  try {
    await memberService.unban(req.params.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
