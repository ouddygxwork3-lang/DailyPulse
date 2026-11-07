import React, { useMemo, useState } from 'react';
import {
  Clock,
  Lightning,
  PaperPlaneTilt,
  Sparkle,
  X,
} from '@phosphor-icons/react';
import type { CreateTaskInput } from '../shared/schema.ts';
import { parseBrainDumpText } from '../lib/brainDumpParser.ts';
import { TASK_TYPE_META, PRIORITY_META } from '../lib/themeTokens.ts';

interface BrainDumpModalProps {
  isOpen: boolean;
  defaultDate: string;
  onClose: () => void;
  onSaveBulk: (tasks: CreateTaskInput[]) => Promise<void>;
}

const EXAMPLE_TEXT = `09:30 ประชุมอัปเดตงานทีมเช้า !ด่วน
11:00 เตรียมข้อมูลใบเสนอราคาลูกค้า
14:00 ส่งไฟล์สไลด์พรีเซนต์ให้คุณเอก @LINE
16:30 ส่งรายงานประจำวัน https://drive.google.com !สำคัญ
เคลียร์บิลค่าใช้จ่ายรายเดือน`;

export const BrainDumpModal: React.FC<BrainDumpModalProps> = ({
  isOpen,
  defaultDate,
  onClose,
  onSaveBulk,
}) => {
  const [targetDate, setTargetDate] = useState(defaultDate);
  const [rawText, setRawText] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedItems = useMemo(
    () => parseBrainDumpText(rawText, targetDate),
    [rawText, targetDate]
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedItems.length === 0 || saving) return;
    setSaving(true);
    try {
      await onSaveBulk(parsedItems);
      setRawText('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brain-dump-title"
    >
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-4xl sm:rounded-4xl shadow-2xl border-2 border-violet-200/70 dark:border-slate-800 p-5 sm:p-7 safe-bottom">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shrink-0">
              <Lightning size={26} weight="fill" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="brain-dump-title"
                className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white"
              >
                พิมพ์รวดเดียวหลายงาน (Brain Dump)
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                พิมพ์บรรทัดละ 1 งาน ระบบแยกเวลา ประเภท “งานส่ง” ผู้รับ{' '}
                <code className="px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-200 font-bold">
                  @ช่องทาง
                </code>{' '}
                และความสำคัญ{' '}
                <code className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-200 font-bold">
                  !ด่วน
                </code>{' '}
                ให้อัตโนมัติ!
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label
                htmlFor="bulk-date"
                className="text-xs font-extrabold text-slate-600 dark:text-slate-300"
              >
                เพิ่มลงวันที่:
              </label>
              <input
                id="bulk-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="min-h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="button"
              onClick={() => setRawText(EXAMPLE_TEXT)}
              className="min-h-9 px-3 rounded-xl bg-violet-100 hover:bg-violet-200 dark:bg-violet-500/20 text-violet-800 dark:text-violet-200 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkle size={14} weight="fill" aria-hidden="true" />
              <span>ลองใส่ข้อความตัวอย่าง</span>
            </button>
          </div>

          <textarea
            rows={6}
            autoFocus
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={EXAMPLE_TEXT}
            aria-label="พิมพ์รายการงานหลายบรรทัด"
            className="w-full p-4 rounded-3xl bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-violet-500 focus:bg-white dark:focus:bg-slate-950 text-sm sm:text-base font-medium text-slate-900 dark:text-white leading-relaxed focus:outline-none"
          />

          {/* Live Parsed Cards Preview */}
          <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4">
            <div className="text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-3">
              พรีวิวการ์ดที่จะสร้างอัตโนมัติ ({parsedItems.length} รายการ)
            </div>

            {parsedItems.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                เริ่มพิมพ์ข้อความด้านบนเพื่อดูพรีวิวการแยกเวลาและประเภทงานแบบสดๆ
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {parsedItems.map((item, idx) => {
                  const meta = TASK_TYPE_META[item.taskType ?? 'todo'];
                  const prio = PRIORITY_META[item.priority ?? 'normal'];
                  return (
                    <div
                      key={idx}
                      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 flex flex-wrap items-center gap-2 text-sm"
                    >
                      <span
                        className={`px-2 py-0.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1 ${meta.badgeClass}`}
                      >
                        {item.taskType === 'submission' && (
                          <PaperPlaneTilt
                            size={12}
                            weight="fill"
                            aria-hidden="true"
                          />
                        )}
                        <span>{meta.shortLabel}</span>
                      </span>

                      {item.scheduledTime && (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-950 inline-flex items-center gap-1">
                          <Clock size={12} weight="bold" aria-hidden="true" />
                          <span>
                            {item.scheduledTime}
                            {item.endTime ? `–${item.endTime}` : ''}
                          </span>
                        </span>
                      )}

                      <span className="font-bold text-slate-900 dark:text-white">
                        {item.title}
                      </span>

                      {item.submissionRecipient && (
                        <span className="text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-500/20 px-2 py-0.5 rounded-lg">
                          @{item.submissionRecipient}
                        </span>
                      )}

                      {item.priority && item.priority !== 'normal' && (
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${prio.chipClass}`}
                        >
                          {prio.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={parsedItems.length === 0 || saving}
              className="min-h-12 px-6 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600 hover:opacity-95 disabled:opacity-45 text-white font-extrabold text-sm shadow-lg shadow-violet-500/25 cursor-pointer"
            >
              {saving
                ? 'กำลังสร้างชุดงาน...'
                : `เสกทั้งหมด ${parsedItems.length} งานลงตาราง!`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
