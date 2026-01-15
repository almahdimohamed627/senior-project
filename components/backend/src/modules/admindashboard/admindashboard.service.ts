import { Injectable } from '@nestjs/common';
import { CreateAdmindashboardDto } from './dto/create-admindashboard.dto';
import { UpdateAdmindashboardDto } from './dto/update-admindashboard.dto';
import { posts } from 'src/db/schema/posts.schema';
import { db } from 'src/db/client';
import { eq } from 'drizzle-orm';

@Injectable()
export class AdmindashboardService {
  create(createAdmindashboardDto: CreateAdmindashboardDto) {
    return 'This action adds a new admindashboard';
  }

  async acceptOrReject(postId:number,key:boolean) {
  if(key){
    await db.update(posts).set({keyStatus:'published'}).where(eq(posts.id,postId))
    return {msg:"post published"}
  }
  else{
    await db.update(posts).set({keyStatus:'rejected'}).where(eq(posts.id,postId))
    return {msg:"post rejected"}
  }
  }

  findOne(id: number) {
    return `This action returns a #${id} admindashboard`;
  }

  update(id: number, updateAdmindashboardDto: UpdateAdmindashboardDto) {
    return `This action updates a #${id} admindashboard`;
  }

  remove(id: number) {
    return `This action removes a #${id} admindashboard`;
  }
}
