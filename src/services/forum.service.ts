import { getPrisma } from '../config/database';
import { v4 as uuid } from 'uuid';

export class ForumService {
  async listPosts(channelId: string, page = 1, limit = 20) {
    const prisma = getPrisma();
    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where: { channelId },
        orderBy: [{ isPinned: 'desc' }, { lastReplyAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.forumPost.count({ where: { channelId } }),
    ]);
    return { posts, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getPost(id: string) {
    const prisma = getPrisma();
    return prisma.forumPost.findUnique({ where: { id } });
  }

  async createPost(data: {
    channelId: string;
    authorId: string;
    title: string;
    content: string;
    tags?: string[];
  }) {
    const prisma = getPrisma();
    return prisma.forumPost.create({
      data: {
        id: uuid(),
        channelId: data.channelId,
        authorId: data.authorId,
        title: data.title.trim(),
        content: data.content.trim(),
        tags: JSON.stringify(data.tags ?? []),
      },
    });
  }

  async updatePost(
    id: string,
    requesterId: string,
    data: Partial<{ title: string; content: string; tags: string[] }>
  ) {
    const prisma = getPrisma();
    const post = await prisma.forumPost.findUnique({ where: { id } });
    if (!post) return null;
    if (post.authorId !== requesterId) return { forbidden: true };

    return prisma.forumPost.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.content !== undefined && { content: data.content.trim() }),
        ...(data.tags !== undefined && { tags: JSON.stringify(data.tags) }),
      },
    });
  }

  async deletePost(id: string, requesterId: string, isAdmin: boolean) {
    const prisma = getPrisma();
    const post = await prisma.forumPost.findUnique({ where: { id } });
    if (!post) return null;
    if (!isAdmin && post.authorId !== requesterId) return { forbidden: true };
    await prisma.forumPost.delete({ where: { id } });
    return { success: true };
  }

  async pinPost(id: string, isPinned: boolean) {
    const prisma = getPrisma();
    return prisma.forumPost.update({ where: { id }, data: { isPinned } });
  }

  async lockPost(id: string, isLocked: boolean) {
    const prisma = getPrisma();
    return prisma.forumPost.update({ where: { id }, data: { isLocked } });
  }

  async incrementReplyCount(id: string) {
    const prisma = getPrisma();
    return prisma.forumPost.update({
      where: { id },
      data: {
        replyCount: { increment: 1 },
        lastReplyAt: new Date(),
      },
    });
  }

  async decrementReplyCount(id: string) {
    const prisma = getPrisma();
    const post = await prisma.forumPost.findUnique({ where: { id } });
    if (!post || post.replyCount <= 0) return;
    await prisma.forumPost.update({
      where: { id },
      data: { replyCount: { decrement: 1 } },
    });
  }
}
