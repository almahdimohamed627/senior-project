import { Injectable } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { posts } from 'src/db/schema/posts.schema';
import { db } from 'src/db/client';

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

  findAll() {
    return `This action returns all post`;
  }

  findOne(id: number) {
    return `This action returns a #${id} post`;
  }

  update(id: number, updatePostDto: UpdatePostDto) {
    return `This action updates a #${id} post`;
  }

  remove(id: number) {
    return `This action removes a #${id} post`;
  }
}
