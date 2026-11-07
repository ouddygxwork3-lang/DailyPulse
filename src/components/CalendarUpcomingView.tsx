import React, { useMemo, useState } from 'react';
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Plus,
} from '@phosphor-icons/react';
import type { Category, Task } from '../shared/schema.ts';
import { formatThaiDate } from '../shared/dateUtils.ts';
import { TaskCard } from './TaskCard.tsx';

interface CalendarUpcomingViewProps {
  todayDateStr: string;
  allTasks: Task[];
  categories: Category[];
  onToggleComplete: (task: Task) => void;
  onToggleSubtask: (task: Task, subtaskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onSnooze: (task: Task, minutes: number) => void;
  onStartFocus: (task: Task) => void;
  onCreateForDate: (dateStr: string) => void;
}

const THAI_WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

export const CalendarUpcomingView: React.FC<CalendarUpcomingViewProps> = ({
  todayDateStr,
  allTasks,
  categories,
  onToggleComplete,
  onToggleSubtask,
  onEdit,
  onDelete,
  onSnooze,
  onStartFocus,
  onCreateForDate,
}) => {
  const [selectedDate, setSelectedDate] = useState(todayDateStr);
  const [viewMonth, setViewMonth] = useState(() => {
    const [y, m] = todayDateStr.split('-').map(Number);
    return { year: y, month: m }; // 1-12
  });

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of allTasks) {
      const arr = map.get(t.scheduledDate) ?? [];
      arr.push(t);
      map.set(t.scheduledDate, arr);
    }
    return map;
  }, [allTasks]);

  const calendarCells = useMemo(() => {
    const { year, month } = viewMonth;
    const firstDayWeekday = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');

    const cells: Array<{ dateStr: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < firstDayWeekday; i++) {
      cells.push({ dateStr: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        dateStr: `${year}-${pad(month)}-${pad(d)}`,
        dayNum: d,
      });
    }
    return cells;
  }, [viewMonth]);

  const monthTitle = useMemo(() => {
    const dt = new Date(viewMonth.year, viewMonth.month - 1, 1);
    return new Intl.DateTimeFormat('th-TH', {
      month: 'long',
      year: 'numeric',
    }).format(dt);
  }, [viewMonth]);

  const changeMonth = (delta: number) => {
    setViewMonth((prev) => {
      const dt = new Date(prev.year, prev.month - 1 + delta, 1);
      return { year: dt.getFullYear(), month: dt.getMonth() + 1 };
    });
  };

  const selectedTasks = tasksByDate.get(selectedDate) ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Interactive Colorful Month Grid */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-4xl border-2 border-violet-200/70 dark:border-slate-800 p-5 sm:p-6 shadow-sm h-fit">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 flex items-center justify-center">
              <CalendarBlank size={22} weight="fill" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {monthTitle}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="เดือนก่อนหน้า"
              className="min-w-10 min-h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer"
            >
              <CaretLeft size={18} weight="bold" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                const [y, m] = todayDateStr.split('-').map(Number);
                setViewMonth({ year: y, month: m });
                setSelectedDate(todayDateStr);
              }}
              className="min-h-10 px-3 rounded-xl bg-violet-100 hover:bg-violet-200 dark:bg-violet-500/20 text-violet-800 dark:text-violet-200 text-xs font-extrabold cursor-pointer"
            >
              วันนี้
            </button>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="เดือนถัดไป"
              className="min-w-10 min-h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer"
            >
              <CaretRight size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
          {THAI_WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-xs font-extrabold text-slate-500 dark:text-slate-400 py-1"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {calendarCells.map((cell, i) => {
            if (!cell.dateStr || !cell.dayNum) {
              return <div key={`empty-${i}`} className="aspect-square" />;
            }
            const dayTasks = tasksByDate.get(cell.dateStr) ?? [];
            const pendingCount = dayTasks.filter(
              (t) => t.status === 'pending'
            ).length;
            const hasSubmission = dayTasks.some(
              (t) => t.status === 'pending' && t.taskType === 'submission'
            );
            const isSelected = cell.dateStr === selectedDate;
            const isToday = cell.dateStr === todayDateStr;

            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => setSelectedDate(cell.dateStr!)}
                className={`min-h-12 rounded-2xl p-1 flex flex-col items-center justify-center relative transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-black shadow-md'
                    : isToday
                      ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-200 font-extrabold ring-2 ring-orange-400'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold'
                }`}
              >
                <span className="text-sm">{cell.dayNum}</span>
                {dayTasks.length > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {hasSubmission && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-amber-300' : 'bg-orange-500'
                        }`}
                      />
                    )}
                    {pendingCount > 0 && (
                      <span
                        className={`text-[10px] leading-none font-extrabold ${
                          isSelected
                            ? 'text-white/90'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span>มีกำหนดส่งงาน (Deadline)</span>
          </span>
          <span>ตัวเลข = งานที่ยังไม่เสร็จ</span>
        </div>
      </div>

      {/* Right: Selected Date Task List */}
      <div className="lg:col-span-7 space-y-4">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200/80 dark:border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-extrabold text-violet-600 dark:text-violet-400 uppercase">
              ตารางงานประจำวันที่เลือก
            </span>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {formatThaiDate(selectedDate)}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onCreateForDate(selectedDate)}
            className="min-h-11 px-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus size={18} weight="bold" aria-hidden="true" />
            <span>เพิ่มงานในวันนี้</span>
          </button>
        </div>

        {selectedTasks.length === 0 ? (
          <div className="rounded-4xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/50 p-10 text-center">
            <p className="text-base font-extrabold text-slate-700 dark:text-slate-200">
              ยังไม่มีรายการงานในวันที่เลือก
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              สามารถวางแผนงานหรือตั้งเตือนกำหนดส่งล่วงหน้าไว้ได้เลย
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                category={categoryMap.get(task.categoryId)}
                onToggleComplete={onToggleComplete}
                onToggleSubtask={onToggleSubtask}
                onEdit={onEdit}
                onDelete={onDelete}
                onSnooze={onSnooze}
                onStartFocus={onStartFocus}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
