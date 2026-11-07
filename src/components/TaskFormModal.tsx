import React, { useEffect, useState } from 'react';
import {
  Bell,
  Check,
  Clock,
  PaperPlaneTilt,
  Plus,
  Trash,
  UsersThree,
  X,
} from '@phosphor-icons/react';
import type {
  Category,
  CreateTaskInput,
  PriorityLevel,
  RecurrenceType,
  Subtask,
  Task,
  TaskType,
} from '../shared/schema.ts';
import { getZonedParts, minutesToTimeStr } from '../shared/dateUtils.ts';

interface TaskFormModalProps {
  isOpen: boolean;
  initialTask: Task | null;
  defaultDate: string;
  defaultTaskType?: TaskType;
  categories: Category[];
  timezone: string;
  onClose: () => void;
  onSave: (data: CreateTaskInput, existingId?: string) => Promise<void>;
}

const REMINDER_OPTIONS = [
  { value: 0, label: 'เตือนตรงเวลา' },
  { value: 5, label: 'ก่อน 5 นาที' },
  { value: 15, label: 'ก่อน 15 นาที' },
  { value: 30, label: 'ก่อน 30 นาที' },
  { value: 60, label: 'ก่อน 1 ชม.' },
];

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  initialTask,
  defaultDate,
  defaultTaskType = 'todo',
  categories,
  timezone,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('todo');
  const [submissionRecipient, setSubmissionRecipient] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [priority, setPriority] = useState<PriorityLevel>('normal');
  const [categoryId, setCategoryId] = useState('cat-work');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [reminderOffsets, setReminderOffsets] = useState<number[]>([0, 15]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description);
      setTaskType(initialTask.taskType);
      setSubmissionRecipient(initialTask.submissionRecipient);
      setSubmissionLink(initialTask.submissionLink);
      setScheduledDate(initialTask.scheduledDate);
      setScheduledTime(initialTask.scheduledTime ?? '');
      setEndTime(initialTask.endTime ?? '');
      setPriority(initialTask.priority);
      setCategoryId(initialTask.categoryId);
      setRecurrence(initialTask.recurrence);
      setReminderOffsets(initialTask.reminderOffsets);
      setSubtasks(initialTask.subtasks);
    } else {
      setTitle('');
      setDescription('');
      setTaskType(defaultTaskType);
      setSubmissionRecipient('');
      setSubmissionLink('');
      setScheduledDate(defaultDate);
      setScheduledTime('');
      setEndTime('');
      setPriority(defaultTaskType === 'submission' ? 'high' : 'normal');
      setCategoryId(
        defaultTaskType === 'submission'
          ? 'cat-submit'
          : defaultTaskType === 'meeting'
            ? 'cat-meeting'
            : 'cat-work'
      );
      setRecurrence('none');
      setReminderOffsets(
        defaultTaskType === 'submission' ? [0, 15, 30] : [0, 15]
      );
      setSubtasks([]);
    }
    setNewSubtaskText('');
  }, [isOpen, initialTask, defaultDate, defaultTaskType]);

  if (!isOpen) return null;

  const toggleReminderOffset = (mins: number) => {
    setReminderOffsets((prev) =>
      prev.includes(mins) ? prev.filter((x) => x !== mins) : [...prev, mins]
    );
  };

  const applyPlusMinutes = (deltaMins: number) => {
    const z = getZonedParts(new Date(), timezone);
    const nextTotal = z.hour * 60 + z.minute + deltaMins;
    setScheduledTime(minutesToTimeStr(nextTotal));
  };

  const handleAddSubtask = () => {
    const t = newSubtaskText.trim();
    if (!t) return;
    setSubtasks((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: t,
        completed: false,
      },
    ]);
    setNewSubtaskText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('กรุณากรอกชื่องานหรือสิ่งที่ต้องทำ');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          title: title.trim(),
          description: description.trim(),
          taskType,
          submissionRecipient: submissionRecipient.trim(),
          submissionLink: submissionLink.trim(),
          scheduledDate,
          scheduledTime: scheduledTime || null,
          endTime: endTime || null,
          priority,
          categoryId,
          recurrence,
          reminderOffsets: scheduledTime ? reminderOffsets : [],
          subtasks,
        },
        initialTask?.id
      );
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'บันทึกงานไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-4xl sm:rounded-4xl shadow-2xl border-2 border-orange-200/60 dark:border-slate-800 p-5 sm:p-7 safe-bottom">
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2
            id="task-modal-title"
            className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white"
          >
            {initialTask ? 'แก้ไขรายละเอียดงาน' : 'สร้างงานใหม่ / ตั้งเวลาส่งงาน'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="min-w-11 min-h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer"
          >
            <X size={20} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 px-4 py-3 text-sm font-bold text-rose-700 dark:text-rose-200"
            >
              {error}
            </div>
          )}

          {/* 1. Task Type Selector */}
          <div>
            <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase mb-2">
              ประเภทของรายการ
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  {
                    type: 'todo',
                    label: 'งานที่ต้องทำ',
                    activeClass: 'bg-sky-600 text-white border-sky-600',
                    cat: 'cat-work',
                  },
                  {
                    type: 'submission',
                    label: 'งานต้องส่ง!',
                    activeClass:
                      'bg-gradient-to-r from-orange-500 to-rose-500 text-white border-orange-500',
                    cat: 'cat-submit',
                  },
                  {
                    type: 'meeting',
                    label: 'นัดหมาย',
                    activeClass: 'bg-violet-600 text-white border-violet-600',
                    cat: 'cat-meeting',
                  },
                ] as const
              ).map((opt) => {
                const active = taskType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => {
                      setTaskType(opt.type);
                      if (!initialTask) {
                        setCategoryId(opt.cat);
                        if (opt.type === 'submission') {
                          setReminderOffsets([0, 15, 30]);
                        }
                      }
                    }}
                    className={`min-h-12 rounded-2xl border-2 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 px-2 transition-colors cursor-pointer ${
                      active
                        ? `${opt.activeClass} shadow-sm`
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {opt.type === 'submission' && (
                      <PaperPlaneTilt size={16} weight="fill" aria-hidden="true" />
                    )}
                    {opt.type === 'meeting' && (
                      <UsersThree size={16} weight="fill" aria-hidden="true" />
                    )}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Title */}
          <div>
            <label
              htmlFor="task-title-input"
              className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase mb-1.5"
            >
              ชื่องาน / สิ่งที่ต้องทำหรือต้องส่ง *
            </label>
            <input
              id="task-title-input"
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                taskType === 'submission'
                  ? 'เช่น ส่งรายงานสรุปยอดขายเดือนนี้, ส่งไฟล์ดราฟต์ลูกค้า...'
                  : 'เช่น เตรียมสไลด์พรีเซนต์, เช็กสต๊อกสินค้า...'
              }
              className="w-full min-h-12 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-orange-500 focus:bg-white dark:focus:bg-slate-900 text-base font-bold text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* 3. Submission Extra Fields */}
          {taskType === 'submission' && (
            <div className="rounded-3xl bg-orange-50 dark:bg-orange-950/30 border-2 border-orange-200 dark:border-orange-500/30 p-4 space-y-3">
              <div className="text-xs font-extrabold text-orange-800 dark:text-orange-200">
                ข้อมูลกันลืมสำหรับงานที่ต้องส่ง (จะแนบไปกับแจ้งเตือนด้วย!)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="sub-recipient"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    ส่งให้ใคร / ช่องทางไหน
                  </label>
                  <input
                    id="sub-recipient"
                    type="text"
                    value={submissionRecipient}
                    onChange={(e) => setSubmissionRecipient(e.target.value)}
                    placeholder="เช่น คุณพลอย (LINE), ระบบ LMS"
                    className="w-full min-h-11 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-orange-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sub-link"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    ลิงก์ไฟล์งาน / โฟลเดอร์ส่งงาน
                  </label>
                  <input
                    id="sub-link"
                    type="url"
                    value={submissionLink}
                    onChange={(e) => setSubmissionLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full min-h-11 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-orange-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. Date & Time + Quick Time Chips */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="task-date"
                  className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase mb-1.5"
                >
                  วันที่
                </label>
                <input
                  id="task-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full min-h-11 px-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label
                  htmlFor="task-time"
                  className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase mb-1.5"
                >
                  เวลาเตือน / เวลาส่ง
                </label>
                <input
                  id="task-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full min-h-11 px-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label
                  htmlFor="task-end-time"
                  className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase mb-1.5"
                >
                  เวลาสิ้นสุด (ถ้ามี)
                </label>
                <input
                  id="task-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full min-h-11 px-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Quick Time Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 mr-1">
                <Clock size={14} weight="bold" aria-hidden="true" />
                <span>เลือกเวลาด่วน:</span>
              </span>
              <button
                type="button"
                onClick={() => applyPlusMinutes(30)}
                className="min-h-8 px-3 rounded-xl bg-orange-100 hover:bg-orange-200 dark:bg-orange-500/20 text-orange-800 dark:text-orange-200 text-xs font-extrabold cursor-pointer"
              >
                +30 นาที
              </button>
              {['09:00', '12:00', '14:00', '16:30', '18:00', '20:00'].map(
                (preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setScheduledTime(preset)}
                    className={`min-h-8 px-3 rounded-xl text-xs font-bold cursor-pointer ${
                      scheduledTime === preset
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {preset}
                  </button>
                )
              )}
              {scheduledTime && (
                <button
                  type="button"
                  onClick={() => {
                    setScheduledTime('');
                    setEndTime('');
                  }}
                  className="min-h-8 px-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                >
                  ล้างเวลา
                </button>
              )}
            </div>
          </div>

          {/* 5. Multi-stage Notification Offsets (shown when scheduledTime is set) */}
          {scheduledTime && (
            <div className="rounded-3xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 p-4">
              <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900 dark:text-amber-200 mb-2.5">
                <Bell size={16} weight="fill" aria-hidden="true" />
                <span>จังหวะการเด้งเตือน (เลือกได้หลายช่วง)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {REMINDER_OPTIONS.map((opt) => {
                  const selected = reminderOffsets.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleReminderOffset(opt.value)}
                      aria-pressed={selected}
                      className={`min-h-9 px-3.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        selected
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {selected && <Check size={14} weight="bold" aria-hidden="true" />}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Priority, Category, Recurrence */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="task-priority"
                className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase mb-1.5"
              >
                ความสำคัญ
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full min-h-11 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
              >
                <option value="urgent">ด่วนมาก (Urgent)</option>
                <option value="high">สำคัญ (High)</option>
                <option value="normal">ปกติ (Normal)</option>
                <option value="low">ชิลล์ (Low)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="task-category"
                className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase mb-1.5"
              >
                หมวดหมู่สี
              </label>
              <select
                id="task-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full min-h-11 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="task-recurrence"
                className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase mb-1.5"
              >
                ทำซ้ำอัตโนมัติ
              </label>
              <select
                id="task-recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                className="w-full min-h-11 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
              >
                <option value="none">ไม่ทำซ้ำ</option>
                <option value="daily">ทำซ้ำทุกวัน</option>
                <option value="weekdays">ทุกวันจันทร์ – ศุกร์</option>
                <option value="weekly">ทำซ้ำทุกสัปดาห์</option>
              </select>
            </div>
          </div>

          {/* 7. Subtasks Builder */}
          <div>
            <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase mb-1.5">
              ขั้นตอนย่อย / Checklist
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="พิมพ์ขั้นตอนย่อยแล้วกด + หรือ Enter..."
                className="flex-1 min-h-11 px-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                aria-label="เพิ่มขั้นตอนย่อย"
                className="min-w-11 min-h-11 px-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-sm inline-flex items-center justify-center cursor-pointer"
              >
                <Plus size={18} weight="bold" aria-hidden="true" />
              </button>
            </div>

            {subtasks.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {subtasks.map((st) => (
                  <li
                    key={st.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 text-sm"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {st.title}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSubtasks((prev) => prev.filter((x) => x.id !== st.id))
                      }
                      aria-label={`ลบขั้นตอนย่อย ${st.title}`}
                      className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash size={16} weight="bold" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 8. Notes */}
          <div>
            <label
              htmlFor="task-desc"
              className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase mb-1.5"
            >
              โน้ตเพิ่มเติม
            </label>
            <textarea
              id="task-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="รายละเอียดเสริม หรือสิ่งที่ต้องระวัง..."
              className="w-full p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-12 px-7 rounded-2xl bg-gradient-to-r from-orange-500 via-rose-500 to-violet-600 hover:opacity-95 disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-orange-500/25 cursor-pointer"
            >
              {saving ? 'กำลังบันทึก...' : initialTask ? 'บันทึกการแก้ไข' : 'บันทึกงานลงตาราง'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
