import React, { useEffect, useState } from 'react';
import {
  CheckCircle,
  ClockCountdown,
  Confetti,
  LinkSimple,
  PaperPlaneTilt,
  Timer,
  UserCircle,
} from '@phosphor-icons/react';
import type { Task } from '../shared/schema.ts';
import { getZonedParts, timeStrToMinutes } from '../shared/dateUtils.ts';

interface UpNextHeroCardProps {
  todayTasks: Task[];
  timezone: string;
  onToggleComplete: (task: Task) => void;
  onStartFocus: (task: Task) => void;
}

export const UpNextHeroCard: React.FC<UpNextHeroCardProps> = ({
  todayTasks,
  timezone,
  onToggleComplete,
  onStartFocus,
}) => {
  const [nowTick, setNowTick] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const totalCount = todayTasks.length;
  const completedCount = todayTasks.filter((t) => t.status === 'completed').length;
  const pendingTasks = todayTasks.filter((t) => t.status === 'pending');
  const pendingSubmissions = pendingTasks.filter(
    (t) => t.taskType === 'submission'
  );

  const zoned = getZonedParts(nowTick, timezone);
  const currentMinutes = zoned.hour * 60 + zoned.minute;

  // Pick the earliest pending timed task (prioritizing overdue/imminent timed tasks today, then urgent untimed)
  const timedPending = pendingTasks
    .filter((t) => t.scheduledTime !== null)
    .sort(
      (a, b) =>
        timeStrToMinutes(a.scheduledTime!) - timeStrToMinutes(b.scheduledTime!)
    );

  // Prefer upcoming or recently due timed task within -180 mins, otherwise earliest timed, otherwise highest priority untimed
  const nextTask =
    timedPending.find(
      (t) => timeStrToMinutes(t.scheduledTime!) >= currentMinutes - 180
    ) ??
    timedPending[0] ??
    pendingTasks[0] ??
    null;

  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (!nextTask) {
    return (
      <section
        aria-label="สรุปความคืบหน้าวันนี้"
        className="rounded-4xl p-6 sm:p-7 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white shadow-xl shadow-emerald-500/20"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-3xl bg-white/20 flex items-center justify-center shrink-0">
              <Confetti size={32} weight="fill" aria-hidden="true" />
            </div>
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-extrabold mb-1">
                {totalCount > 0
                  ? `เคลียร์ครบ ${completedCount}/${totalCount} รายการ!`
                  : 'พร้อมเริ่มต้นวันใหม่'}
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold">
                {totalCount > 0
                  ? 'สุดยอดมาก! คุณจัดการงานวันนี้ครบทุกชิ้นแล้ว'
                  : 'ยังไม่มีงานในตารางวันนี้ กดเพิ่มงานหรือพิมพ์รวดเดียวได้เลย'}
              </h2>
            </div>
          </div>
          {totalCount > 0 && (
            <div className="text-right">
              <div className="text-3xl font-black">{progressPct}%</div>
              <div className="text-xs font-bold text-white/85">ความสำเร็จวันนี้</div>
            </div>
          )}
        </div>
      </section>
    );
  }

  let countdownBadge = 'งานสำคัญวันนี้';
  let isPastTime = false;
  if (nextTask.scheduledTime) {
    const diff = timeStrToMinutes(nextTask.scheduledTime) - currentMinutes;
    if (diff < 0) {
      isPastTime = true;
      const lateMins = Math.abs(diff);
      countdownBadge =
        lateMins >= 60
          ? `เลยกำหนดมา ${Math.floor(lateMins / 60)} ชม. ${lateMins % 60} นาที`
          : `เลยกำหนดมา ${lateMins} นาที`;
    } else if (diff === 0) {
      countdownBadge = 'ถึงเวลาตอนนี้พอดี!';
    } else if (diff < 60) {
      countdownBadge = `อีก ${diff} นาที ถึงเวลา!`;
    } else {
      const hrs = Math.floor(diff / 60);
      const mins = diff % 60;
      countdownBadge =
        mins > 0 ? `อีก ${hrs} ชม. ${mins} นาที` : `อีก ${hrs} ชั่วโมง`;
    }
  }

  const isSubmission = nextTask.taskType === 'submission';

  return (
    <section
      aria-label="งานถัดไปที่ใกล้ถึงเวลา"
      className={`rounded-4xl p-6 sm:p-7 text-white shadow-xl transition-all ${
        isSubmission
          ? 'bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600 shadow-orange-500/25'
          : isPastTime
            ? 'bg-gradient-to-br from-rose-600 via-orange-600 to-amber-500 shadow-rose-500/25'
            : 'bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 shadow-indigo-500/25'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/25 backdrop-blur-xs text-xs font-extrabold">
            <ClockCountdown size={16} weight="bold" aria-hidden="true" />
            <span>{countdownBadge}</span>
          </span>
          {isSubmission && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-300 text-slate-950 text-xs font-black">
              <PaperPlaneTilt size={14} weight="fill" aria-hidden="true" />
              <span>งานต้องส่ง!</span>
            </span>
          )}
        </div>

        <div className="text-xs font-bold bg-black/20 px-3 py-1 rounded-full">
          เสร็จแล้ว {completedCount}/{totalCount} งาน • ต้องส่งคงเหลือ{' '}
          {pendingSubmissions.length} ชิ้น
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-baseline gap-3 flex-wrap">
            {nextTask.scheduledTime && (
              <span className="text-2xl sm:text-3xl font-black tracking-tight bg-white/20 px-3.5 py-1 rounded-2xl">
                {nextTask.scheduledTime}
                {nextTask.endTime ? `–${nextTask.endTime}` : ''}
              </span>
            )}
            <h2 className="text-xl sm:text-2xl font-extrabold leading-snug">
              {nextTask.title}
            </h2>
          </div>

          {(nextTask.submissionRecipient || nextTask.description) && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/90 pt-1">
              {nextTask.submissionRecipient && (
                <span className="inline-flex items-center gap-1.5 font-bold bg-black/20 px-3 py-1 rounded-xl">
                  <UserCircle size={18} weight="fill" aria-hidden="true" />
                  <span>ส่งให้/ช่องทาง: {nextTask.submissionRecipient}</span>
                </span>
              )}
              {nextTask.submissionLink && (
                <a
                  href={nextTask.submissionLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-bold bg-white/20 hover:bg-white/30 px-3 py-1 rounded-xl underline underline-offset-2 transition-colors"
                >
                  <LinkSimple size={16} weight="bold" aria-hidden="true" />
                  <span>เปิดลิงก์ส่งงาน</span>
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onStartFocus(nextTask)}
            className="flex-1 sm:flex-initial min-h-12 px-4 rounded-2xl bg-black/25 hover:bg-black/35 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Timer size={20} weight="bold" aria-hidden="true" />
            <span>จับเวลาโฟกัส</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleComplete(nextTask)}
            className="flex-1 sm:flex-initial min-h-12 px-5 rounded-2xl bg-white text-slate-950 hover:bg-emerald-50 font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
          >
            <CheckCircle
              size={20}
              weight="fill"
              className="text-emerald-600"
              aria-hidden="true"
            />
            <span>{isSubmission ? 'ส่งงานแล้ว!' : 'ทำเสร็จแล้ว'}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="mt-5 pt-4 border-t border-white/20">
          <div className="flex items-center justify-between text-xs font-bold text-white/90 mb-1.5">
            <span>ความคืบหน้าภารกิจวันนี้</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-black/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
};
