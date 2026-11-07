import React, { useEffect, useState } from 'react';
import {
  ArrowCounterClockwise,
  CheckCircle,
  Pause,
  Play,
  Timer,
  X,
} from '@phosphor-icons/react';
import type { Task } from '../shared/schema.ts';
import { playReminderSound } from '../lib/sound.ts';

interface FocusTimerWidgetProps {
  activeTask: Task | null;
  soundEnabled: boolean;
  onClose: () => void;
  onCompleteTask: (task: Task) => void;
}

export const FocusTimerWidget: React.FC<FocusTimerWidgetProps> = ({
  activeTask,
  soundEnabled,
  onClose,
  onCompleteTask,
}) => {
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (activeTask) {
      setDurationMinutes(25);
      setSecondsLeft(25 * 60);
      setRunning(true);
      setFinished(false);
    }
  }, [activeTask?.id]);

  useEffect(() => {
    if (!running || !activeTask) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          setFinished(true);
          playReminderSound(activeTask.taskType, soundEnabled);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, activeTask, soundEnabled]);

  if (!activeTask) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const totalSecs = durationMinutes * 60;
  const pct = totalSecs > 0 ? Math.round(((totalSecs - secondsLeft) / totalSecs) * 100) : 100;

  const selectPreset = (m: number) => {
    setDurationMinutes(m);
    setSecondsLeft(m * 60);
    setFinished(false);
    setRunning(true);
  };

  return (
    <div
      role="region"
      aria-label="ตัวจับเวลาโหมดโฟกัส"
      className="fixed bottom-24 lg:bottom-6 right-4 sm:right-6 z-40 w-[calc(100vw-2rem)] sm:w-96 rounded-4xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 text-white p-5 shadow-2xl border-2 border-indigo-400/40"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-2xl bg-indigo-500/30 flex items-center justify-center text-indigo-200">
            <Timer size={20} weight="fill" aria-hidden="true" />
          </span>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-300">
              Focus Mode Pomodoro
            </div>
            <h3 className="text-sm font-extrabold line-clamp-1">
              {activeTask.title}
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดโหมดจับเวลาโฟกัส"
          className="min-w-9 min-h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
        >
          <X size={18} weight="bold" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-between my-3">
        <div className="text-4xl font-black tracking-tight font-mono">
          {formatted}
        </div>
        <div className="flex items-center gap-1.5">
          {[15, 25, 45].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => selectPreset(m)}
              className={`min-h-8 px-2.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                durationMinutes === m
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-indigo-200'
              }`}
            >
              {m}น.
            </button>
          ))}
        </div>
      </div>

      <div className="h-2 rounded-full bg-white/15 overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-400 to-pink-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {finished && (
        <div className="mb-3 rounded-2xl bg-emerald-500/25 border border-emerald-400/40 px-3 py-2 text-xs font-bold text-emerald-200">
          ครบเวลาโฟกัสแล้ว! พักสายตาสักครู่ หรือกดทำเครื่องหมายว่าเสร็จได้เลย
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="min-h-11 rounded-2xl bg-white/15 hover:bg-white/25 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {running ? (
            <>
              <Pause size={16} weight="fill" aria-hidden="true" />
              <span>พักเวลา</span>
            </>
          ) : (
            <>
              <Play size={16} weight="fill" aria-hidden="true" />
              <span>เริ่มต่อ</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setRunning(false);
            setFinished(false);
            setSecondsLeft(durationMinutes * 60);
          }}
          className="min-h-11 rounded-2xl bg-white/10 hover:bg-white/20 font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ArrowCounterClockwise size={16} weight="bold" aria-hidden="true" />
          <span>รีเซ็ต</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onCompleteTask(activeTask);
            onClose();
          }}
          className="min-h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs inline-flex items-center justify-center gap-1 cursor-pointer"
        >
          <CheckCircle size={16} weight="fill" aria-hidden="true" />
          <span>เสร็จแล้ว!</span>
        </button>
      </div>
    </div>
  );
};
