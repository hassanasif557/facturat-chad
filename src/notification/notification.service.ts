import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NotificationEvent } from './notification-event.enum';
import { NotificationTemplateService } from 'src/notification-template/notification-template.service';
import { User } from 'src/user/user.entity';
import { Notification, NotificationStatus } from './notification.entity';

@Injectable()
export class NotificationService {
  constructor(
    private readonly templateService: NotificationTemplateService, // ✅ inject

    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,

    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {
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
  // 📲 SEND PUSH (RAW) — KEEP SAME
  // ==============================
  async sendPush(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    user?: any,
  ) {
    try {
      const response = await admin.messaging().send({
        token,
        notification: { title, body },
        data: data || {},
      });

      // ✅ SAVE SUCCESS HISTORY
      await this.notificationRepo.save({
        title,
        message: body,
        fcmToken: token,
        status: NotificationStatus.SENT,
        user: user ? ({ id: user.id } as User) : undefined,
        event: data?.event,
        type: data?.type,
      });

      return { success: true, messageId: response };
    } catch (error: any) {
      // ❌ SAVE FAILED HISTORY
      await this.notificationRepo.save({
        title,
        message: body,
        fcmToken: token,
        status: NotificationStatus.FAILED,
        user: user ? ({ id: user.id } as User) : undefined,
        event: data?.event,
        type: data?.type,
      });

      return { success: false, error: error.message };
    }
  }

  // ==============================
  // 👥 GET USERS (SAFE ADDITION)
  // ==============================
  private async resolveUsers(userId?: number, orgId?: number) {
    if (userId) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      return user ? [user] : [];
    }

    if (orgId) {
      return this.userRepo.find({
        where: { organization: { id: orgId } },
      });
    }

    return [];
  }

  // ==============================
  // 🚀 NEW: SEND TO USER / ORG (SAFE EXTENSION)
  // ==============================
  async sendEventToUsers(
    event: NotificationEvent,
    recipient: { userId?: number; orgId?: number },
    variables: Record<string, string>,
  ) {
    const users = await this.resolveUsers(recipient.userId, recipient.orgId);

    if (!users.length) {
      console.log('⚠️ No users found for notification');
      return;
    }

    const template = await this.templateService.findByEvent(event);

    if (!template || !template.isEnabled) {
      console.log(`🚫 Notification disabled for ${event}`);
      return;
    }

    let title = template.title;
    let message = template.message;

    Object.keys(variables).forEach((key) => {
      title = title.replace(`{{${key}}}`, variables[key]);
      message = message.replace(`{{${key}}}`, variables[key]);
    });

    return Promise.all(
      users.map((user) => {
        if (!user.fcmToken) return null;

        return this.sendPush(user.fcmToken, title, message, {
          event,
          ...variables,
        });
      }),
    );
  }

  // send broadcast (admin-only)
  async sendBroadcast(dto: {
    title: string;
    message: string;
    toAll?: boolean;
    orgId?: number;
  }) {
    let users: User[] = [];

    // =========================
    // ALL USERS
    // =========================
    if (dto.toAll) {
      users = await this.userRepo.find({
        where: {},
      });
    }

    // =========================
    // ORGANIZATION USERS
    // =========================
    else if (dto.orgId) {
      users = await this.userRepo.find({
        where: {
          organization: { id: dto.orgId },
        },
      });
    } else {
      throw new Error('Either toAll or orgId must be provided');
    }

    const tokens = users.map((u) => u.fcmToken).filter((t) => !!t);

    if (!tokens.length) {
      return {
        success: false,
        message: 'No FCM tokens found',
      };
    }

    console.log(`📢 Sending broadcast to ${tokens.length} users`);

    const results = await Promise.all(
      tokens.map((token) =>
        this.sendPush(token, dto.title, dto.message, {
          type: 'broadcast',
        }),
      ),
    );

    return {
      success: true,
      sent: results.length,
    };
  }
}
