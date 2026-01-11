import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';

@Injectable()
export class NotificationService implements OnModuleInit {
  
  // تنفيذ دالة عند بدء تشغيل الموديول
  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    // نتأكد إنه ما تم تهيئته سابقاً لتجنب الأخطاء
    if (admin.apps.length === 0) {
      
      // تحديد مسار ملف المفتاح
      const serviceAccountPath = path.join(process.cwd(), 'firebase-admin-key.json');

      admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath)),
      });

      console.log('✅ Firebase Admin Initialized Successfully');
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