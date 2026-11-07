import crypto from 'node:crypto';
import webPush from 'web-push';
import type { DayPulseRepository } from './db.ts';
import type { LiveNotificationPayload, TaskType } from '../src/shared/schema.ts';

export function createPushActionToken(taskId: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`push-action:${taskId}`)
    .digest('hex');
}

export function verifyPushActionToken(
  taskId: string,
  token: string,
  secret: string
): boolean {
  const expected = createPushActionToken(taskId, secret);
  if (expected.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export interface OutgoingNotification {
  triggerKey: string;
  taskId: string | null;
  title: string;
  body: string;
  taskType: TaskType | 'briefing' | 'test';
  submissionLink?: string;
  submissionRecipient?: string;
  url?: string;
}

export interface DispatchResult {
  logged: boolean;
  webPushSent: number;
  telegramSent: boolean;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class NotificationDispatcher {
  private repo: DayPulseRepository;
  private onLiveBroadcast?: (payload: LiveNotificationPayload) => void;

  constructor(
    repo: DayPulseRepository,
    onLiveBroadcast?: (payload: LiveNotificationPayload) => void
  ) {
    this.repo = repo;
    this.onLiveBroadcast = onLiveBroadcast;
    this.configureVapid();
  }

  private configureVapid(): void {
    const settings = this.repo.getRawSettings();
    const contactEmail =
      process.env.VAPID_SUBJECT || 'mailto:daypulse@example.com';
    webPush.setVapidDetails(
      contactEmail,
      settings.vapidPublicKey,
      settings.vapidPrivateKey
    );
  }

  public async dispatch(
    notification: OutgoingNotification,
    options?: { skipDedupe?: boolean }
  ): Promise<DispatchResult> {
    if (!options?.skipDedupe && this.repo.hasTriggerFired(notification.triggerKey)) {
      return { logged: false, webPushSent: 0, telegramSent: false };
    }

    const channelsUsed: string[] = ['in-app'];
    let webPushSent = 0;
    let telegramSent = false;

    // 1. Send Web Push to all subscribed devices (PC, iOS Home Screen PWA, Android)
    const subscriptions = this.repo.listPushSubscriptions();
    const rawSettings = this.repo.getRawSettings();
    if (subscriptions.length > 0) {
      this.configureVapid();
      const actionToken = notification.taskId
        ? createPushActionToken(notification.taskId, rawSettings.vapidPrivateKey)
        : undefined;
      const pushPayload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        taskId: notification.taskId,
        actionToken,
        taskType: notification.taskType,
        submissionLink: notification.submissionLink,
        url: notification.url || '/',
        sentAt: new Date().toISOString(),
      });

      await Promise.all(
        subscriptions.map(async (sub) => {
          try {
            await webPush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              },
              pushPayload,
              { TTL: 3600, urgency: 'high' }
            );
            webPushSent++;
          } catch (err: unknown) {
            const statusCode = (err as { statusCode?: number })?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
              this.repo.removePushSubscription(sub.endpoint);
            }
          }
        })
      );

      if (webPushSent > 0) {
        channelsUsed.push(`web-push(${webPushSent})`);
      }
    }

    // 2. Send Telegram Bot Notification if enabled and configured
    const settings = this.repo.getRawSettings();
    if (
      settings.telegramEnabled &&
      settings.telegramBotToken &&
      settings.telegramChatId
    ) {
      telegramSent = await this.sendTelegramMessage(
        settings.telegramBotToken,
        settings.telegramChatId,
        notification
      );
      if (telegramSent) {
        channelsUsed.push('telegram');
      }
    }

    // 3. Record notification log in SQLite (deduplicates future ticks)
    const triggerKey = options?.skipDedupe
      ? `${notification.triggerKey}:${Date.now()}`
      : notification.triggerKey;

    const loggedItem = this.repo.recordNotification({
      triggerKey,
      taskId: notification.taskId,
      title: notification.title,
      body: notification.body,
      taskType: notification.taskType,
      channel: channelsUsed.join(', '),
    });

    // 4. Broadcast live in-app SSE notification event (for instant sound & banner on open screens)
    if (loggedItem && this.onLiveBroadcast) {
      this.onLiveBroadcast({
        id: loggedItem.id,
        taskId: notification.taskId,
        title: notification.title,
        body: notification.body,
        taskType: notification.taskType,
        submissionLink: notification.submissionLink,
        submissionRecipient: notification.submissionRecipient,
        sentAt: loggedItem.sentAt,
      });
    }

    return {
      logged: Boolean(loggedItem),
      webPushSent,
      telegramSent,
    };
  }

  public async sendTelegramMessage(
    botToken: string,
    chatId: string,
    notification: OutgoingNotification
  ): Promise<boolean> {
    try {
      const badge =
        notification.taskType === 'submission'
          ? '📦 [งานที่ต้องส่ง]'
          : notification.taskType === 'meeting'
            ? '📅 [นัดหมาย]'
            : notification.taskType === 'briefing'
              ? '☀️ [สรุปตารางงานวันนี้]'
              : notification.taskType === 'test'
                ? '🔔 [ทดสอบระบบแจ้งเตือน]'
                : '⚡ [งานที่ต้องทำ]';

      let html = `<b>${escapeHtml(badge)}</b>\n<b>${escapeHtml(notification.title)}</b>\n${escapeHtml(notification.body)}`;
      if (notification.submissionRecipient) {
        html += `\n👤 <b>ส่งให้/ช่องทาง:</b> ${escapeHtml(notification.submissionRecipient)}`;
      }
      if (notification.submissionLink) {
        html += `\n🔗 <a href="${escapeHtml(notification.submissionLink)}">เปิดลิงก์แนบงานส่ง</a>`;
      }

      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: html,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        }
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}
