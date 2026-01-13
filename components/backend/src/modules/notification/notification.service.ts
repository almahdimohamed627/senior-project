import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import { db } from 'src/db/client';
import { notifications } from 'src/db/schema/notification.schema';
import { users } from 'src/db/schema/profiles.schema';
import { eq } from 'drizzle-orm';

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

  async sendAndSave(
    userId: string, // لمين (ID من الداتابيز)
    title: string,
    body: string,
    type: string,   // نوع الإشعار
    metadata?: any  // بيانات إضافية (مثل رقم الطلب)
  ) {
    
    // أ. الحفظ في قاعدة البيانات
    await db.insert(notifications).values({
      userId: userId,
      title: title,
      body: body,
      type: type,
      isRead: false,
      metadata: metadata
    });

    // ب. جلب التوكن وإرسال الـ Push
    const userResult = await db
      .select({ fcmToken: users.fcmToken })
      .from(users)
      .where(eq(users.fusionAuthId, userId));

    const token = userResult[0]?.fcmToken;

    if (token) {
      // نرسل الإشعار للموبايل، ونضع الـ type والـ metadata داخله أيضاً
      const fcmData = {
        type: type,
        ...Object.keys(metadata || {}).reduce((acc, key) => {
            acc[key] = String(metadata[key]); // فايربيز بيقبل Strings بس بالـ data
            return acc;
        }, {})
      };

      await this.sendRawPush(token, title, body, fcmData);
    }
  }

  /**
   * دالة لإرسال إشعار لجهاز واحد
   * @param token الـ FCM Token الخاص بجهاز المستخدم
   * @param title عنوان الإشعار
   * @param body نص الإشعار
   * @param data بيانات إضافية (اختياري) مثل رقم الطلب
   */
  async sendPushNotification(token: string, title: string, body: string, data?: any) {
    try {
      const message = {
        notification: {
          title: title,
          body: body,
        },
        data: data || {}, // البيانات الإضافية لازم تكون String Key-Value
        token: token,
        android: {
          priority: 'high' as const, // لضمان وصول الإشعار بسرعة
        },
        apns: { // إعدادات للايفون
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log('Successfully sent message:', response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error };
    }
  }
}