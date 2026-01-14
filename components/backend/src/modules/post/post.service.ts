import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { likes, posts } from 'src/db/schema/posts.schema';
import { db } from 'src/db/client';
import {schema, users} from 'src/db/schema/schema';
import { and, eq, sql } from 'drizzle-orm'; // ✅ أهم import!
import { unlink } from 'fs/promises';
import { join } from 'path';
import { log } from 'console';
@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

   /**
   * Create a post and attach uploaded photos paths.
   * @param dto CreatePostDto & { authorId: string }
   * @param uploadedPaths array of strings like 'uploads/posts/<filename>'
   */
  async createPost(dto: CreatePostDto & { authorId: string }, uploadedPaths: string[] = []) {
        console.log(dto)
        console.log(uploadedPaths)


    const photosJson = uploadedPaths.length > 0 ? JSON.stringify(uploadedPaths) : JSON.stringify([]);
    console.log(photosJson)
    try {
      const inserted = await db.insert(posts).values({
        title: dto.title,
        content: dto.content,
        userId: dto.authorId,
        photos: photosJson,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning().catch((err) => console.log(err)
      );
      console.log(inserted)
      if (Array.isArray(inserted)) return inserted[0];
      return inserted;
    } catch (err: any) {
      this.logger.error('DB insert failed for post', err?.message || err);

      await Promise.all(uploadedPaths.map(async (p) => {
        try {
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
async  addLikeOrDelete(userId: string, postId: number) {
  return await db.transaction(async (tx) => {
    // 1) شوف إذا في لايك سابق
    const existing = await tx
      .select({ id: likes.id })
      .from(likes)
      .where(
        and(
          eq(likes.likedPy, userId),
          eq(likes.postId, postId),
        )
      );

    const alreadyLiked = existing.length > 0;

    if (alreadyLiked) {
      // 🧹 إلغاء لايك
      await tx
        .delete(likes)
        .where(
          and(
            eq(likes.likedPy, userId),
            eq(likes.postId, postId),
          )
        );

      await tx
        .update(posts)
        .set({
          numberOfLikes: sql`${posts.numberOfLikes} - 1`,
        })
        .where(eq(posts.id, postId));

      return "like deleted";
    } else {
      // ✚ إضافة لايك
      await tx.insert(likes).values({
        postId,
        likedPy: userId,
      });

      await tx
        .update(posts)
        .set({
          numberOfLikes: sql`${posts.numberOfLikes} + 1`,
        })
        .where(eq(posts.id, postId));

      return "like added";
    }
  });
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
      numberOfLikes:r.numberOfLikes,
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
  let user=await db.select().from(users).where(eq(users.fusionAuthId,id))
  if(!user[0]){
    throw new NotFoundException(`there is no user`)
  }
  const result = await db.select().from(posts).where(eq(posts.userId, id));
  
  return result;
}

async  update(id: number, updatePostDto: UpdatePostDto) {
  const payload: Record<string, any> = {};

  if (updatePostDto.title !== undefined) payload.title = updatePostDto.title;
  if (updatePostDto.content !== undefined) payload.content = updatePostDto.content;
  if (updatePostDto.photos !== undefined) {
    payload.photos = JSON.stringify(updatePostDto.photos);
  }

  payload.updatedAt = new Date();

  if (Object.keys(payload).length === 0) {
    return null;
  }

  const updated = await db
    .update(posts)
    .set(payload)
    .where(eq(posts.id, id))
    .returning(); 

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
