import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import webPush from 'web-push';
import type {
  AppSettingsPublic,
  Category,
  CreateRoutineTemplateInput,
  CreateTaskInput,
  NotificationLogItem,
  RoutineTemplate,
  Subtask,
  Task,
  TaskType,
  UpdateSettingsInput,
  UpdateTaskInput,
} from '../src/shared/schema.ts';
import { getNextRecurrenceDate } from '../src/shared/dateUtils.ts';

export interface StoredSettings {
  pinHash: string | null;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  morningBriefingEnabled: boolean;
  morningBriefingTime: string;
  soundEnabled: boolean;
  timezone: string;
}

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceLabel: string;
  createdAt: string;
}

function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPinHash(pin: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(pin, salt, 32);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export class DayPulseRepository {
  public readonly db: DatabaseSync;

  constructor(dbPath = ':memory:') {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initSchema();
    this.seedDefaults();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        pin_hash TEXT,
        vapid_public_key TEXT NOT NULL,
        vapid_private_key TEXT NOT NULL,
        telegram_enabled INTEGER NOT NULL DEFAULT 0,
        telegram_bot_token TEXT NOT NULL DEFAULT '',
        telegram_chat_id TEXT NOT NULL DEFAULT '',
        morning_briefing_enabled INTEGER NOT NULL DEFAULT 1,
        morning_briefing_time TEXT NOT NULL DEFAULT '08:00',
        sound_enabled INTEGER NOT NULL DEFAULT 1,
        timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok'
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        device_name TEXT NOT NULL DEFAULT 'Device',
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color_key TEXT NOT NULL,
        icon_name TEXT NOT NULL DEFAULT 'FolderNotch',
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        task_type TEXT NOT NULL DEFAULT 'todo',
        submission_recipient TEXT NOT NULL DEFAULT '',
        submission_link TEXT NOT NULL DEFAULT '',
        scheduled_date TEXT NOT NULL,
        scheduled_time TEXT,
        end_time TEXT,
        priority TEXT NOT NULL DEFAULT 'normal',
        category_id TEXT NOT NULL DEFAULT 'cat-work',
        status TEXT NOT NULL DEFAULT 'pending',
        completed_at TEXT,
        recurrence TEXT NOT NULL DEFAULT 'none',
        reminder_offsets TEXT NOT NULL DEFAULT '[0,15]',
        snoozed_until TEXT,
        subtasks TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_date_status ON tasks(scheduled_date, status);
      CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(task_type);

      CREATE TABLE IF NOT EXISTS routine_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        color_key TEXT NOT NULL DEFAULT 'sky',
        icon_name TEXT NOT NULL DEFAULT 'Lightning',
        items TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        device_label TEXT NOT NULL DEFAULT 'Web Device',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notification_logs (
        id TEXT PRIMARY KEY,
        trigger_key TEXT NOT NULL UNIQUE,
        task_id TEXT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        task_type TEXT NOT NULL DEFAULT 'todo',
        channel TEXT NOT NULL DEFAULT 'app',
        sent_at TEXT NOT NULL
      );
    `);
  }

  private seedDefaults(): void {
    const existingSettings = this.db
      .prepare('SELECT id FROM settings WHERE id = 1')
      .get();
    if (!existingSettings) {
      const vapid = webPush.generateVAPIDKeys();
      const envPin = process.env.DAYPULSE_PIN?.trim();
      const initialPinHash =
        envPin && /^\d{4,6}$/.test(envPin) ? hashPin(envPin) : null;

      this.db
        .prepare(
          `INSERT INTO settings (
            id, pin_hash, vapid_public_key, vapid_private_key,
            telegram_enabled, telegram_bot_token, telegram_chat_id,
            morning_briefing_enabled, morning_briefing_time, sound_enabled, timezone
          ) VALUES (1, ?, ?, ?, 0, '', '', 1, '08:00', 1, 'Asia/Bangkok')`
        )
        .run(initialPinHash, vapid.publicKey, vapid.privateKey);
    }

    const catCount = this.db
      .prepare('SELECT COUNT(*) as cnt FROM categories')
      .get() as { cnt: number };
    if (catCount.cnt === 0) {
      const defaultCategories: Category[] = [
        {
          id: 'cat-work',
          name: 'งานหลักระหว่างวัน',
          colorKey: 'sky',
          iconName: 'Briefcase',
          sortOrder: 1,
        },
        {
          id: 'cat-submit',
          name: 'งานต้องส่ง / Deadline',
          colorKey: 'coral',
          iconName: 'PaperPlaneTilt',
          sortOrder: 2,
        },
        {
          id: 'cat-meeting',
          name: 'ประชุม / นัดหมาย',
          colorKey: 'violet',
          iconName: 'UsersThree',
          sortOrder: 3,
        },
        {
          id: 'cat-urgent',
          name: 'ด่วนพิเศษ',
          colorKey: 'rose',
          iconName: 'Fire',
          sortOrder: 4,
        },
        {
          id: 'cat-personal',
          name: 'ภารกิจส่วนตัว',
          colorKey: 'emerald',
          iconName: 'SunHorizon',
          sortOrder: 5,
        },
      ];
      const stmt = this.db.prepare(
        `INSERT INTO categories (id, name, color_key, icon_name, sort_order)
         VALUES (?, ?, ?, ?, ?)`
      );
      for (const c of defaultCategories) {
        stmt.run(c.id, c.name, c.colorKey, c.iconName, c.sortOrder);
      }
    }

    const tplCount = this.db
      .prepare('SELECT COUNT(*) as cnt FROM routine_templates')
      .get() as { cnt: number };
    if (tplCount.cnt === 0) {
      const now = new Date().toISOString();
      const starterTemplates: Array<Omit<RoutineTemplate, 'createdAt'>> = [
        {
          id: 'tpl-workday',
          name: 'ลุยงานวันทำงานปกติ (Workday)',
          description: 'จัดระเบียบเช้า ประชุมบ่าย และเช็กงานส่งท้ายวันครบสูตร',
          colorKey: 'sky',
          iconName: 'RocketLaunch',
          items: [
            {
              title: 'เช็กตารางงานและจัดลำดับ 3 งานสำคัญสุดของวันนี้',
              description: 'ดูรายการงานค้างและเดดไลน์ที่ต้องส่งในวันนี้',
              taskType: 'todo',
              submissionRecipient: '',
              submissionLink: '',
              scheduledTime: '09:00',
              endTime: '09:30',
              priority: 'high',
              categoryId: 'cat-work',
              reminderOffsets: [0],
              subtasks: [
                { title: 'เช็กข้อความ/อีเมลด่วน' },
                { title: 'ล็อกเวลาทำงานยากช่วงเช้า' },
              ],
            },
            {
              title: 'โฟกัสเคลียร์งานหลักช่วงเช้า (Deep Work)',
              description: '',
              taskType: 'todo',
              submissionRecipient: '',
              submissionLink: '',
              scheduledTime: '10:00',
              endTime: '11:30',
              priority: 'urgent',
              categoryId: 'cat-work',
              reminderOffsets: [0, 10],
              subtasks: [],
            },
            {
              title: 'อัปเดตงานทีม / ประสานงานช่วงบ่าย',
              description: '',
              taskType: 'meeting',
              submissionRecipient: '',
              submissionLink: '',
              scheduledTime: '13:30',
              endTime: '14:00',
              priority: 'normal',
              categoryId: 'cat-meeting',
              reminderOffsets: [0, 15],
              subtasks: [],
            },
            {
              title: 'ตรวจเช็กความเรียบร้อยและส่งมอบงานประจำวัน',
              description: 'เช็กไฟล์แนบและอัปเดตสถานะก่อนจบวัน',
              taskType: 'submission',
              submissionRecipient: 'ทีมงาน / ลูกค้า',
              submissionLink: '',
              scheduledTime: '16:30',
              endTime: null,
              priority: 'urgent',
              categoryId: 'cat-submit',
              reminderOffsets: [0, 15, 30],
              subtasks: [
                { title: 'ตรวจสอบความถูกต้องของไฟล์' },
                { title: 'ส่งลิงก์และแจ้งผู้รับเรียบร้อย' },
              ],
            },
          ],
        },
        {
          id: 'tpl-crunch',
          name: 'วันเร่งปิดจ๊อบส่งงานด่วน (Deadline Day)',
          description: 'เน้นเกาะติดเวลาส่งงานเช้า-บ่าย ไม่ให้หลุดแม้แต่ชิ้นเดียว',
          colorKey: 'coral',
          iconName: 'Fire',
          items: [
            {
              title: 'ส่งดราฟต์รอบเช้าให้ตรวจทาน',
              description: '',
              taskType: 'submission',
              submissionRecipient: 'หัวหน้า / ลูกค้า',
              submissionLink: '',
              scheduledTime: '11:00',
              endTime: null,
              priority: 'urgent',
              categoryId: 'cat-submit',
              reminderOffsets: [0, 15, 30],
              subtasks: [],
            },
            {
              title: 'เก็บรายละเอียดแก้ไขตามคอมเมนต์',
              description: '',
              taskType: 'todo',
              submissionRecipient: '',
              submissionLink: '',
              scheduledTime: '13:30',
              endTime: '15:00',
              priority: 'high',
              categoryId: 'cat-urgent',
              reminderOffsets: [0, 15],
              subtasks: [],
            },
            {
              title: 'ส่งงานฉบับสมบูรณ์ (Final Submission)',
              description: 'เช็กลิงก์สิทธิ์การเข้าถึงก่อนกดส่งทุกครั้ง',
              taskType: 'submission',
              submissionRecipient: 'ผู้รับปลายทาง',
              submissionLink: '',
              scheduledTime: '16:00',
              endTime: null,
              priority: 'urgent',
              categoryId: 'cat-submit',
              reminderOffsets: [0, 15, 30, 60],
              subtasks: [],
            },
          ],
        },
      ];

      const stmt = this.db.prepare(
        `INSERT INTO routine_templates (id, name, description, color_key, icon_name, items, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const t of starterTemplates) {
        stmt.run(
          t.id,
          t.name,
          t.description,
          t.colorKey,
          t.iconName,
          JSON.stringify(t.items),
          now
        );
      }
    }
  }

  // ==================== AUTH & SETTINGS ====================

  public getRawSettings(): StoredSettings {
    const row = this.db
      .prepare('SELECT * FROM settings WHERE id = 1')
      .get() as Record<string, unknown>;
    return {
      pinHash: (row.pin_hash as string | null) ?? null,
      vapidPublicKey: String(row.vapid_public_key),
      vapidPrivateKey: String(row.vapid_private_key),
      telegramEnabled: Boolean(row.telegram_enabled),
      telegramBotToken: String(row.telegram_bot_token ?? ''),
      telegramChatId: String(row.telegram_chat_id ?? ''),
      morningBriefingEnabled: Boolean(row.morning_briefing_enabled),
      morningBriefingTime: String(row.morning_briefing_time ?? '08:00'),
      soundEnabled: Boolean(row.sound_enabled),
      timezone: String(row.timezone ?? 'Asia/Bangkok'),
    };
  }

  public getPublicSettings(): AppSettingsPublic {
    const s = this.getRawSettings();
    const subCount = this.db
      .prepare('SELECT COUNT(*) as cnt FROM push_subscriptions')
      .get() as { cnt: number };

    const tokenLen = s.telegramBotToken.length;
    const masked =
      tokenLen > 10
        ? `${s.telegramBotToken.slice(0, 6)}••••••${s.telegramBotToken.slice(-4)}`
        : tokenLen > 0
          ? '••••••••'
          : '';

    return {
      pinConfigured: Boolean(s.pinHash),
      vapidPublicKey: s.vapidPublicKey,
      telegramEnabled: s.telegramEnabled,
      telegramConfigured: Boolean(s.telegramBotToken && s.telegramChatId),
      telegramChatId: s.telegramChatId,
      telegramBotTokenMasked: masked,
      morningBriefingEnabled: s.morningBriefingEnabled,
      morningBriefingTime: s.morningBriefingTime,
      soundEnabled: s.soundEnabled,
      timezone: s.timezone,
      pushSubscriptionCount: subCount.cnt,
    };
  }

  public isPinConfigured(): boolean {
    const s = this.getRawSettings();
    return Boolean(s.pinHash);
  }

  public setupInitialPin(pin: string, deviceName = 'Primary Device'): string {
    if (this.isPinConfigured()) {
      throw new Error('PIN ถูกตั้งค่าไว้แล้ว กรุณาใช้หน้าเข้าสู่ระบบ');
    }
    const hashed = hashPin(pin);
    this.db.prepare('UPDATE settings SET pin_hash = ? WHERE id = 1').run(hashed);
    return this.createSession(deviceName);
  }

  public verifyPinAndCreateSession(
    pin: string,
    deviceName = 'Web Device'
  ): string | null {
    const s = this.getRawSettings();
    if (!s.pinHash) return null;
    if (!verifyPinHash(pin, s.pinHash)) return null;
    return this.createSession(deviceName);
  }

  public createSession(deviceName = 'Web Device'): string {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO sessions (token, device_name, created_at, last_seen_at) VALUES (?, ?, ?, ?)'
      )
      .run(token, deviceName, now, now);
    return token;
  }

  public validateSession(token: string | undefined | null): boolean {
    if (!token) return false;
    const row = this.db
      .prepare('SELECT token FROM sessions WHERE token = ?')
      .get(token);
    if (!row) return false;
    this.db
      .prepare('UPDATE sessions SET last_seen_at = ? WHERE token = ?')
      .run(new Date().toISOString(), token);
    return true;
  }

  public revokeSession(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  public updateSettings(input: UpdateSettingsInput): AppSettingsPublic {
    const current = this.getRawSettings();
    const nextTelegramEnabled =
      input.telegramEnabled ?? current.telegramEnabled;
    const nextBotToken =
      input.telegramBotToken !== undefined
        ? input.telegramBotToken.trim()
        : current.telegramBotToken;
    const nextChatId =
      input.telegramChatId !== undefined
        ? input.telegramChatId.trim()
        : current.telegramChatId;
    const nextBriefingEnabled =
      input.morningBriefingEnabled ?? current.morningBriefingEnabled;
    const nextBriefingTime =
      input.morningBriefingTime ?? current.morningBriefingTime;
    const nextSoundEnabled = input.soundEnabled ?? current.soundEnabled;
    const nextTimezone = input.timezone ?? current.timezone;
    const nextPinHash = input.newPin ? hashPin(input.newPin) : current.pinHash;

    this.db
      .prepare(
        `UPDATE settings SET
          pin_hash = ?,
          telegram_enabled = ?,
          telegram_bot_token = ?,
          telegram_chat_id = ?,
          morning_briefing_enabled = ?,
          morning_briefing_time = ?,
          sound_enabled = ?,
          timezone = ?
         WHERE id = 1`
      )
      .run(
        nextPinHash,
        nextTelegramEnabled ? 1 : 0,
        nextBotToken,
        nextChatId,
        nextBriefingEnabled ? 1 : 0,
        nextBriefingTime,
        nextSoundEnabled ? 1 : 0,
        nextTimezone
      );

    return this.getPublicSettings();
  }

  // ==================== CATEGORIES ====================

  public listCategories(): Category[] {
    const rows = this.db
      .prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC')
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      colorKey: r.color_key as Category['colorKey'],
      iconName: String(r.icon_name),
      sortOrder: Number(r.sort_order),
    }));
  }

  // ==================== TASKS ====================

  private mapTaskRow(r: Record<string, unknown>): Task {
    let reminderOffsets: number[] = [0, 15];
    try {
      const parsed = JSON.parse(String(r.reminder_offsets ?? '[0,15]'));
      if (Array.isArray(parsed)) reminderOffsets = parsed.map(Number);
    } catch {
      reminderOffsets = [0, 15];
    }

    let subtasks: Subtask[] = [];
    try {
      const parsed = JSON.parse(String(r.subtasks ?? '[]'));
      if (Array.isArray(parsed)) subtasks = parsed;
    } catch {
      subtasks = [];
    }

    return {
      id: String(r.id),
      title: String(r.title),
      description: String(r.description ?? ''),
      taskType: (r.task_type as Task['taskType']) ?? 'todo',
      submissionRecipient: String(r.submission_recipient ?? ''),
      submissionLink: String(r.submission_link ?? ''),
      scheduledDate: String(r.scheduled_date),
      scheduledTime: (r.scheduled_time as string | null) ?? null,
      endTime: (r.end_time as string | null) ?? null,
      priority: (r.priority as Task['priority']) ?? 'normal',
      categoryId: String(r.category_id ?? 'cat-work'),
      status: (r.status as Task['status']) ?? 'pending',
      completedAt: (r.completed_at as string | null) ?? null,
      recurrence: (r.recurrence as Task['recurrence']) ?? 'none',
      reminderOffsets,
      snoozedUntil: (r.snoozed_until as string | null) ?? null,
      subtasks,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }

  public listTasks(filters?: {
    date?: string;
    fromDate?: string;
    toDate?: string;
    status?: 'pending' | 'completed';
    taskType?: TaskType;
  }): Task[] {
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (filters?.date) {
      clauses.push('scheduled_date = ?');
      params.push(filters.date);
    }
    if (filters?.fromDate) {
      clauses.push('scheduled_date >= ?');
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      clauses.push('scheduled_date <= ?');
      params.push(filters.toDate);
    }
    if (filters?.status) {
      clauses.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.taskType) {
      clauses.push('task_type = ?');
      params.push(filters.taskType);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `
      SELECT * FROM tasks
      ${whereSql}
      ORDER BY
        scheduled_date ASC,
        CASE WHEN scheduled_time IS NULL THEN 1 ELSE 0 END ASC,
        scheduled_time ASC,
        CASE priority
          WHEN 'urgent' THEN 0
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          ELSE 3
        END ASC,
        created_at ASC
    `;

    const rows = this.db.prepare(sql).all(...params) as Array<
      Record<string, unknown>
    >;
    return rows.map((r) => this.mapTaskRow(r));
  }

  public getTask(id: string): Task | null {
    const row = this.db
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.mapTaskRow(row) : null;
  }

  public createTask(input: CreateTaskInput): Task {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const sortedOffsets = Array.from(new Set(input.reminderOffsets ?? [0, 15])).sort(
      (a, b) => a - b
    );

    this.db
      .prepare(
        `INSERT INTO tasks (
          id, title, description, task_type, submission_recipient, submission_link,
          scheduled_date, scheduled_time, end_time, priority, category_id,
          status, completed_at, recurrence, reminder_offsets, snoozed_until, subtasks,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?, NULL, ?, ?, ?)`
      )
      .run(
        id,
        input.title.trim(),
        input.description ?? '',
        input.taskType ?? 'todo',
        input.submissionRecipient ?? '',
        input.submissionLink ?? '',
        input.scheduledDate,
        input.scheduledTime ?? null,
        input.endTime ?? null,
        input.priority ?? 'normal',
        input.categoryId ?? 'cat-work',
        input.recurrence ?? 'none',
        JSON.stringify(sortedOffsets),
        JSON.stringify(input.subtasks ?? []),
        now,
        now
      );

    return this.getTask(id)!;
  }

  public createBulkTasks(inputs: CreateTaskInput[]): Task[] {
    const created: Task[] = [];
    this.db.exec('BEGIN');
    try {
      for (const item of inputs) {
        created.push(this.createTask(item));
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    return created;
  }

  public updateTask(id: string, patch: UpdateTaskInput): Task | null {
    const existing = this.getTask(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const nextStatus = patch.status ?? existing.status;
    const completedAt =
      nextStatus === 'completed'
        ? existing.completedAt ?? now
        : null;
    const nextSnoozedUntil =
      nextStatus === 'completed'
        ? null
        : patch.snoozedUntil !== undefined
          ? patch.snoozedUntil
          : existing.snoozedUntil;

    const nextOffsets =
      patch.reminderOffsets !== undefined
        ? Array.from(new Set(patch.reminderOffsets)).sort((a, b) => a - b)
        : existing.reminderOffsets;

    this.db
      .prepare(
        `UPDATE tasks SET
          title = ?,
          description = ?,
          task_type = ?,
          submission_recipient = ?,
          submission_link = ?,
          scheduled_date = ?,
          scheduled_time = ?,
          end_time = ?,
          priority = ?,
          category_id = ?,
          status = ?,
          completed_at = ?,
          recurrence = ?,
          reminder_offsets = ?,
          snoozed_until = ?,
          subtasks = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .run(
        patch.title !== undefined ? patch.title.trim() : existing.title,
        patch.description ?? existing.description,
        patch.taskType ?? existing.taskType,
        patch.submissionRecipient ?? existing.submissionRecipient,
        patch.submissionLink ?? existing.submissionLink,
        patch.scheduledDate ?? existing.scheduledDate,
        patch.scheduledTime !== undefined
          ? patch.scheduledTime
          : existing.scheduledTime,
        patch.endTime !== undefined ? patch.endTime : existing.endTime,
        patch.priority ?? existing.priority,
        patch.categoryId ?? existing.categoryId,
        nextStatus,
        completedAt,
        patch.recurrence ?? existing.recurrence,
        JSON.stringify(nextOffsets),
        nextSnoozedUntil,
        JSON.stringify(patch.subtasks ?? existing.subtasks),
        now,
        id
      );

    const updated = this.getTask(id)!;

    // Spawn next recurring instance when transitioning from pending -> completed
    if (
      existing.status === 'pending' &&
      updated.status === 'completed' &&
      updated.recurrence !== 'none'
    ) {
      this.spawnNextRecurringTask(updated);
    }

    return updated;
  }

  private spawnNextRecurringTask(completedTask: Task): Task | null {
    const nextDate = getNextRecurrenceDate(
      completedTask.scheduledDate,
      completedTask.recurrence
    );
    if (!nextDate) return null;

    // Avoid duplicate spawn if already created
    const duplicate = this.db
      .prepare(
        `SELECT id FROM tasks
         WHERE title = ? AND scheduled_date = ? AND recurrence = ? AND status = 'pending'`
      )
      .get(completedTask.title, nextDate, completedTask.recurrence);

    if (duplicate) return null;

    return this.createTask({
      title: completedTask.title,
      description: completedTask.description,
      taskType: completedTask.taskType,
      submissionRecipient: completedTask.submissionRecipient,
      submissionLink: completedTask.submissionLink,
      scheduledDate: nextDate,
      scheduledTime: completedTask.scheduledTime,
      endTime: completedTask.endTime,
      priority: completedTask.priority,
      categoryId: completedTask.categoryId,
      recurrence: completedTask.recurrence,
      reminderOffsets: completedTask.reminderOffsets,
      subtasks: completedTask.subtasks.map((st) => ({
        id: crypto.randomUUID(),
        title: st.title,
        completed: false,
      })),
    });
  }

  public snoozeTask(id: string, minutes = 10): Task | null {
    const existing = this.getTask(id);
    if (!existing) return null;
    const snoozedUntil = new Date(Date.now() + minutes * 60_000).toISOString();
    return this.updateTask(id, { status: 'pending', snoozedUntil });
  }

  public rolloverOverdueTasks(todayDateStr: string): number {
    const now = new Date().toISOString();
    const res = this.db
      .prepare(
        `UPDATE tasks
         SET scheduled_date = ?, snoozed_until = NULL, updated_at = ?
         WHERE status = 'pending' AND scheduled_date < ?`
      )
      .run(todayDateStr, now, todayDateStr);
    return Number(res.changes ?? 0);
  }

  public deleteTask(id: string): boolean {
    const res = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return Number(res.changes ?? 0) > 0;
  }

  // ==================== ROUTINE TEMPLATES ====================

  public listTemplates(): RoutineTemplate[] {
    const rows = this.db
      .prepare('SELECT * FROM routine_templates ORDER BY created_at ASC')
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      description: String(r.description ?? ''),
      colorKey: (r.color_key as RoutineTemplate['colorKey']) ?? 'sky',
      iconName: String(r.icon_name ?? 'Lightning'),
      items: JSON.parse(String(r.items ?? '[]')),
      createdAt: String(r.created_at),
    }));
  }

  public createTemplate(input: CreateRoutineTemplateInput): RoutineTemplate {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO routine_templates (id, name, description, color_key, icon_name, items, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name.trim(),
        input.description ?? '',
        input.colorKey ?? 'sky',
        input.iconName ?? 'Lightning',
        JSON.stringify(input.items),
        now
      );

    return this.listTemplates().find((t) => t.id === id)!;
  }

  public deleteTemplate(id: string): boolean {
    const res = this.db
      .prepare('DELETE FROM routine_templates WHERE id = ?')
      .run(id);
    return Number(res.changes ?? 0) > 0;
  }

  public applyTemplateToDate(templateId: string, targetDate: string): Task[] {
    const tpl = this.listTemplates().find((t) => t.id === templateId);
    if (!tpl) {
      throw new Error('ไม่พบเทมเพลตที่ระบุ');
    }
    const inputs: CreateTaskInput[] = tpl.items.map((item) => ({
      title: item.title,
      description: item.description ?? '',
      taskType: item.taskType ?? 'todo',
      submissionRecipient: item.submissionRecipient ?? '',
      submissionLink: item.submissionLink ?? '',
      scheduledDate: targetDate,
      scheduledTime: item.scheduledTime ?? null,
      endTime: item.endTime ?? null,
      priority: item.priority ?? 'normal',
      categoryId: item.categoryId ?? 'cat-work',
      recurrence: 'none',
      reminderOffsets: item.reminderOffsets ?? [0, 15],
      subtasks: (item.subtasks ?? []).map((s) => ({
        id: crypto.randomUUID(),
        title: s.title,
        completed: false,
      })),
    }));

    return this.createBulkTasks(inputs);
  }

  // ==================== PUSH SUBSCRIPTIONS ====================

  public upsertPushSubscription(sub: {
    endpoint: string;
    p256dh: string;
    auth: string;
    deviceLabel?: string;
  }): void {
    const now = new Date().toISOString();
    const existing = this.db
      .prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?')
      .get(sub.endpoint) as { id: string } | undefined;

    if (existing) {
      this.db
        .prepare(
          `UPDATE push_subscriptions
           SET p256dh = ?, auth = ?, device_label = ?
           WHERE endpoint = ?`
        )
        .run(
          sub.p256dh,
          sub.auth,
          sub.deviceLabel ?? 'Web Device',
          sub.endpoint
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, device_label, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          crypto.randomUUID(),
          sub.endpoint,
          sub.p256dh,
          sub.auth,
          sub.deviceLabel ?? 'Web Device',
          now
        );
    }
  }

  public removePushSubscription(endpoint: string): void {
    this.db
      .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
      .run(endpoint);
  }

  public listPushSubscriptions(): PushSubscriptionRow[] {
    const rows = this.db
      .prepare('SELECT * FROM push_subscriptions ORDER BY created_at DESC')
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      endpoint: String(r.endpoint),
      p256dh: String(r.p256dh),
      auth: String(r.auth),
      deviceLabel: String(r.device_label),
      createdAt: String(r.created_at),
    }));
  }

  // ==================== NOTIFICATION LOGS ====================

  public hasTriggerFired(triggerKey: string): boolean {
    const row = this.db
      .prepare('SELECT id FROM notification_logs WHERE trigger_key = ?')
      .get(triggerKey);
    return Boolean(row);
  }

  public recordNotification(entry: {
    triggerKey: string;
    taskId: string | null;
    title: string;
    body: string;
    taskType: TaskType | 'briefing' | 'test';
    channel: string;
  }): NotificationLogItem | null {
    if (this.hasTriggerFired(entry.triggerKey)) return null;
    const id = crypto.randomUUID();
    const sentAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO notification_logs (id, trigger_key, task_id, title, body, task_type, channel, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        entry.triggerKey,
        entry.taskId,
        entry.title,
        entry.body,
        entry.taskType,
        entry.channel,
        sentAt
      );
    return {
      id,
      taskId: entry.taskId,
      title: entry.title,
      body: entry.body,
      taskType: entry.taskType,
      channel: entry.channel,
      sentAt,
    };
  }

  public listRecentNotifications(limit = 30): NotificationLogItem[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM notification_logs ORDER BY sent_at DESC LIMIT ?'
      )
      .all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      taskId: (r.task_id as string | null) ?? null,
      title: String(r.title),
      body: String(r.body),
      taskType: r.task_type as NotificationLogItem['taskType'],
      channel: String(r.channel),
      sentAt: String(r.sent_at),
    }));
  }

  public close(): void {
    this.db.close();
  }
}
