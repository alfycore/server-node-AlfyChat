import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';

const router = Router();

let uploadsDir = './uploads';

export function setUploadsDir(dir: string): void {
  uploadsDir = path.resolve(dir);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
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
router.post('/', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO files (id, original_name, stored_name, mime_type, size, uploader_id, channel_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.file.originalname,
    req.file.filename,
    req.file.mimetype,
    req.file.size,
    (req.query.senderId as string) || 'unknown',
    (req.query.channelId as string) || null,
    now
  );

  res.status(201).json({
    id,
    url: `/files/${req.file.filename}`,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});

// GET /files/:filename — serve static file
router.get('/:filename', (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename); // Prevent path traversal
  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier non trouvé' });
  }

  res.sendFile(path.resolve(filePath));
});

export default router;
