import { Router, Response } from 'express';
import { ForumService } from '../services/forum.service';
import { PermissionService } from '../services/permission.service';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const forumService = new ForumService();
const permissionService = new PermissionService();

// Vérifie si l'utilisateur est admin ou gestionnaire
async function isAdminOrMod(userId: string): Promise<boolean> {
  const perms = await permissionService.computeMemberPermissions(userId);
  return (perms & 0x40) !== 0 || (perms & 0x20) !== 0; // ADMIN | MANAGE_SERVER
}

// GET /forum/:channelId — liste des posts du forum
router.get('/:channelId', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const result = await forumService.listPosts(req.params.channelId, page, limit);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /forum/:channelId/posts/:postId — détail d'un post
router.get('/:channelId/posts/:postId', async (req: AuthRequest, res: Response) => {
  try {
    const post = await forumService.getPost(req.params.postId);
    if (!post || post.channelId !== req.params.channelId) {
      return res.status(404).json({ error: 'Post introuvable' });
    }
    res.json(post);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /forum/:channelId — créer un nouveau post
router.post('/:channelId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { title, content, tags } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Le titre est requis' });
    if (!content?.trim()) return res.status(400).json({ error: 'Le contenu est requis' });

    const post = await forumService.createPost({
      channelId: req.params.channelId,
      authorId: userId,
      title,
      content,
      tags,
    });
    res.status(201).json(post);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /forum/:channelId/posts/:postId — modifier un post
router.patch('/:channelId/posts/:postId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const result = await forumService.updatePost(req.params.postId, userId, req.body);
    if (!result) return res.status(404).json({ error: 'Post introuvable' });
    if ('forbidden' in result) return res.status(403).json({ error: 'Accès refusé' });
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /forum/:channelId/posts/:postId — supprimer un post
router.delete('/:channelId/posts/:postId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const admin = await isAdminOrMod(userId);
    const result = await forumService.deletePost(req.params.postId, userId, admin);
    if (!result) return res.status(404).json({ error: 'Post introuvable' });
    if ('forbidden' in result) return res.status(403).json({ error: 'Accès refusé' });
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /forum/:channelId/posts/:postId/pin — épingler/désépingler (admin/mod)
router.patch('/:channelId/posts/:postId/pin', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdminOrMod(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const { isPinned } = req.body;
    if (typeof isPinned !== 'boolean') return res.status(400).json({ error: 'isPinned requis (boolean)' });
    const post = await forumService.pinPost(req.params.postId, isPinned);
    res.json(post);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /forum/:channelId/posts/:postId/lock — verrouiller/déverrouiller (admin/mod)
router.patch('/:channelId/posts/:postId/lock', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!(await isAdminOrMod(userId))) return res.status(403).json({ error: 'Accès refusé' });

    const { isLocked } = req.body;
    if (typeof isLocked !== 'boolean') return res.status(400).json({ error: 'isLocked requis (boolean)' });
    const post = await forumService.lockPost(req.params.postId, isLocked);
    res.json(post);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
