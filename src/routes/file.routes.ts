import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { FileService } from '../services/file.service';
import { uploadLimiter } from '../middleware/rate-limiter';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const fileService = new FileService();

// Allowed extensions — the final defense against disguised file types
const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg',
  '.mp4', '.webm', '.mov', '.avi',
  '.mp3', '.wav', '.ogg', '.flac', '.aac',
  '.pdf',
  '.txt',
]);

// Allowed MIME type prefixes
const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/', 'application/pdf', 'text/plain'];

let uploadsDir = './uploads';

export function setUploadsDir(dir: string): void {
  uploadsDir = path.resolve(dir);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    // Normalize extension from ALLOWED_EXTENSIONS based on declared MIME type
    // (never trust the original filename extension directly)
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.bin';
    cb(null, `${uuidv4()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk = ALLOWED_MIME_PREFIXES.some((t) => file.mimetype.startsWith(t));
    const extOk = ALLOWED_EXTENSIONS.has(ext);
    if (mimeOk && extOk) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
    }
  },
});

// POST /files — upload (requires auth — applied globally in app.ts)
router.post('/', uploadLimiter, upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  if (!req.user) return res.status(401).json({ error: 'Authentification requise' });

  try {
    // Derive senderId from the verified JWT user, not from a query parameter
    const senderId = req.user.userId;
    const record = await fileService.upload(
      req.file,
      senderId,
      (req.query.channelId as string) || undefined,
    );

    res.status(201).json({
      id: record.id,
      url: `/files/${req.file.filename}`,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors du traitement du fichier' });
  }
});

// GET /files/:filename
router.get('/:filename', (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier non trouvé' });
  }

  // Use { root } to ensure path containment
  res.sendFile(filename, { root: uploadsDir });
});

export default router;
