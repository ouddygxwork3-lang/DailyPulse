import React from 'react';
import {
  Alarm,
  ArrowsClockwise,
  Bell,
  CalendarBlank,
  Check,
  Clock,
  LinkSimple,
  PaperPlaneTilt,
  PencilSimple,
  Timer,
  Trash,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react';
import type { Category, Subtask, Task } from '../shared/schema.ts';
import {
  CATEGORY_COLOR_TOKENS,
  PRIORITY_META,
  TASK_TYPE_META,
} from '../lib/themeTokens.ts';
import { formatShortThaiDate } from '../shared/dateUtils.ts';

interface TaskCardProps {
  task: Task;
  category?: Category;
  showDateBadge?: boolean;
  onToggleComplete: (task: Task) => void;
  onToggleSubtask: (task: Task, subtaskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onSnooze: (task: Task, minutes: number) => void;
  onStartFocus: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  category,
  showDateBadge = false,
  onToggleComplete,
  onToggleSubtask,
  onEdit,
  onDelete,
  onSnooze,
  onStartFocus,
}) => {
  const isCompleted = task.status === 'completed';
  const isSubmission = task.taskType === 'submission';
  const typeMeta = TASK_TYPE_META[task.taskType];
  const colorKey = category?.colorKey ?? typeMeta.defaultColor;
  const palette = CATEGORY_COLOR_TOKENS[colorKey];
  const prioMeta = PRIORITY_META[task.priority];

  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const totalSubtasks = task.subtasks.length;

  return (
    <article
      className={`rounded-3xl border-2 border-l-8 p-4 sm:p-5 transition-all shadow-sm hover:shadow-md ${
        isCompleted
          ? 'bg-slate-100/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 border-l-emerald-500 opacity-75'
          : `${palette.cardSoftBg} ${palette.cardAccentBorder}`
      }`}
    >
      <div className="flex items-start gap-3.5 sm:gap-4">
        {/* Large 48x48 Touch Target Checkbox */}
        <button
          type="button"
          onClick={() => onToggleComplete(task)}
          aria-label={
            isCompleted
              ? `ยกเลิกสถานะเสร็จสิ้นของ ${task.title}`
              : `ทำเครื่องหมายว่าเสร็จสิ้น: ${task.title}`
          }
          aria-pressed={isCompleted}
          className={`min-w-12 min-h-12 rounded-2xl border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
            isCompleted
              ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
              : isSubmission
                ? 'bg-white dark:bg-slate-800 border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/20 text-orange-600'
                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-sky-500 text-transparent hover:text-sky-400'
          }`}
        >
          <Check size={24} weight="bold" aria-hidden="true" />
        </button>

        {/* Card Content */}
        <div className="flex-1 min-w-0">
          {/* Top Metadata Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold ${typeMeta.badgeClass}`}
            >
              {task.taskType === 'submission' && (
                <PaperPlaneTilt size={13} weight="fill" aria-hidden="true" />
              )}
              {task.taskType === 'meeting' && (
                <UsersThree size={13} weight="fill" aria-hidden="true" />
              )}
              <span>{typeMeta.shortLabel}</span>
            </span>

            {task.scheduledTime && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950">
                <Clock size={13} weight="bold" aria-hidden="true" />
                <span>
                  {task.scheduledTime}
                  {task.endTime ? `–${task.endTime}` : ''}
                </span>
              </span>
            )}

            {showDateBadge && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200">
                <CalendarBlank size={13} weight="bold" aria-hidden="true" />
                <span>{formatShortThaiDate(task.scheduledDate)}</span>
              </span>
            )}

            {task.priority !== 'normal' && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-xl text-xs font-extrabold border ${prioMeta.chipClass}`}
              >
                {prioMeta.label}
              </span>
            )}

            {category && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-xs font-bold ${palette.badgeBg} ${palette.badgeText}`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${palette.dotBg}`}
                  aria-hidden="true"
                />
                <span>{category.name}</span>
              </span>
            )}

            {task.recurrence !== 'none' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-xs font-bold bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200">
                <ArrowsClockwise size={12} weight="bold" aria-hidden="true" />
                <span>
                  {task.recurrence === 'daily'
                    ? 'ทุกวัน'
                    : task.recurrence === 'weekdays'
                      ? 'จ.-ศ.'
                      : 'ทุกสัปดาห์'}
                </span>
              </span>
            )}

            {task.scheduledTime && task.reminderOffsets.length > 0 && !isCompleted && (
              <span
                title={`ตั้งเตือนล่วงหน้า: ${task.reminderOffsets
                  .map((m) => (m === 0 ? 'ตรงเวลา' : `${m} นาที`))
                  .join(', ')}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-xs font-semibold bg-amber-100/90 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
              >
                <Bell size={12} weight="fill" aria-hidden="true" />
                <span>
                  {task.reminderOffsets
                    .map((m) => (m === 0 ? 'ตรงเวลา' : `-${m}น.`))
                    .join(' ')}
                </span>
              </span>
            )}
          </div>

          {/* Task Title */}
          <h3
            className={`text-base sm:text-lg font-extrabold leading-snug break-words ${
              isCompleted
                ? 'line-through text-slate-500 dark:text-slate-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {task.title}
          </h3>

          {/* Description */}
          {task.description && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Submission Specific Callout (Recipient & Attachment Link) */}
          {(task.submissionRecipient || task.submissionLink) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 p-2.5 rounded-2xl bg-orange-100/75 dark:bg-orange-500/15 border border-orange-200 dark:border-orange-500/30">
              {task.submissionRecipient && (
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-orange-900 dark:text-orange-200">
                  <UserCircle size={17} weight="fill" aria-hidden="true" />
                  <span>ส่งให้/ช่องทาง: {task.submissionRecipient}</span>
                </span>
              )}
              {task.submissionLink && (
                <a
                  href={task.submissionLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors ml-auto"
                >
                  <LinkSimple size={14} weight="bold" aria-hidden="true" />
                  <span>เปิดลิงก์ส่งงาน</span>
                </a>
              )}
            </div>
          )}

          {/* Subtasks Interactive Checklist */}
          {totalSubtasks > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                <span>ขั้นตอนย่อย ({completedSubtasks}/{totalSubtasks})</span>
                <span>{Math.round((completedSubtasks / totalSubtasks) * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${Math.round((completedSubtasks / totalSubtasks) * 100)}%`,
                  }}
                />
              </div>
              <ul className="space-y-1.5 pt-1">
                {task.subtasks.map((st: Subtask) => (
                  <li key={st.id}>
                    <button
                      type="button"
                      onClick={() => onToggleSubtask(task, st.id)}
                      className="w-full min-h-9 px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2.5 text-left text-sm transition-colors cursor-pointer"
                    >
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          st.completed
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {st.completed && (
                          <Check size={13} weight="bold" aria-hidden="true" />
                        )}
                      </span>
                      <span
                        className={
                          st.completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'font-medium text-slate-800 dark:text-slate-200'
                        }
                      >
                        {st.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="mt-3.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {!isCompleted && (
                <>
                  <button
                    type="button"
                    onClick={() => onStartFocus(task)}
                    className="min-h-10 px-3 rounded-xl bg-indigo-100/80 hover:bg-indigo-200/80 dark:bg-indigo-500/20 dark:hover:bg-indigo-500/30 text-indigo-800 dark:text-indigo-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Timer size={16} weight="bold" aria-hidden="true" />
                    <span>โฟกัส</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSnooze(task, 15)}
                    className="min-h-10 px-3 rounded-xl bg-amber-100/80 hover:bg-amber-200/80 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Alarm size={16} weight="bold" aria-hidden="true" />
                    <span>เตือนอีก 15น.</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => onEdit(task)}
                aria-label={`แก้ไขงาน ${task.title}`}
                className="min-w-10 min-h-10 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <PencilSimple size={18} weight="bold" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(task)}
                aria-label={`ลบงาน ${task.title}`}
                className="min-w-10 min-h-10 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <Trash size={18} weight="bold" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
