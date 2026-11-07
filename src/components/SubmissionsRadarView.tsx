import React, { useMemo, useState } from 'react';
import {
  CheckCircle,
  MagnifyingGlass,
  PaperPlaneTilt,
  Plus,
  WarningOctagon,
} from '@phosphor-icons/react';
import type { Category, Task } from '../shared/schema.ts';
import { TaskCard } from './TaskCard.tsx';

interface SubmissionsRadarViewProps {
  todayDateStr: string;
  allTasks: Task[];
  categories: Category[];
  onToggleComplete: (task: Task) => void;
  onToggleSubtask: (task: Task, subtaskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onSnooze: (task: Task, minutes: number) => void;
  onStartFocus: (task: Task) => void;
  onCreateSubmission: () => void;
}

export const SubmissionsRadarView: React.FC<SubmissionsRadarViewProps> = ({
  todayDateStr,
  allTasks,
  categories,
  onToggleComplete,
  onToggleSubtask,
  onEdit,
  onDelete,
  onSnooze,
  onStartFocus,
  onCreateSubmission,
}) => {
  const [query, setQuery] = useState('');

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const submissions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTasks.filter((t) => {
      if (t.taskType !== 'submission') return false;
      if (q) {
        const hay = `${t.title} ${t.submissionRecipient} ${t.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allTasks, query]);

  const overdue = submissions.filter(
    (t) => t.status === 'pending' && t.scheduledDate < todayDateStr
  );
  const dueToday = submissions.filter(
    (t) => t.status === 'pending' && t.scheduledDate === todayDateStr
  );
  const upcoming = submissions.filter(
    (t) => t.status === 'pending' && t.scheduledDate > todayDateStr
  );
  const submitted = submissions.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-4xl p-6 sm:p-7 bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600 text-white shadow-xl shadow-orange-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-3xl bg-white/20 flex items-center justify-center shrink-0">
            <PaperPlaneTilt size={30} weight="fill" aria-hidden="true" />
          </div>
          <div>
            <span className="inline-block px-3 py-0.5 rounded-full bg-white/20 text-xs font-extrabold mb-1">
              Submissions & Deliverables Radar
            </span>
            <h2 className="text-2xl font-extrabold">
              ศูนย์เช็กของต้องส่งก่อนจบวัน
            </h2>
            <p className="text-sm text-white/90 mt-0.5">
              รวมเฉพาะรายการ “งานที่ต้องส่ง” ทั้งผู้รับ ช่องทางส่ง และลิงก์ไฟล์แนบครบในหน้าเดียว
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCreateSubmission}
          className="min-h-12 px-5 rounded-2xl bg-white text-rose-700 hover:bg-orange-50 font-extrabold text-sm inline-flex items-center justify-center gap-2 shrink-0 shadow-md cursor-pointer"
        >
          <Plus size={18} weight="bold" aria-hidden="true" />
          <span>เพิ่มงานต้องส่ง</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <MagnifyingGlass
          size={20}
          weight="bold"
          aria-hidden="true"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาชื่องานส่ง, ชื่อลูกค้า/อาจารย์ หรือช่องทางส่ง (เช่น LINE, Email)..."
          aria-label="ค้นหารายการงานที่ต้องส่ง"
          className="w-full min-h-12 pl-12 pr-4 rounded-3xl bg-white dark:bg-slate-900 border-2 border-orange-200/80 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {overdue.length > 0 && (
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200 text-sm font-extrabold">
            <WarningOctagon size={18} weight="fill" aria-hidden="true" />
            <span>เลยกำหนดส่ง! ({overdue.length})</span>
          </div>
          <div className="space-y-3">
            {overdue.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                category={categoryMap.get(t.categoryId)}
                showDateBadge
                onToggleComplete={onToggleComplete}
                onToggleSubtask={onToggleSubtask}
                onEdit={onEdit}
                onDelete={onDelete}
                onSnooze={onSnooze}
                onStartFocus={onStartFocus}
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200 text-sm font-extrabold">
          <PaperPlaneTilt size={18} weight="fill" aria-hidden="true" />
          <span>ต้องส่งภายในวันนี้ ({dueToday.length})</span>
        </div>
        {dueToday.length === 0 ? (
          <div className="rounded-3xl bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
            ไม่มีคิวงานค้างส่งสำหรับวันนี้แล้ว สบายใจได้!
          </div>
        ) : (
          <div className="space-y-3">
            {dueToday.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                category={categoryMap.get(t.categoryId)}
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
      </section>

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-indigo-100 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-200 text-sm font-extrabold">
            <span>กำหนดส่งล่วงหน้า ({upcoming.length})</span>
          </div>
          <div className="space-y-3">
            {upcoming.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                category={categoryMap.get(t.categoryId)}
                showDateBadge
                onToggleComplete={onToggleComplete}
                onToggleSubtask={onToggleSubtask}
                onEdit={onEdit}
                onDelete={onDelete}
                onSnooze={onSnooze}
                onStartFocus={onStartFocus}
              />
            ))}
          </div>
        </section>
      )}

      {submitted.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200 text-sm font-extrabold">
            <CheckCircle size={18} weight="fill" aria-hidden="true" />
            <span>ส่งเรียบร้อยแล้ว ({submitted.length})</span>
          </div>
          <div className="space-y-3">
            {submitted.slice(0, 10).map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                category={categoryMap.get(t.categoryId)}
                showDateBadge
                onToggleComplete={onToggleComplete}
                onToggleSubtask={onToggleSubtask}
                onEdit={onEdit}
                onDelete={onDelete}
                onSnooze={onSnooze}
                onStartFocus={onStartFocus}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
