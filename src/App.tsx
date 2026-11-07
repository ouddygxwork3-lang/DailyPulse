import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellRinging,
  CalendarBlank,
  CheckCircle,
  CloudCheck,
  CloudSlash,
  Lightning,
  ListChecks,
  Moon,
  PaperPlaneTilt,
  Plus,
  Stack,
  Sun,
} from '@phosphor-icons/react';
import type {
  AppSettingsPublic,
  Category,
  CreateRoutineTemplateInput,
  CreateTaskInput,
  LiveNotificationPayload,
  NotificationLogItem,
  RoutineTemplate,
  Task,
  TaskType,
} from './shared/schema.ts';
import { formatThaiDate, getZonedParts } from './shared/dateUtils.ts';
import {
  api,
  getStoredToken,
  loadCachedBootstrap,
  setStoredToken,
} from './lib/api.ts';
import { registerServiceWorker } from './lib/pushClient.ts';
import { playCompleteSound, playReminderSound } from './lib/sound.ts';
import { PinLockScreen } from './components/PinLockScreen.tsx';
import { TodayTimelineView } from './components/TodayTimelineView.tsx';
import { SubmissionsRadarView } from './components/SubmissionsRadarView.tsx';
import { CalendarUpcomingView } from './components/CalendarUpcomingView.tsx';
import { TaskFormModal } from './components/TaskFormModal.tsx';
import { BrainDumpModal } from './components/BrainDumpModal.tsx';
import { RoutineTemplatesDrawer } from './components/RoutineTemplatesDrawer.tsx';
import { FocusTimerWidget } from './components/FocusTimerWidget.tsx';
import { NotificationSettingsModal } from './components/NotificationSettingsModal.tsx';
import { InAppAlertBanner } from './components/InAppAlertBanner.tsx';

type ActiveTab = 'today' | 'submissions' | 'calendar';

export const App: React.FC = () => {
  const [authLoading, setAuthLoading] = useState(true);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('daypulse_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [onlineSync, setOnlineSync] = useState(true);

  const [settings, setSettings] = useState<AppSettingsPublic>({
    pinConfigured: true,
    vapidPublicKey: '',
    telegramEnabled: false,
    telegramConfigured: false,
    telegramChatId: '',
    telegramBotTokenMasked: '',
    morningBriefingEnabled: true,
    morningBriefingTime: '08:00',
    soundEnabled: true,
    timezone: 'Asia/Bangkok',
    pushSubscriptionCount: 0,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [notifications, setNotifications] = useState<NotificationLogItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Modals & Overlays
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalDefaultDate, setModalDefaultDate] = useState<string>('');
  const [modalDefaultType, setModalDefaultType] = useState<TaskType>('todo');

  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [liveAlert, setLiveAlert] = useState<LiveNotificationPayload | null>(
    null
  );

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('daypulse_theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [darkMode]);

  // Register PWA Service Worker on mount
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  const refreshBootstrap = useCallback(async () => {
    try {
      const data = await api.getBootstrap();
      setSettings(data.settings);
      setCategories(data.categories);
      setTemplates(data.templates);
      setNotifications(data.notifications);
      setTasks(data.tasks);
      setOnlineSync(true);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        setStoredToken(null);
        setAuthenticated(false);
        return;
      }
      setOnlineSync(false);
      const cached = loadCachedBootstrap();
      if (cached) {
        setSettings(cached.settings);
        setCategories(cached.categories);
        setTemplates(cached.templates);
        setNotifications(cached.notifications);
        setTasks(cached.tasks);
      }
    }
  }, []);

  // Initial Auth Check
  useEffect(() => {
    void (async () => {
      try {
        const status = await api.getAuthStatus();
        setPinConfigured(status.pinConfigured);
        setAuthenticated(status.authenticated);
        if (status.authenticated) {
          await refreshBootstrap();
        }
      } catch {
        const cached = loadCachedBootstrap();
        if (cached && getStoredToken()) {
          setPinConfigured(true);
          setAuthenticated(true);
          setSettings(cached.settings);
          setCategories(cached.categories);
          setTemplates(cached.templates);
          setNotifications(cached.notifications);
          setTasks(cached.tasks);
          setOnlineSync(false);
        }
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [refreshBootstrap]);

  // Real-time SSE Cross-Device Sync & Live In-App Notifications
  useEffect(() => {
    if (!authenticated) return;
    const token = getStoredToken();
    if (!token) return;

    const es = new EventSource(
      `/api/events?token=${encodeURIComponent(token)}`
    );

    es.addEventListener('connected', () => {
      setOnlineSync(true);
    });

    es.addEventListener('sync', () => {
      void refreshBootstrap();
    });

    es.addEventListener('notification', (event) => {
      try {
        const payload = JSON.parse(
          (event as MessageEvent).data
        ) as LiveNotificationPayload;
        setLiveAlert(payload);
        playReminderSound(payload.taskType, settings.soundEnabled);
        void refreshBootstrap();
      } catch {
        // ignore malformed event
      }
    });

    es.onerror = () => {
      setOnlineSync(false);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshBootstrap();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      es.close();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [authenticated, refreshBootstrap, settings.soundEnabled]);

  const todayDateStr = useMemo(
    () => getZonedParts(new Date(), settings.timezone).dateStr,
    [settings.timezone]
  );

  // ==================== TASK HANDLERS ====================

  const handleSaveTask = async (
    input: CreateTaskInput,
    existingId?: string
  ) => {
    if (existingId) {
      await api.updateTask(existingId, input);
    } else {
      await api.createTask(input);
    }
    await refreshBootstrap();
  };

  const handleToggleComplete = async (task: Task) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    if (nextStatus === 'completed') {
      playCompleteSound(settings.soundEnabled);
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );
    await api.updateTask(task.id, { status: nextStatus });
    await refreshBootstrap();
  };

  const handleToggleCompleteById = async (taskId: string) => {
    const found = tasks.find((t) => t.id === taskId);
    if (found) {
      await handleToggleComplete(found);
    } else {
      playCompleteSound(settings.soundEnabled);
      await api.updateTask(taskId, { status: 'completed' });
      await refreshBootstrap();
    }
  };

  const handleToggleSubtask = async (task: Task, subtaskId: string) => {
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, subtasks: updatedSubtasks } : t
      )
    );
    await api.updateTask(task.id, { subtasks: updatedSubtasks });
    await refreshBootstrap();
  };

  const handleSnooze = async (task: Task, minutes: number) => {
    await api.snoozeTask(task.id, minutes);
    await refreshBootstrap();
  };

  const handleSnoozeById = async (taskId: string, minutes: number) => {
    await api.snoozeTask(taskId, minutes);
    await refreshBootstrap();
  };

  const handleDeleteTask = async (task: Task) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    await api.deleteTask(task.id);
    await refreshBootstrap();
  };

  const handleRolloverOverdue = async () => {
    await api.rolloverOverdue(todayDateStr);
    await refreshBootstrap();
  };

  const handleSaveBulk = async (bulkTasks: CreateTaskInput[]) => {
    await api.createBulkTasks(bulkTasks);
    await refreshBootstrap();
  };

  const handleApplyTemplate = async (templateId: string, dateStr: string) => {
    await api.applyTemplate(templateId, dateStr);
    await refreshBootstrap();
  };

  const handleSaveTodayTemplate = async (input: CreateRoutineTemplateInput) => {
    await api.createTemplate(input);
    await refreshBootstrap();
  };

  const handleDeleteTemplate = async (templateId: string) => {
    await api.deleteTemplate(templateId);
    await refreshBootstrap();
  };

  const openNewTaskModal = (
    dateStr = todayDateStr,
    defaultType: TaskType = 'todo'
  ) => {
    setEditingTask(null);
    setModalDefaultDate(dateStr);
    setModalDefaultType(defaultType);
    setTaskModalOpen(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-daypulse-mesh flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-gradient-to-br from-orange-500 to-violet-600 animate-pulse" />
          <p className="text-sm font-extrabold text-slate-600 dark:text-slate-300">
            กำลังโหลดตารางงาน DayPulse...
          </p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <PinLockScreen
        pinConfigured={pinConfigured}
        onAuthenticated={async () => {
          setPinConfigured(true);
          setAuthenticated(true);
          await refreshBootstrap();
        }}
      />
    );
  }

  const pendingSubmissionsCount = tasks.filter(
    (t) => t.status === 'pending' && t.taskType === 'submission'
  ).length;
  const todayPendingCount = tasks.filter(
    (t) => t.status === 'pending' && t.scheduledDate === todayDateStr
  ).length;

  return (
    <div className="min-h-screen bg-daypulse-mesh text-slate-900 dark:text-white flex flex-col lg:flex-row">
      {/* Live In-App Notification Banner */}
      <InAppAlertBanner
        alert={liveAlert}
        onDismiss={() => setLiveAlert(null)}
        onCompleteTask={handleToggleCompleteById}
        onSnoozeTask={handleSnoozeById}
      />

      {/* ==================== DESKTOP SIDEBAR (PC) ==================== */}
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800 p-5 justify-between">
        <div className="space-y-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 via-rose-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/25">
              <CheckCircle size={28} weight="fill" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">DayPulse</h1>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                PC • iOS • Android Sync
              </p>
            </div>
          </div>

          {/* Primary Quick Add Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => openNewTaskModal(todayDateStr, 'todo')}
              className="w-full min-h-12 rounded-2xl bg-gradient-to-r from-orange-500 via-rose-500 to-pink-600 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 cursor-pointer"
            >
              <Plus size={20} weight="bold" aria-hidden="true" />
              <span>เพิ่มงาน / กำหนดส่ง</span>
            </button>
            <button
              type="button"
              onClick={() => setBrainDumpOpen(true)}
              className="w-full min-h-11 rounded-2xl bg-violet-100 hover:bg-violet-200 dark:bg-violet-500/20 dark:hover:bg-violet-500/30 text-violet-900 dark:text-violet-200 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Lightning size={16} weight="fill" aria-hidden="true" />
              <span>พิมพ์รวดเดียวหลายบรรทัด</span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav aria-label="เมนูหลัก" className="space-y-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className={`w-full min-h-12 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-between transition-colors cursor-pointer ${
                activeTab === 'today'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="inline-flex items-center gap-3">
                <ListChecks size={21} weight="fill" aria-hidden="true" />
                <span>ตารางงานวันนี้</span>
              </span>
              {todayPendingCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-500 text-white">
                  {todayPendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('submissions')}
              className={`w-full min-h-12 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-between transition-colors cursor-pointer ${
                activeTab === 'submissions'
                  ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-orange-50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="inline-flex items-center gap-3">
                <PaperPlaneTilt size={21} weight="fill" aria-hidden="true" />
                <span>เช็กงานที่ต้องส่ง</span>
              </span>
              {pendingSubmissionsCount > 0 && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                    activeTab === 'submissions'
                      ? 'bg-white text-rose-600'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-500/25 dark:text-rose-200'
                  }`}
                >
                  {pendingSubmissionsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`w-full min-h-12 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-between transition-colors cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="inline-flex items-center gap-3">
                <CalendarBlank size={21} weight="fill" aria-hidden="true" />
                <span>ปฏิทิน & ล่วงหน้า</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTemplatesOpen(true)}
              className="w-full min-h-12 px-4 rounded-2xl font-extrabold text-sm flex items-center gap-3 text-slate-700 hover:bg-sky-50 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Stack
                size={21}
                weight="duotone"
                className="text-sky-600 dark:text-sky-400"
                aria-hidden="true"
              />
              <span>เทมเพลตประจำวัน</span>
            </button>
          </nav>
        </div>

        {/* Bottom Sidebar Controls */}
        <div className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="w-full min-h-12 px-4 rounded-2xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/15 dark:hover:bg-orange-500/25 text-orange-900 dark:text-orange-200 font-extrabold text-sm flex items-center justify-between cursor-pointer"
          >
            <span className="inline-flex items-center gap-2.5">
              <BellRinging size={20} weight="fill" aria-hidden="true" />
              <span>ตั้งค่าแจ้งเตือน</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded-lg bg-white/80 dark:bg-slate-900/80">
              {settings.pushSubscriptionCount} เครื่อง
            </span>
          </button>

          <div className="flex items-center justify-between px-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
              {onlineSync ? (
                <>
                  <CloudCheck
                    size={17}
                    weight="fill"
                    className="text-emerald-500"
                    aria-hidden="true"
                  />
                  <span>ซิงค์ออนไลน์สด</span>
                </>
              ) : (
                <>
                  <CloudSlash
                    size={17}
                    weight="fill"
                    className="text-amber-500"
                    aria-hidden="true"
                  />
                  <span>โหมดออฟไลน์</span>
                </>
              )}
            </span>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
              className="min-w-10 min-h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer"
            >
              {darkMode ? (
                <Sun size={19} weight="fill" className="text-amber-400" aria-hidden="true" />
              ) : (
                <Moon size={19} weight="fill" className="text-indigo-600" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT AREA ==================== */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen">
        {/* Sticky Responsive Top Header */}
        <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/80 px-4 sm:px-8 py-3.5 safe-top">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="lg:hidden w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-violet-600 text-white flex items-center justify-center">
                  <CheckCircle size={19} weight="fill" aria-hidden="true" />
                </span>
                <h2 className="text-lg sm:text-xl font-black tracking-tight">
                  {activeTab === 'today'
                    ? 'ภารกิจวันนี้ (Today)'
                    : activeTab === 'submissions'
                      ? 'เช็กงานที่ต้องส่ง (Submissions)'
                      : 'ปฏิทินและงานล่วงหน้า'}
                </h2>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                {formatThaiDate(todayDateStr)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                aria-label={darkMode ? 'สลับโหมดสว่าง' : 'สลับโหมดมืด'}
                className="lg:hidden min-w-11 min-h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer"
              >
                {darkMode ? (
                  <Sun size={20} weight="fill" className="text-amber-400" aria-hidden="true" />
                ) : (
                  <Moon size={20} weight="fill" className="text-indigo-600" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="เปิดตั้งค่าการแจ้งเตือน"
                className="min-h-11 px-3.5 rounded-2xl bg-orange-100 hover:bg-orange-200 dark:bg-orange-500/20 text-orange-900 dark:text-orange-200 font-extrabold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <BellRinging size={19} weight="fill" aria-hidden="true" />
                <span className="hidden sm:inline">ตั้งค่าแจ้งเตือน</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main View Container */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-6 pb-safe-nav lg:pb-12">
          {activeTab === 'today' && (
            <TodayTimelineView
              todayDateStr={todayDateStr}
              allTasks={tasks}
              categories={categories}
              timezone={settings.timezone}
              onToggleComplete={handleToggleComplete}
              onToggleSubtask={handleToggleSubtask}
              onEdit={(t) => {
                setEditingTask(t);
                setTaskModalOpen(true);
              }}
              onDelete={handleDeleteTask}
              onSnooze={handleSnooze}
              onStartFocus={(t) => setFocusTask(t)}
              onRolloverOverdue={handleRolloverOverdue}
              onOpenNewTask={() => openNewTaskModal(todayDateStr, 'todo')}
              onOpenBrainDump={() => setBrainDumpOpen(true)}
              onOpenTemplates={() => setTemplatesOpen(true)}
            />
          )}

          {activeTab === 'submissions' && (
            <SubmissionsRadarView
              todayDateStr={todayDateStr}
              allTasks={tasks}
              categories={categories}
              onToggleComplete={handleToggleComplete}
              onToggleSubtask={handleToggleSubtask}
              onEdit={(t) => {
                setEditingTask(t);
                setTaskModalOpen(true);
              }}
              onDelete={handleDeleteTask}
              onSnooze={handleSnooze}
              onStartFocus={(t) => setFocusTask(t)}
              onCreateSubmission={() =>
                openNewTaskModal(todayDateStr, 'submission')
              }
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarUpcomingView
              todayDateStr={todayDateStr}
              allTasks={tasks}
              categories={categories}
              onToggleComplete={handleToggleComplete}
              onToggleSubtask={handleToggleSubtask}
              onEdit={(t) => {
                setEditingTask(t);
                setTaskModalOpen(true);
              }}
              onDelete={handleDeleteTask}
              onSnooze={handleSnooze}
              onStartFocus={(t) => setFocusTask(t)}
              onCreateForDate={(d) => openNewTaskModal(d, 'todo')}
            />
          )}
        </main>
      </div>

      {/* ==================== MOBILE BOTTOM NAVIGATION (iOS & Android) ==================== */}
      <nav
        aria-label="เมนูด้านล่างสำหรับมือถือ"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-2 pt-1.5 safe-bottom"
      >
        <div className="grid grid-cols-5 items-center gap-1 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`min-h-13 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold cursor-pointer ${
              activeTab === 'today'
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <ListChecks size={22} weight="fill" aria-hidden="true" />
            <span>วันนี้</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={`min-h-13 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold relative cursor-pointer ${
              activeTab === 'submissions'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <PaperPlaneTilt size={22} weight="fill" aria-hidden="true" />
            <span>งานส่ง</span>
            {pendingSubmissionsCount > 0 && (
              <span className="absolute top-1 right-2.5 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center">
                {pendingSubmissionsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setBrainDumpOpen(true)}
            aria-label="พิมพ์เพิ่มงานด่วนหลายบรรทัด"
            className="min-h-13 rounded-2xl bg-gradient-to-br from-orange-500 via-rose-500 to-violet-600 text-white flex flex-col items-center justify-center shadow-md shadow-orange-500/25 cursor-pointer"
          >
            <Lightning size={22} weight="fill" aria-hidden="true" />
            <span className="text-[10px] font-extrabold">พิมพ์ด่วน</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`min-h-13 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold cursor-pointer ${
              activeTab === 'calendar'
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <CalendarBlank size={22} weight="fill" aria-hidden="true" />
            <span>ปฏิทิน</span>
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="min-h-13 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 cursor-pointer"
          >
            <BellRinging size={22} weight="fill" aria-hidden="true" />
            <span>แจ้งเตือน</span>
          </button>
        </div>
      </nav>

      {/* ==================== MODALS & WIDGETS ==================== */}
      <TaskFormModal
        isOpen={taskModalOpen}
        initialTask={editingTask}
        defaultDate={modalDefaultDate || todayDateStr}
        defaultTaskType={modalDefaultType}
        categories={categories}
        timezone={settings.timezone}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
      />

      <BrainDumpModal
        isOpen={brainDumpOpen}
        defaultDate={todayDateStr}
        onClose={() => setBrainDumpOpen(false)}
        onSaveBulk={handleSaveBulk}
      />

      <RoutineTemplatesDrawer
        isOpen={templatesOpen}
        templates={templates}
        todayTasks={tasks.filter((t) => t.scheduledDate === todayDateStr)}
        targetDate={todayDateStr}
        onClose={() => setTemplatesOpen(false)}
        onApplyTemplate={handleApplyTemplate}
        onSaveTodayAsTemplate={handleSaveTodayTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />

      <FocusTimerWidget
        activeTask={focusTask}
        soundEnabled={settings.soundEnabled}
        onClose={() => setFocusTask(null)}
        onCompleteTask={handleToggleComplete}
      />

      <NotificationSettingsModal
        isOpen={settingsOpen}
        settings={settings}
        notifications={notifications}
        onClose={() => setSettingsOpen(false)}
        onSettingsUpdated={(next) => setSettings(next)}
        onNotificationsUpdated={(logs) => setNotifications(logs)}
        onLogout={async () => {
          await api.logout();
          setSettingsOpen(false);
          setAuthenticated(false);
        }}
      />
    </div>
  );
};
export default App;
