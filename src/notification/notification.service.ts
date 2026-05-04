import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationService {
  constructor() {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error('FIREBASE_PRIVATE_KEY is not defined');
    }

    if (!admin.apps.length) {
      console.log('🔥 Initializing Firebase Admin');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  // ==============================
  // 📲 SEND PUSH (DEBUG VERSION)
  // ==============================
  async sendPush(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    try {
      console.log('📤 Sending push...');
      console.log('Token:', token);
      console.log('Title:', title);

      const response = await admin.messaging().send({
        token,
        notification: {
          title,
          body,
        },
        data: data || {},
      });

      console.log('✅ Push sent successfully:', response);

      return {
        success: true,
        messageId: response,
      };
    } catch (error: any) {
      console.error('❌ Push failed:');
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);

      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }
}