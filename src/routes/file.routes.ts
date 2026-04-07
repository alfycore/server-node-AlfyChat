import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { FileService } from '../services/file.service';
import { uploadLimiter } from '../middleware/rate-limiter';

const router = Router();
const fileService = new FileService();

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
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/', 'video/', 'audio/', 'application/pdf', 'text/plain'];
    if (allowed.some((t) => file.mimetype.startsWith(t))) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
    }
  },
});

// POST /files — upload
router.post('/', uploadLimiter, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

  try {
    const record = await fileService.upload(
      req.file,
      (req.query.senderId as string) || 'unknown',
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
    res.status(500).json({ error: err.message });
  }
});

// GET /files/:filename
router.get('/:filename', (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier non trouvé' });
  }

  res.sendFile(path.resolve(filePath));
});

export default router;
