import { getPrisma } from '../config/database';
import { v4 as uuid } from 'uuid';

export class FileService {
  async upload(file: { originalname: string; filename: string; mimetype: string; size: number }, uploaderId: string, channelId?: string) {
    const prisma = getPrisma();
    return prisma.fileUpload.create({
      data: {
        id: uuid(),
        originalName: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        uploaderId,
        channelId: channelId || null,
      },
    });
  }

  async getByFilename(name: string) {
    const prisma = getPrisma();
    return prisma.fileUpload.findFirst({ where: { storedName: name } });
  }

  async list(channelId?: string) {
    const prisma = getPrisma();
    return prisma.fileUpload.findMany({
      where: channelId ? { channelId } : {},
      orderBy: { createdAt: 'desc' },
    });
  }
}
