import React, { useState } from 'react';
import {
  BookmarkSimple,
  Clock,
  Lightning,
  Play,
  Stack,
  Trash,
  X,
} from '@phosphor-icons/react';
import type {
  CreateRoutineTemplateInput,
  RoutineTemplate,
  Task,
} from '../shared/schema.ts';
import { CATEGORY_COLOR_TOKENS, TASK_TYPE_META } from '../lib/themeTokens.ts';

interface RoutineTemplatesDrawerProps {
  isOpen: boolean;
  templates: RoutineTemplate[];
  todayTasks: Task[];
  targetDate: string;
  onClose: () => void;
  onApplyTemplate: (templateId: string, dateStr: string) => Promise<void>;
  onSaveTodayAsTemplate: (input: CreateRoutineTemplateInput) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
}

export const RoutineTemplatesDrawer: React.FC<RoutineTemplatesDrawerProps> = ({
  isOpen,
  templates,
  todayTasks,
  targetDate,
  onClose,
  onApplyTemplate,
  onSaveTodayAsTemplate,
  onDeleteTemplate,
}) => {
  const [newTplName, setNewTplName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingNew, setSavingNew] = useState(false);

  if (!isOpen) return null;

  const handleSaveCurrentDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTplName.trim() || todayTasks.length === 0 || savingNew) return;
    setSavingNew(true);
    try {
      await onSaveTodayAsTemplate({
        name: newTplName.trim(),
        description: `บันทึกจากตารางงาน (${todayTasks.length} รายการ)`,
        colorKey: 'emerald',
        iconName: 'BookmarkSimple',
        items: todayTasks.map((t) => ({
          title: t.title,
          description: t.description,
          taskType: t.taskType,
          submissionRecipient: t.submissionRecipient,
          submissionLink: t.submissionLink,
          scheduledTime: t.scheduledTime,
          endTime: t.endTime,
          priority: t.priority,
          categoryId: t.categoryId,
          reminderOffsets: t.reminderOffsets,
          subtasks: t.subtasks.map((s) => ({ title: s.title })),
        })),
      });
      setNewTplName('');
    } finally {
      setSavingNew(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="templates-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-4xl sm:rounded-4xl shadow-2xl border-2 border-sky-200/70 dark:border-slate-800 p-5 sm:p-7 safe-bottom space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shrink-0">
              <Stack size={26} weight="fill" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="templates-modal-title"
                className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white"
              >
                เทมเพลตงานประจำวัน (Routine Templates)
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                กดปุ่มเดียวเสกชุดงานประจำลงตารางวันที่ {targetDate} ได้ทันที
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

        {/* Template Cards */}
        <div className="space-y-3.5">
          {templates.map((tpl) => {
            const palette = CATEGORY_COLOR_TOKENS[tpl.colorKey];
            return (
              <div
                key={tpl.id}
                className={`rounded-3xl border-2 border-l-8 p-4 sm:p-5 ${palette.cardSoftBg} ${palette.cardAccentBorder}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                      {tpl.name}
                    </h3>
                    {tpl.description && (
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                        {tpl.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyId === tpl.id}
                      onClick={async () => {
                        setBusyId(tpl.id);
                        try {
                          await onApplyTemplate(tpl.id, targetDate);
                          onClose();
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className={`min-h-11 px-4 rounded-2xl text-white font-extrabold text-xs sm:text-sm inline-flex items-center gap-1.5 shadow-sm cursor-pointer ${palette.solidBg}`}
                    >
                      <Play size={16} weight="fill" aria-hidden="true" />
                      <span>
                        {busyId === tpl.id
                          ? 'กำลังสร้าง...'
                          : `เสก ${tpl.items.length} งานลงวันนี้`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTemplate(tpl.id)}
                      aria-label={`ลบเทมเพลต ${tpl.name}`}
                      className="min-w-11 min-h-11 rounded-2xl hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 flex items-center justify-center cursor-pointer"
                    >
                      <Trash size={18} weight="bold" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap gap-1.5">
                  {tpl.items.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200"
                    >
                      {item.scheduledTime && (
                        <span className="inline-flex items-center gap-0.5 text-orange-600 dark:text-orange-400 font-extrabold">
                          <Clock size={11} weight="bold" aria-hidden="true" />
                          {item.scheduledTime}
                        </span>
                      )}
                      <span>{item.title}</span>
                      <span className="text-[10px] opacity-70">
                        ({TASK_TYPE_META[item.taskType]?.shortLabel})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Save Today's Schedule as New Template */}
        <form
          onSubmit={handleSaveCurrentDay}
          className="rounded-3xl bg-emerald-50/80 dark:bg-emerald-950/25 border-2 border-emerald-200 dark:border-emerald-500/30 p-4 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
            <BookmarkSimple size={18} weight="fill" aria-hidden="true" />
            <span>บันทึกตารางงานวันนี้เก็บเป็นเทมเพลตใหม่ ({todayTasks.length} งาน)</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newTplName}
              onChange={(e) => setNewTplName(e.target.value)}
              placeholder="ตั้งชื่อเทมเพลต เช่น กิจวัตรวันจันทร์, เซ็ตปิดงบสิ้นเดือน..."
              className="flex-1 min-h-11 px-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={!newTplName.trim() || todayTasks.length === 0 || savingNew}
              className="min-h-11 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white font-extrabold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Lightning size={16} weight="fill" aria-hidden="true" />
              <span>บันทึกเป็นเทมเพลต</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
