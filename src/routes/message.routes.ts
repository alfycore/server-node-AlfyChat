import { Router, Request, Response } from 'express';
import { MessageService } from '../services/message.service';
import { formatMessage } from '../utils/format';

const router = Router();
const messageService = new MessageService();

// GET /?channelId=&before=&limit=
router.get('/', async (req: Request, res: Response) => {
  try {
    const { channelId, before, limit = '50' } = req.query as Record<string, string>;
    if (!channelId) return res.status(400).json({ error: 'channelId requis' });

    const messages = await messageService.getHistory(channelId, before, parseInt(limit));
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req: Request, res: Response) => {
  try {
    const { channelId, content, sender, attachments, replyToId, senderId } = req.body;
    if (!channelId || !senderId) return res.status(400).json({ error: 'channelId et senderId requis' });
    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'content ou attachments requis' });
    }

    const result = await messageService.create({
      channelId,
      senderId,
      senderUsername: sender?.username || senderId,
      senderDisplayName: sender?.displayName,
      senderAvatarUrl: sender?.avatarUrl,
      content,
      attachments,
      replyToId,
    });
    if (result && 'error' in result) return res.status(404).json(result);
    res.status(201).json(result ?? null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:messageId
router.patch('/:messageId', async (req: Request, res: Response) => {
  try {
    const { content, senderId } = req.body;
    const result = await messageService.edit(req.params.messageId, content, senderId);
    if ('error' in result) {
      const status = result.error === 'Non autorisé' ? 403 : 404;
      return res.status(status).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:messageId
router.delete('/:messageId', async (req: Request, res: Response) => {
  try {
    await messageService.delete(req.params.messageId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
