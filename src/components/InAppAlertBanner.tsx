import React from 'react';
import {
  Alarm,
  BellRinging,
  CheckCircle,
  LinkSimple,
  PaperPlaneTilt,
  X,
} from '@phosphor-icons/react';
import type { LiveNotificationPayload } from '../shared/schema.ts';

interface InAppAlertBannerProps {
  alert: LiveNotificationPayload | null;
  onDismiss: () => void;
  onCompleteTask: (taskId: string) => void;
  onSnoozeTask: (taskId: string, minutes: number) => void;
}

export const InAppAlertBanner: React.FC<InAppAlertBannerProps> = ({
  alert,
  onDismiss,
  onCompleteTask,
  onSnoozeTask,
}) => {
  if (!alert) return null;

  const isSubmission = alert.taskType === 'submission';

  return (
    <div
      role="alertdialog"
      aria-labelledby="live-alert-title"
      aria-describedby="live-alert-body"
      className="fixed top-4 inset-x-4 sm:left-auto sm:right-6 sm:w-[430px] z-50 safe-top"
    >
      <div
        className={`rounded-3xl p-5 shadow-2xl border-2 text-white ${
          isSubmission
            ? 'bg-gradient-to-br from-orange-600 via-rose-600 to-pink-600 border-orange-300/60'
            : 'bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 border-violet-300/50'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              {isSubmission ? (
                <PaperPlaneTilt size={26} weight="fill" aria-hidden="true" />
              ) : (
                <BellRinging size={26} weight="fill" aria-hidden="true" />
              )}
            </div>
            <div>
              <span className="inline-block text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 mb-1">
                {isSubmission ? 'แจ้งเตือนส่งงานด่วน!' : 'แจ้งเตือนตารางงาน'}
              </span>
              <h2 id="live-alert-title" className="text-lg font-extrabold leading-snug">
                {alert.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="ปิดหน้าต่างแจ้งเตือน"
            className="min-w-11 min-h-11 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={20} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <p id="live-alert-body" className="mt-2.5 text-sm font-medium text-white/95 leading-relaxed">
          {alert.body}
        </p>

        {alert.submissionLink && (
          <a
            href={alert.submissionLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold transition-colors"
          >
            <LinkSimple size={16} weight="bold" aria-hidden="true" />
            <span>เปิดลิงก์ไฟล์/ช่องทางส่งงาน</span>
          </a>
        )}

        {alert.taskId && (
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                onCompleteTask(alert.taskId!);
                onDismiss();
              }}
              className="min-h-11 rounded-2xl bg-white text-slate-900 hover:bg-emerald-50 font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <CheckCircle
                size={19}
                weight="fill"
                className="text-emerald-600"
                aria-hidden="true"
              />
              <span>{isSubmission ? 'ส่งเรียบร้อย!' : 'ทำเสร็จแล้ว'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onSnoozeTask(alert.taskId!, 10);
                onDismiss();
              }}
              className="min-h-11 rounded-2xl bg-black/25 hover:bg-black/35 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Alarm size={19} weight="bold" aria-hidden="true" />
              <span>เลื่อน 10 นาที</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
