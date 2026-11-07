import type { DayPulseRepository } from './db.ts';
import type { NotificationDispatcher } from './notifications.ts';
import {
  addDaysToDateStr,
  getZonedParts,
  timeStrToMinutes,
} from '../src/shared/dateUtils.ts';
import type { Task } from '../src/shared/schema.ts';

export class ReminderScheduler {
  private repo: DayPulseRepository;
  private dispatcher: NotificationDispatcher;
  private timer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private onTasksMutated?: () => void;

  constructor(
    repo: DayPulseRepository,
    dispatcher: NotificationDispatcher,
    onTasksMutated?: () => void
  ) {
    this.repo = repo;
    this.dispatcher = dispatcher;
    this.onTasksMutated = onTasksMutated;
  }

  public start(intervalMs = 15_000): void {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async tick(now: Date = new Date()): Promise<number> {
    if (this.isRunning) return 0;
    this.isRunning = true;
    let firedCount = 0;

    try {
      const settings = this.repo.getRawSettings();
      const zoned = getZonedParts(now, settings.timezone);
      const todayStr = zoned.dateStr;
      const tomorrowStr = addDaysToDateStr(todayStr, 1);
      const nowMinutes = zoned.hour * 60 + zoned.minute;

      // 1. Morning Daily Briefing
      if (settings.morningBriefingEnabled) {
        const briefingMinutes = timeStrToMinutes(settings.morningBriefingTime);
        const briefingTriggerKey = `briefing:${todayStr}`;
        if (
          nowMinutes >= briefingMinutes &&
          nowMinutes <= briefingMinutes + 10 &&
          !this.repo.hasTriggerFired(briefingTriggerKey)
        ) {
          const todayPending = this.repo.listTasks({
            date: todayStr,
            status: 'pending',
          });
          const allPendingBeforeToday = this.repo
            .listTasks({ status: 'pending', toDate: addDaysToDateStr(todayStr, -1) });

          if (todayPending.length > 0 || allPendingBeforeToday.length > 0) {
            const submissions = todayPending.filter(
              (t) => t.taskType === 'submission'
            );
            const firstTimed = todayPending.find((t) => t.scheduledTime !== null);
            const lines: string[] = [
              `วันนี้มีงานทั้งหมด ${todayPending.length} รายการ (งานต้องส่ง ${submissions.length} ชิ้น)`,
            ];
            if (allPendingBeforeToday.length > 0) {
              lines.push(`มีงานค้างจากวันก่อน ${allPendingBeforeToday.length} รายการ`);
            }
            if (firstTimed) {
              lines.push(
                `เริ่มชิ้นแรกเวลา ${firstTimed.scheduledTime} — ${firstTimed.title}`
              );
            }

            const res = await this.dispatcher.dispatch({
              triggerKey: briefingTriggerKey,
              taskId: null,
              title: `สรุปตารางงานวันนี้ (${todayStr})`,
              body: lines.join(' • '),
              taskType: 'briefing',
              url: '/',
            });
            if (res.logged) firedCount++;
          }
        }
      }

      // 2. Scheduled Task Offset Reminders (Today + Tomorrow across midnight)
      const candidateTasks = this.repo.listTasks({
        fromDate: todayStr,
        toDate: tomorrowStr,
        status: 'pending',
      });

      for (const task of candidateTasks) {
        if (!task.scheduledTime) continue;

        const dayOffsetMinutes = task.scheduledDate === todayStr ? 0 : 1440;
        const taskMinutes =
          dayOffsetMinutes + timeStrToMinutes(task.scheduledTime);

        for (const offset of task.reminderOffsets) {
          const triggerMinutes = taskMinutes - offset;
          if (nowMinutes >= triggerMinutes && nowMinutes <= triggerMinutes + 3) {
            const triggerKey = `task:${task.id}:${task.scheduledDate}:${task.scheduledTime}:offset:${offset}`;
            if (this.repo.hasTriggerFired(triggerKey)) continue;

            const { title, body } = this.formatTaskReminder(task, offset);
            const res = await this.dispatcher.dispatch({
              triggerKey,
              taskId: task.id,
              title,
              body,
              taskType: task.taskType,
              submissionLink: task.submissionLink || undefined,
              submissionRecipient: task.submissionRecipient || undefined,
              url: `/?taskId=${task.id}`,
            });
            if (res.logged) firedCount++;
          }
        }
      }

      // 3. Snoozed Tasks
      const pendingTasks = this.repo.listTasks({ status: 'pending' });
      let snoozeCleared = false;
      for (const task of pendingTasks) {
        if (!task.snoozedUntil) continue;
        const snoozeMs = new Date(task.snoozedUntil).getTime();
        if (Number.isFinite(snoozeMs) && snoozeMs <= now.getTime()) {
          const triggerKey = `snooze:${task.id}:${task.snoozedUntil}`;
          this.repo.updateTask(task.id, { snoozedUntil: null });
          snoozeCleared = true;

          const res = await this.dispatcher.dispatch({
            triggerKey,
            taskId: task.id,
            title:
              task.taskType === 'submission'
                ? `ครบเวลาเตือนซ้ำ: ต้องส่งงาน!`
                : `ครบเวลาเลื่อนเตือน (Snooze)`,
            body: `${task.title}${task.submissionRecipient ? ` • ส่งให้: ${task.submissionRecipient}` : ''}`,
            taskType: task.taskType,
            submissionLink: task.submissionLink || undefined,
            submissionRecipient: task.submissionRecipient || undefined,
            url: `/?taskId=${task.id}`,
          });
          if (res.logged) firedCount++;
        }
      }

      if (snoozeCleared && this.onTasksMutated) {
        this.onTasksMutated();
      }
    } finally {
      this.isRunning = false;
    }

    return firedCount;
  }

  private formatTaskReminder(
    task: Task,
    offsetMinutes: number
  ): { title: string; body: string } {
    const timeLabel = task.endTime
      ? `${task.scheduledTime}–${task.endTime}`
      : `${task.scheduledTime}`;

    if (offsetMinutes === 0) {
      if (task.taskType === 'submission') {
        return {
          title: `ถึงเวลาส่งงานแล้ว! (${task.scheduledTime})`,
          body: `${task.title}${task.submissionRecipient ? ` • ส่งให้: ${task.submissionRecipient}` : ''}`,
        };
      }
      if (task.taskType === 'meeting') {
        return {
          title: `ถึงเวลานัดหมาย (${timeLabel})`,
          body: task.title,
        };
      }
      return {
        title: `ถึงเวลาลงมือทำ (${timeLabel})`,
        body: task.title,
      };
    }

    // Heads-up before exact time
    if (task.taskType === 'submission') {
      return {
        title: `อีก ${offsetMinutes} นาที ถึงกำหนดส่งงาน!`,
        body: `${task.scheduledTime} — ${task.title}${task.submissionRecipient ? ` (${task.submissionRecipient})` : ''}`,
      };
    }
    if (task.taskType === 'meeting') {
      return {
        title: `อีก ${offsetMinutes} นาที มีนัดหมาย`,
        body: `${timeLabel} — ${task.title}`,
      };
    }
    return {
      title: `เตรียมตัวอีก ${offsetMinutes} นาที (${task.scheduledTime})`,
      body: task.title,
    };
  }
}
