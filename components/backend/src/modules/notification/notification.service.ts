import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import { db } from 'src/db/client';
import { notifications as nots  } from 'src/db/schema/notification.schema';
import { users } from 'src/db/schema/profiles.schema';
import { eq ,desc} from 'drizzle-orm';

@Injectable()
export class NotificationService implements OnModuleInit {
  
  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    if (admin.apps.length === 0) {
      
      const serviceAccountPath = path.join(process.cwd(), 'firebase-admin-key.json');

      admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath)),
      });

      console.log('✅ Firebase Admin Initialized Successfully');
    }
  }
async sendRawPush(token: string, title: string, body: string, data?: any) {
    try {
      const message = {
        notification: { title, body },
        data: data || {},
        token: token,
        android: { priority: 'high' as const },
        apns: { payload: { aps: { sound: 'default' } } },
      };
      return await admin.messaging().send(message);
    } catch (error) {
      console.error('Error sending FCM:', error);
    }
  }

  async saveToken(fcmToken:string,user){
      await db
        .update(users)
        .set({ fcmToken: fcmToken })
        .where(eq(users.fusionAuthId, user.sub));
   
  }

  async sendAndSave(
    userId: string, 
    title: string,
    body: string,
    type: string,   
    metadata?: any  
  ) {
    
    await db.insert(nots).values({
      userId: userId,
      title: title,
      body: body,
      type: type,
      isRead: false,
      metadata: metadata
    });

    const userResult = await db
      .select({ fcmToken: users.fcmToken })
      .from(users)
      .where(eq(users.fusionAuthId, userId));

    const token = userResult[0]?.fcmToken;

    if (token) {
      const fcmData = {
        type: type,
        ...Object.keys(metadata || {}).reduce((acc, key) => {
            acc[key] = String(metadata[key]); 
            return acc;
        }, {})
      };

      await this.sendRawPush(token, title, body, fcmData);
    }
  }


async returnNotifications(userId: string) {
  let notifications = await db
    .select()
    .from(nots) 
    .where(eq(nots.userId, userId))
    .orderBy(desc(nots.createdAt)); 

  return notifications;
}


}