import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as serviceAccount from '../../factura-9621d-firebase-adminsdk-fbsvc-98a872d519.json';

@Injectable()
export class NotificationService {
  constructor() {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error('FIREBASE_PRIVATE_KEY is not defined');
    }

    if (!admin.apps.length) {
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
  // 📲 SEND PUSH
  // ==============================
  async sendPush(token: string, title: string, body: string, data?: any) {
    try {
      await admin.messaging().send({
        token,
        notification: {
          title,
          body,
        },
        data: data || {},
      });

      return { success: true };
    } catch (error) {
      console.error('Push error:', error);
      return { success: false };
    }
  }
}
