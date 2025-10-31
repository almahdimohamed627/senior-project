import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { posts } from 'src/db/schema/posts.schema';
import { db } from 'src/auth/client';
import schema from 'src/db/schema/schema';
import { eq } from 'drizzle-orm'; // ✅ أهم import!
import { unlink } from 'fs/promises';
import { join } from 'path';
@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

   /**
   * Create a post and attach uploaded photos paths.
   * @param dto CreatePostDto & { authorId: string }
   * @param uploadedPaths array of strings like 'uploads/posts/<filename>'
   */
  async createPost(dto: CreatePostDto & { authorId: string }, uploadedPaths: string[] = []) {
    // Prepare photos JSON
    const photosJson = uploadedPaths.length > 0 ? JSON.stringify(uploadedPaths) : JSON.stringify([]);

    try {
      const inserted = await db.insert(posts).values({
        title: dto.title,
        content: dto.content,
        userId: dto.authorId,
        photos: photosJson,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      // return single created row (drizzle may return array)
      if (Array.isArray(inserted)) return inserted[0];
      return inserted;
    } catch (err: any) {
      this.logger.error('DB insert failed for post', err?.message || err);

      // Rollback: delete uploaded files to avoid orphan files
      await Promise.all(uploadedPaths.map(async (p) => {
        try {
          // Normalize path, ensure it is inside uploads/posts
          const normalized = p.replace(/\\/g, '/');
          const trimmed = normalized.startsWith('/') ? normalized.slice(1) : normalized;
          if (!trimmed.startsWith('uploads/posts/')) {
            this.logger.warn(`Skipping deletion of suspicious path during rollback: ${p}`);
            return;
          }
          const fullPath = join(process.cwd(), trimmed);
          await unlink(fullPath).catch(() => null);
          this.logger.log(`Deleted uploaded file during rollback: ${fullPath}`);
        } catch (e) {
          this.logger.warn('Failed to delete uploaded file during rollback', e?.message || e);
        }
      }));

      throw new InternalServerErrorException('Failed to create post; database insert failed.');
    }
  }

   async findAll() {
    // صح: استعمل from(posts)
    const rows = await db.select().from(posts);

    // تحوّل حقل photos (المخزّن كـ JSON string) إلى مصفوفة قبل الإرجاع
    const normalized = rows.map(r => ({
      id: r.id,
      title: r.title,
      content: r.content,
      userId: r.userId,   // أو authorId حسب سكيمتك
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      photos: r.photos ? this.tryParsePhotos(r.photos) : [], // helper أدناه
    }));

    return rows;
  }
  

async findOne(id: number) {
  const result = await db.select().from(posts).where(eq(posts.id, id));
  if (!result.length) throw new NotFoundException(`Post with id ${id} not found`);
  return result[0];
}
async findOneByUserId(id: string) {
  const result = await db.select().from(posts).where(eq(posts.userId, id));
  if (!result.length) throw new NotFoundException(`Post with id ${id} not found`);
  return result;
}

async  update(id: number, updatePostDto: UpdatePostDto) {
  // جمع الحقول اللي بدنا نحدّثها بشكل انتقائي
  const payload: Record<string, any> = {};

  if (updatePostDto.title !== undefined) payload.title = updatePostDto.title;
  if (updatePostDto.content !== undefined) payload.content = updatePostDto.content;
  if (updatePostDto.photos !== undefined) {
    // حوّل مصفوفة الصور إلى JSON string لأن العمود من نوع text
    payload.photos = JSON.stringify(updatePostDto.photos);
  }

  // حدّث خانة updatedAt دائماً (اختياري)
  payload.updatedAt = new Date();

  // لو ما في أي حقل للتحديث -> ارجع null أو throw
  if (Object.keys(payload).length === 0) {
    return null;
  }

  const updated = await db
    .update(posts)
    .set(payload)
    .where(eq(posts.id, id))
    .returning(); // يرجع المصفوفة من الصفوف المحدثة

  return Array.isArray(updated) ? updated[0] ?? null : null;
}
 async remove(id: number) {
      return await db.delete(posts).where(eq(posts.id,id))
  }
   tryParsePhotos(photosStr: string) {
  try {
    const parsed = JSON.parse(photosStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
}
