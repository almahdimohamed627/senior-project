import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { posts } from 'src/db/schema/posts.schema';
import { db } from 'src/auth/client';
import schema from 'src/db/schema/schema';
import { eq } from 'drizzle-orm'; // ✅ أهم import!

@Injectable()
export class PostService {


 async createPost(dto: CreatePostDto & { authorId: string }) {
    // stringify photos array (could be undefined)
    const photosJson = dto.photos ? JSON.stringify(dto.photos) : JSON.stringify([]);

    // optionally validate authorId exists in your doctor_profiles table
    // await db.select().from(schema.doctors).where(schema.doctors.fusionAuthId.eq(dto.authorId))

    const inserted = await db.insert(posts).values({
      title: dto.title,
      content: dto.content, 
      userId: dto.authorId,
      photos: photosJson,
    }).returning(); // قد تختلف طريقة returning حسب نسخة drizzle

    return inserted; // أو ترجع inserted[0] حسب شكل النتيجة
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
