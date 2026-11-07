import React, { useMemo, useState } from 'react';
import {
  ArrowBendRightDown,
  CaretDown,
  CaretRight,
  CloudSun,
  Lightning,
  MagnifyingGlass,
  MoonStars,
  PaperPlaneTilt,
  Plus,
  Stack,
  Sun,
  SunHorizon,
  WarningCircle,
} from '@phosphor-icons/react';
import type { Category, Task, TaskType } from '../shared/schema.ts';
import { timeStrToMinutes } from '../shared/dateUtils.ts';
import { UpNextHeroCard } from './UpNextHeroCard.tsx';
import { TaskCard } from './TaskCard.tsx';

interface TodayTimelineViewProps {
  todayDateStr: string;
  allTasks: Task[];
  categories: Category[];
  timezone: string;
  onToggleComplete: (task: Task) => void;
  onToggleSubtask: (task: Task, subtaskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onSnooze: (task: Task, minutes: number) => void;
  onStartFocus: (task: Task) => void;
  onRolloverOverdue: () => void;
  onOpenNewTask: () => void;
  onOpenBrainDump: () => void;
  onOpenTemplates: () => void;
}

export const TodayTimelineView: React.FC<TodayTimelineViewProps> = ({
  todayDateStr,
  allTasks,
  categories,
  timezone,
  onToggleComplete,
  onToggleSubtask,
  onEdit,
  onDelete,
  onSnooze,
  onStartFocus,
  onRolloverOverdue,
  onOpenNewTask,
  onOpenBrainDump,
  onOpenTemplates,
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | TaskType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const overdueTasks = useMemo(
    () =>
      allTasks.filter(
        (t) => t.status === 'pending' && t.scheduledDate < todayDateStr
      ),
    [allTasks, todayDateStr]
  );

  const todayAllTasks = useMemo(
    () => allTasks.filter((t) => t.scheduledDate === todayDateStr),
    [allTasks, todayDateStr]
  );

  const filteredTodayPending = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return todayAllTasks.filter((t) => {
      if (t.status !== 'pending') return false;
      if (typeFilter !== 'all' && t.taskType !== typeFilter) return false;
      if (q) {
        const hay = `${t.title} ${t.description} ${t.submissionRecipient}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [todayAllTasks, typeFilter, searchQuery]);

  const completedToday = useMemo(
    () => todayAllTasks.filter((t) => t.status === 'completed'),
    [todayAllTasks]
  );

  const sections = useMemo(() => {
    const morning: Task[] = [];
    const afternoon: Task[] = [];
    const evening: Task[] = [];
    const anytime: Task[] = [];

    for (const t of filteredTodayPending) {
      if (!t.scheduledTime) {
        anytime.push(t);
        continue;
      }
      const mins = timeStrToMinutes(t.scheduledTime);
      if (mins < 12 * 60) {
        morning.push(t);
      } else if (mins < 17 * 60) {
        afternoon.push(t);
      } else {
        evening.push(t);
      }
    }

    return [
      {
        id: 'morning',
        title: 'ช่วงเช้า (00:00 – 11:59)',
        badgeColor:
          'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
        icon: <SunHorizon size={20} weight="fill" aria-hidden="true" />,
        tasks: morning,
      },
      {
        id: 'afternoon',
        title: 'ช่วงบ่าย (12:00 – 16:59)',
        badgeColor:
          'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200',
        icon: <Sun size={20} weight="fill" aria-hidden="true" />,
        tasks: afternoon,
      },
      {
        id: 'evening',
        title: 'ช่วงเย็นและค่ำ (17:00 – 23:59)',
        badgeColor:
          'bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200',
        icon: <MoonStars size={20} weight="fill" aria-hidden="true" />,
        tasks: evening,
      },
      {
        id: 'anytime',
        title: 'งานวันนี้ (ยังไม่ระบุเวลาเฉพาะ)',
        badgeColor:
          'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200',
        icon: <CloudSun size={20} weight="fill" aria-hidden="true" />,
        tasks: anytime,
      },
    ];
  }, [filteredTodayPending]);

  const submissionCountToday = todayAllTasks.filter(
    (t) => t.status === 'pending' && t.taskType === 'submission'
  ).length;

  return (
    <div className="space-y-6">
      {/* Overdue Rollover Banner */}
      {overdueTasks.length > 0 && (
        <div className="rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-4 sm:p-5 text-white shadow-lg shadow-orange-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <WarningCircle size={28} weight="fill" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold">
                มีงานค้างจากวันก่อน {overdueTasks.length} รายการ!
              </h2>
              <p className="text-xs sm:text-sm text-white/90 font-medium">
                กดปุ่มด้านขวาเพื่อยกยอดงานที่ยังไม่เสร็จทั้งหมดมารวมในตารางวันนี้ได้ทันที
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRolloverOverdue}
            className="min-h-12 px-5 rounded-2xl bg-white text-orange-700 hover:bg-orange-50 font-extrabold text-sm inline-flex items-center justify-center gap-2 shrink-0 shadow-sm transition-colors cursor-pointer"
          >
            <ArrowBendRightDown size={18} weight="bold" aria-hidden="true" />
            <span>ยกยอดมาวันนี้ทั้งหมด ({overdueTasks.length})</span>
          </button>
        </div>
      )}

      {/* Up Next Countdown Hero Card */}
      <UpNextHeroCard
        todayTasks={todayAllTasks}
        timezone={timezone}
        onToggleComplete={onToggleComplete}
        onStartFocus={onStartFocus}
      />

      {/* Quick Superpower Action Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onOpenNewTask}
          className="min-h-14 rounded-3xl bg-gradient-to-r from-orange-500 to-rose-500 hover:opacity-95 text-white font-extrabold px-5 py-3 shadow-md shadow-orange-500/20 flex items-center justify-center gap-2.5 transition-opacity cursor-pointer"
        >
          <Plus size={22} weight="bold" aria-hidden="true" />
          <span>สร้างงานใหม่ / งานส่ง</span>
        </button>

        <button
          type="button"
          onClick={onOpenBrainDump}
          className="min-h-14 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-95 text-white font-extrabold px-5 py-3 shadow-md shadow-violet-500/20 flex items-center justify-center gap-2.5 transition-opacity cursor-pointer"
        >
          <Lightning size={22} weight="fill" aria-hidden="true" />
          <span>พิมพ์รวดเดียวหลายงาน</span>
        </button>

        <button
          type="button"
          onClick={onOpenTemplates}
          className="min-h-14 rounded-3xl bg-white dark:bg-slate-900 hover:bg-sky-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white border-2 border-sky-200 dark:border-slate-700 font-extrabold px-5 py-3 shadow-xs flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
        >
          <Stack
            size={22}
            weight="duotone"
            className="text-sky-600 dark:text-sky-400"
            aria-hidden="true"
          />
          <span>เสกเทมเพลตประจำวัน</span>
        </button>
      </div>

      {/* Filter Pills + Quick Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-3 rounded-3xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(
            [
              { key: 'all', label: `ทั้งหมด (${todayAllTasks.filter((t) => t.status === 'pending').length})` },
              {
                key: 'submission',
                label: `ต้องส่ง (${submissionCountToday})`,
                highlight: true,
              },
              { key: 'todo', label: 'ต้องทำ' },
              { key: 'meeting', label: 'นัดหมาย' },
            ] as const
          ).map((tab) => {
            const active = typeFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTypeFilter(tab.key)}
                className={`min-h-10 px-4 rounded-2xl text-xs sm:text-sm font-extrabold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active
                    ? tab.key === 'submission'
                      ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm'
                      : 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {tab.key === 'submission' && (
                  <PaperPlaneTilt size={15} weight="fill" aria-hidden="true" />
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-64">
          <MagnifyingGlass
            size={18}
            weight="bold"
            aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหางาน หรือชื่อผู้รับส่ง..."
            aria-label="ค้นหางานในวันนี้"
            className="w-full min-h-10 pl-10 pr-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Time-of-Day Timeline Sections */}
      {filteredTodayPending.length === 0 ? (
        <div className="rounded-4xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/50 p-10 text-center">
          <p className="text-lg font-extrabold text-slate-700 dark:text-slate-200">
            {searchQuery || typeFilter !== 'all'
              ? 'ไม่พบรายการงานที่ตรงกับตัวกรอง'
              : 'ไม่มีงานค้างในช่วงเวลานี้'}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            กดปุ่ม “พิมพ์รวดเดียวหลายงาน” เพื่อวางแผนทั้งวันภายในไม่กี่วินาที
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections
            .filter((sec) => sec.tasks.length > 0)
            .map((sec) => (
              <section key={sec.id} className="space-y-3">
                <div className="flex items-center gap-2.5 px-1">
                  <span
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-sm font-extrabold ${sec.badgeColor}`}
                  >
                    {sec.icon}
                    <span>{sec.title}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {sec.tasks.length} รายการ
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  {sec.tasks.map((task) => (
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
              </section>
            ))}
        </div>
      )}

      {/* Completed Tasks Today Section */}
      {completedToday.length > 0 && (
        <section className="pt-2">
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className="min-h-11 px-4 py-2 rounded-2xl bg-emerald-100/80 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
          >
            {showCompleted ? (
              <CaretDown size={16} weight="bold" aria-hidden="true" />
            ) : (
              <CaretRight size={16} weight="bold" aria-hidden="true" />
            )}
            <span>ภารกิจที่ทำเสร็จแล้ววันนี้ ({completedToday.length})</span>
          </button>

          {showCompleted && (
            <div className="mt-3 grid grid-cols-1 gap-3">
              {completedToday.map((task) => (
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
        </section>
      )}
    </div>
  );
};
