import React, { useEffect, useState } from 'react';
import {
  BellRinging,
  CheckCircle,
  DeviceMobile,
  Info,
  LockKey,
  PaperPlaneRight,
  SignOut,
  SpeakerHigh,
  TelegramLogo,
  X,
} from '@phosphor-icons/react';
import type {
  AppSettingsPublic,
  NotificationLogItem,
  UpdateSettingsInput,
} from '../shared/schema.ts';
import {
  detectPlatformPushInfo,
  getActivePushSubscription,
  subscribeBrowserToWebPush,
} from '../lib/pushClient.ts';
import { api } from '../lib/api.ts';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  settings: AppSettingsPublic;
  notifications: NotificationLogItem[];
  onClose: () => void;
  onSettingsUpdated: (next: AppSettingsPublic) => void;
  onNotificationsUpdated: (logs: NotificationLogItem[]) => void;
  onLogout: () => void;
}

export const NotificationSettingsModal: React.FC<
  NotificationSettingsModalProps
> = ({
  isOpen,
  settings,
  notifications,
  onClose,
  onSettingsUpdated,
  onNotificationsUpdated,
  onLogout,
}) => {
  const [telegramEnabled, setTelegramEnabled] = useState(
    settings.telegramEnabled
  );
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState(settings.telegramChatId);
  const [morningBriefingEnabled, setMorningBriefingEnabled] = useState(
    settings.morningBriefingEnabled
  );
  const [morningBriefingTime, setMorningBriefingTime] = useState(
    settings.morningBriefingTime
  );
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [newPin, setNewPin] = useState('');
  const [thisDeviceSubscribed, setThisDeviceSubscribed] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const platform = detectPlatformPushInfo();

  useEffect(() => {
    if (!isOpen) return;
    setTelegramEnabled(settings.telegramEnabled);
    setTelegramChatId(settings.telegramChatId);
    setTelegramBotToken('');
    setMorningBriefingEnabled(settings.morningBriefingEnabled);
    setMorningBriefingTime(settings.morningBriefingTime);
    setSoundEnabled(settings.soundEnabled);
    setNewPin('');
    setStatusMessage(null);

    void getActivePushSubscription().then((sub) => {
      setThisDeviceSubscribed(Boolean(sub));
    });
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleEnablePush = async () => {
    setBusy(true);
    setStatusMessage(null);
    try {
      const sub = await subscribeBrowserToWebPush(settings.vapidPublicKey);
      const res = await api.subscribePush(sub, platform.deviceLabel);
      onSettingsUpdated(res.settings);
      setThisDeviceSubscribed(true);
      setStatusMessage({
        type: 'ok',
        text: `เปิดรับแจ้งเตือน Web Push บนอุปกรณ์นี้ (${platform.deviceLabel}) สำเร็จ!`,
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: 'err',
        text: (err as Error).message || 'ไม่สามารถเปิด Web Push ได้',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleTestNotification = async () => {
    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await api.sendTestNotification();
      onNotificationsUpdated(res.notifications);
      const parts = ['แบนเนอร์และเสียงในแอป'];
      if (res.result.webPushSent > 0) {
        parts.push(`Web Push (${res.result.webPushSent} เครื่อง)`);
      }
      if (res.result.telegramSent) {
        parts.push('Telegram Bot');
      }
      setStatusMessage({
        type: 'ok',
        text: `ยิงแจ้งเตือนทดสอบแล้วผ่าน: ${parts.join(' + ')}`,
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: 'err',
        text: (err as Error).message || 'ทดสอบส่งแจ้งเตือนไม่สำเร็จ',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatusMessage(null);
    try {
      const patch: UpdateSettingsInput = {
        telegramEnabled,
        telegramChatId: telegramChatId.trim(),
        morningBriefingEnabled,
        morningBriefingTime,
        soundEnabled,
      };
      if (telegramBotToken.trim().length > 0) {
        patch.telegramBotToken = telegramBotToken.trim();
      }
      if (newPin.trim().length > 0) {
        patch.newPin = newPin.trim();
      }
      const res = await api.updateSettings(patch);
      onSettingsUpdated(res.settings);
      setTelegramBotToken('');
      setNewPin('');
      setStatusMessage({
        type: 'ok',
        text: 'บันทึกการตั้งค่าแจ้งเตือนเรียบร้อยแล้ว!',
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: 'err',
        text: (err as Error).message || 'บันทึกการตั้งค่าไม่สำเร็จ',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="noti-settings-title"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-4xl sm:rounded-4xl shadow-2xl border-2 border-orange-200/70 dark:border-slate-800 p-5 sm:p-7 safe-bottom space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 text-white flex items-center justify-center shrink-0">
              <BellRinging size={26} weight="fill" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="noti-settings-title"
                className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white"
              >
                ตั้งค่าแจ้งเตือน & ซิงค์ข้ามอุปกรณ์
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                เชื่อมอุปกรณ์ไว้แล้ว {settings.pushSubscriptionCount} เครื่อง • โซนเวลา {settings.timezone}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="min-w-11 min-h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 flex items-center justify-center cursor-pointer"
          >
            <X size={20} weight="bold" aria-hidden="true" />
          </button>
        </div>

        {statusMessage && (
          <div
            role="status"
            className={`rounded-2xl px-4 py-3 text-sm font-bold border ${
              statusMessage.type === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/30'
                : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-500/30'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Section 1: PWA Web Push & iOS Guide */}
        <div className="rounded-3xl bg-gradient-to-br from-orange-50 to-amber-50/60 dark:from-slate-800/90 dark:to-slate-800/50 border-2 border-orange-200/80 dark:border-slate-700 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-orange-800 dark:text-orange-300 mb-1">
                <DeviceMobile size={16} weight="fill" aria-hidden="true" />
                <span>อุปกรณ์ปัจจุบัน: {platform.deviceLabel}</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                แจ้งเตือนเด้งตรงบนเครื่อง (PWA Web Push)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                เด้งเตือนพร้อมปุ่มกด “ทำเสร็จแล้ว / เลื่อน 10 นาที” แม้พับหน้าจอไว้
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleEnablePush}
                className={`min-h-11 px-4 rounded-2xl font-extrabold text-xs sm:text-sm inline-flex items-center gap-1.5 shadow-sm cursor-pointer ${
                  thisDeviceSubscribed
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gradient-to-r from-orange-500 to-rose-500 text-white'
                }`}
              >
                <CheckCircle size={18} weight="fill" aria-hidden="true" />
                <span>
                  {thisDeviceSubscribed
                    ? 'เชื่อม Push เครื่องนี้แล้ว (กดอัปเดต)'
                    : 'เปิดรับแจ้งเตือนบนเครื่องนี้'}
                </span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={handleTestNotification}
                className="min-h-11 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white font-extrabold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <PaperPlaneRight size={17} weight="fill" aria-hidden="true" />
                <span>ทดสอบยิงแจ้งเตือนจริง!</span>
              </button>
            </div>
          </div>

          {/* iOS Safari Add-to-Home-Screen Helper */}
          <div className="rounded-2xl bg-white/85 dark:bg-slate-900/80 border border-orange-200/70 dark:border-slate-700 p-3.5 text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Info
                size={16}
                weight="fill"
                className="text-orange-500"
                aria-hidden="true"
              />
              <span>วิธีเปิดแจ้งเตือนบนมือถือ iPhone (iOS) และ Android:</span>
            </div>
            <p>
              • <b>iOS (Safari):</b> กดปุ่ม <b>แชร์ (Share)</b> ด้านล่างจอ แล้วเลือก{' '}
              <b>“เพิ่มไปยังหน้าจอโฮม” (Add to Home Screen)</b> จากนั้นเปิดไอคอนแอป DayPulse บนหน้าจอโฮมแล้วกดปุ่ม “เปิดรับแจ้งเตือนบนเครื่องนี้”
            </p>
            <p>
              • <b>Android / PC (Chrome, Edge):</b> กดปุ่ม “เปิดรับแจ้งเตือนบนเครื่องนี้” ได้ทันที และกด <b>ติดตั้งแอป (Install App)</b> บนแถบเมนูเพื่อใช้งานเต็มจอ
            </p>
          </div>
        </div>

        {/* Section 2: Telegram Bot + Daily Briefing + Sound + PIN */}
        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div className="rounded-3xl bg-sky-50/80 dark:bg-sky-950/20 border-2 border-sky-200 dark:border-sky-500/30 p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TelegramLogo
                  size={22}
                  weight="fill"
                  className="text-sky-600 dark:text-sky-400"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    แจ้งเตือนสำรองผ่าน Telegram Bot (ฟรี 100%)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    ส่งข้อความพร้อมลิงก์ส่งงานเข้าแชทมือถือของคุณตรงเวลาเป๊ะ แม้ปิดเบราว์เซอร์ทุกเครื่อง
                  </p>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegramEnabled}
                  onChange={(e) => setTelegramEnabled(e.target.checked)}
                  className="w-5 h-5 accent-sky-600 rounded"
                />
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  เปิดใช้งาน
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="tg-token"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Bot Token (จาก @BotFather)
                </label>
                <input
                  id="tg-token"
                  type="password"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder={
                    settings.telegramBotTokenMasked || 'เช่น 123456789:ABCdef...'
                  }
                  className="w-full min-h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="tg-chat"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Chat ID ของคุณ (จาก @userinfobot)
                </label>
                <input
                  id="tg-chat"
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="เช่น 987654321"
                  className="w-full min-h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Morning Daily Briefing & Sound */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  สรุปตารางงานตอนเช้า (Daily Briefing)
                </span>
                <input
                  type="checkbox"
                  aria-label="เปิดใช้งานสรุปตารางงานตอนเช้า"
                  checked={morningBriefingEnabled}
                  onChange={(e) => setMorningBriefingEnabled(e.target.checked)}
                  className="w-5 h-5 accent-orange-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="briefing-time"
                  className="text-xs font-bold text-slate-600 dark:text-slate-400"
                >
                  เวลาส่งสรุปทุกเช้า:
                </label>
                <input
                  id="briefing-time"
                  type="time"
                  value={morningBriefingTime}
                  onChange={(e) => setMorningBriefingTime(e.target.value)}
                  className="min-h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>
            </div>

            <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-900 dark:text-white">
                  <SpeakerHigh size={18} weight="fill" aria-hidden="true" />
                  <span>เสียงเตือนในแอป (Sound Chime)</span>
                </span>
                <input
                  type="checkbox"
                  aria-label="เปิดเสียงเตือนในแอป"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="w-5 h-5 accent-orange-500"
                />
              </div>
              <div>
                <label
                  htmlFor="change-pin"
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-400 mb-1"
                >
                  <LockKey size={14} weight="bold" aria-hidden="true" />
                  <span>เปลี่ยนรหัส PIN ใหม่ (เว้นว่างถ้าไม่เปลี่ยน):</span>
                </label>
                <input
                  id="change-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) =>
                    setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="ตัวเลข 4-6 หลัก"
                  className="w-full min-h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={onLogout}
              className="min-h-11 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
            >
              <SignOut size={18} weight="bold" aria-hidden="true" />
              <span>ล็อกหน้าจออุปกรณ์นี้</span>
            </button>

            <button
              type="submit"
              disabled={busy}
              className="min-h-12 px-6 rounded-2xl bg-gradient-to-r from-orange-500 via-rose-500 to-violet-600 text-white font-extrabold text-sm shadow-lg shadow-orange-500/25 cursor-pointer"
            >
              {busy ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </button>
          </div>
        </form>

        {/* Section 3: Recent Notification History */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
            ประวัติการยิงแจ้งเตือนล่าสุด ({notifications.length})
          </h3>
          {notifications.length === 0 ? (
            <p className="text-xs text-slate-400">
              ยังไม่มีประวัติการแจ้งเตือน ลองกดปุ่ม “ทดสอบยิงแจ้งเตือนจริง!” ด้านบนได้เลย
            </p>
          ) : (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {notifications.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5 text-xs flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="font-extrabold text-slate-900 dark:text-white">
                      {item.title}
                    </div>
                    <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                      {item.body}
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-[11px] text-slate-400">
                    <div>
                      {new Date(item.sentAt).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="font-semibold text-orange-600 dark:text-orange-400">
                      {item.channel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
