import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DayPulseRepository } from './db.ts';
import {
  NotificationDispatcher,
  verifyPushActionToken,
} from './notifications.ts';
import { ReminderScheduler } from './scheduler.ts';
import {
  CreateRoutineTemplateInputSchema,
  CreateTaskInputSchema,
  UpdateSettingsInputSchema,
  UpdateTaskInputSchema,
  type LiveNotificationPayload,
} from '../src/shared/schema.ts';
import { getZonedParts } from '../src/shared/dateUtils.ts';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (typeof req.query.token === 'string' && req.query.token.length > 0) {
    return req.query.token;
  }
  return null;
}

export function createServerContext(customRepo?: DayPulseRepository) {
  const dbPath =
    process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'daypulse.db');
  const repo = customRepo ?? new DayPulseRepository(dbPath);
  const sseClients = new Set<Response>();

  const broadcastSse = (event: string, data: unknown) => {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(msg);
      } catch {
        sseClients.delete(client);
      }
    }
  };

  const dispatcher = new NotificationDispatcher(
    repo,
    (livePayload: LiveNotificationPayload) => {
      broadcastSse('notification', livePayload);
    }
  );

  const scheduler = new ReminderScheduler(repo, dispatcher, () => {
    broadcastSse('sync', { reason: 'scheduler', timestamp: Date.now() });
  });

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // ==================== PUBLIC ENDPOINTS ====================

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'daypulse-pwa', time: new Date().toISOString() });
  });

  app.get('/api/auth/status', (req, res) => {
    const token = extractToken(req);
    const pinConfigured = repo.isPinConfigured();
    const authenticated = repo.validateSession(token);
    res.json({ pinConfigured, authenticated });
  });

  app.post('/api/auth/setup', (req, res) => {
    const schema = z.object({
      pin: z.string().regex(/^\d{4,6}$/, 'รหัส PIN ต้องเป็นตัวเลข 4-6 หลัก'),
      deviceName: z.string().max(100).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' });
      return;
    }
    if (repo.isPinConfigured()) {
      res.status(409).json({ error: 'ตั้งค่ารหัส PIN ไว้แล้ว กรุณาเข้าสู่ระบบ' });
      return;
    }
    const token = repo.setupInitialPin(parsed.data.pin, parsed.data.deviceName);
    res.status(201).json({ token });
  });

  app.post('/api/auth/login', (req, res) => {
    const schema = z.object({
      pin: z.string().min(1),
      deviceName: z.string().max(100).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'กรุณากรอกรหัส PIN' });
      return;
    }
    const token = repo.verifyPinAndCreateSession(
      parsed.data.pin,
      parsed.data.deviceName
    );
    if (!token) {
      res.status(401).json({ error: 'รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' });
      return;
    }
    res.json({ token });
  });

  // Cryptographically signed Service Worker Push Action endpoint (works even when app tab is closed)
  app.post('/api/push/action', (req, res) => {
    const schema = z.object({
      taskId: z.string().min(1),
      action: z.enum(['complete', 'snooze']),
      actionToken: z.string().min(10),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    const { taskId, action, actionToken } = parsed.data;
    const rawSettings = repo.getRawSettings();
    if (!verifyPushActionToken(taskId, actionToken, rawSettings.vapidPrivateKey)) {
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }

    const updated =
      action === 'complete'
        ? repo.updateTask(taskId, { status: 'completed' })
        : repo.snoozeTask(taskId, 10);

    if (updated) {
      broadcastSse('sync', { reason: `push_${action}`, taskId });
    }
    res.json({ ok: true, task: updated });
  });

  // ==================== AUTH MIDDLEWARE ====================

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!repo.validateSession(token)) {
      res.status(401).json({ error: 'กรุณาปลดล็อกรหัส PIN ก่อนใช้งาน' });
      return;
    }
    next();
  };

  app.post('/api/auth/logout', requireAuth, (req, res) => {
    const token = extractToken(req);
    if (token) repo.revokeSession(token);
    res.json({ ok: true });
  });

  // ==================== REAL-TIME SSE STREAM ====================

  app.get('/api/events', requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // ==================== BOOTSTRAP & CATEGORIES ====================

  app.get('/api/bootstrap', requireAuth, (_req, res) => {
    const settings = repo.getPublicSettings();
    const categories = repo.listCategories();
    const templates = repo.listTemplates();
    const notifications = repo.listRecentNotifications(25);
    const tasks = repo.listTasks();
    res.json({
      settings,
      categories,
      templates,
      notifications,
      tasks,
    });
  });

  app.get('/api/categories', requireAuth, (_req, res) => {
    res.json({ categories: repo.listCategories() });
  });

  // ==================== TASKS API ====================

  app.get('/api/tasks', requireAuth, (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const fromDate =
      typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
    const toDate =
      typeof req.query.toDate === 'string' ? req.query.toDate : undefined;
    const status =
      req.query.status === 'pending' || req.query.status === 'completed'
        ? req.query.status
        : undefined;
    const taskType =
      req.query.taskType === 'todo' ||
      req.query.taskType === 'submission' ||
      req.query.taskType === 'meeting'
        ? req.query.taskType
        : undefined;

    const tasks = repo.listTasks({ date, fromDate, toDate, status, taskType });
    res.json({ tasks });
  });

  app.post('/api/tasks', requireAuth, (req, res) => {
    const parsed = CreateTaskInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลงานไม่ถูกต้อง' });
      return;
    }
    const task = repo.createTask(parsed.data);
    broadcastSse('sync', { reason: 'task_created', taskId: task.id });
    res.status(201).json({ task });
  });

  app.post('/api/tasks/bulk', requireAuth, (req, res) => {
    const schema = z.object({
      tasks: z.array(CreateTaskInputSchema).min(1).max(100),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลชุดงานไม่ถูกต้อง' });
      return;
    }
    const created = repo.createBulkTasks(parsed.data.tasks);
    broadcastSse('sync', { reason: 'tasks_bulk_created', count: created.length });
    res.status(201).json({ tasks: created });
  });

  app.post('/api/tasks/rollover', requireAuth, (req, res) => {
    const settings = repo.getRawSettings();
    const todayDateStr =
      typeof req.body?.targetDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(req.body.targetDate)
        ? req.body.targetDate
        : getZonedParts(new Date(), settings.timezone).dateStr;

    const movedCount = repo.rolloverOverdueTasks(todayDateStr);
    if (movedCount > 0) {
      broadcastSse('sync', { reason: 'tasks_rollover', count: movedCount });
    }
    res.json({ movedCount, targetDate: todayDateStr });
  });

  app.patch('/api/tasks/:id', requireAuth, (req, res) => {
    const taskId = String(req.params.id);
    const parsed = UpdateTaskInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลแก้ไขไม่ถูกต้อง' });
      return;
    }
    const updated = repo.updateTask(taskId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'ไม่พบงานที่ต้องการแก้ไข' });
      return;
    }
    broadcastSse('sync', { reason: 'task_updated', taskId: updated.id });
    res.json({ task: updated });
  });

  app.post('/api/tasks/:id/snooze', requireAuth, (req, res) => {
    const taskId = String(req.params.id);
    const minutes =
      typeof req.body?.minutes === 'number' && req.body.minutes > 0
        ? Math.min(req.body.minutes, 240)
        : 10;
    const updated = repo.snoozeTask(taskId, minutes);
    if (!updated) {
      res.status(404).json({ error: 'ไม่พบงานที่ต้องการเลื่อนเวลาเตือน' });
      return;
    }
    broadcastSse('sync', { reason: 'task_snoozed', taskId: updated.id });
    res.json({ task: updated });
  });

  app.delete('/api/tasks/:id', requireAuth, (req, res) => {
    const taskId = String(req.params.id);
    const deleted = repo.deleteTask(taskId);
    if (!deleted) {
      res.status(404).json({ error: 'ไม่พบงานที่ต้องการลบ' });
      return;
    }
    broadcastSse('sync', { reason: 'task_deleted', taskId });
    res.json({ ok: true });
  });

  // ==================== ROUTINE TEMPLATES API ====================

  app.get('/api/templates', requireAuth, (_req, res) => {
    res.json({ templates: repo.listTemplates() });
  });

  app.post('/api/templates', requireAuth, (req, res) => {
    const parsed = CreateRoutineTemplateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลเทมเพลตไม่ถูกต้อง' });
      return;
    }
    const template = repo.createTemplate(parsed.data);
    broadcastSse('sync', { reason: 'template_created', templateId: template.id });
    res.status(201).json({ template });
  });

  app.post('/api/templates/:id/apply', requireAuth, (req, res) => {
    const templateId = String(req.params.id);
    const settings = repo.getRawSettings();
    const targetDate =
      typeof req.body?.targetDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(req.body.targetDate)
        ? req.body.targetDate
        : getZonedParts(new Date(), settings.timezone).dateStr;

    try {
      const created = repo.applyTemplateToDate(templateId, targetDate);
      broadcastSse('sync', {
        reason: 'template_applied',
        count: created.length,
      });
      res.status(201).json({ tasks: created });
    } catch (err: unknown) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/templates/:id', requireAuth, (req, res) => {
    const templateId = String(req.params.id);
    const deleted = repo.deleteTemplate(templateId);
    if (!deleted) {
      res.status(404).json({ error: 'ไม่พบเทมเพลต' });
      return;
    }
    broadcastSse('sync', { reason: 'template_deleted', templateId });
    res.json({ ok: true });
  });

  // ==================== SETTINGS & PUSH SUBSCRIPTIONS ====================

  app.get('/api/settings', requireAuth, (_req, res) => {
    res.json({ settings: repo.getPublicSettings() });
  });

  app.patch('/api/settings', requireAuth, (req, res) => {
    const parsed = UpdateSettingsInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลตั้งค่าไม่ถูกต้อง' });
      return;
    }
    const settings = repo.updateSettings(parsed.data);
    broadcastSse('sync', { reason: 'settings_updated' });
    res.json({ settings });
  });

  app.post('/api/push/subscribe', requireAuth, (req, res) => {
    const schema = z.object({
      subscription: z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string().min(1),
          auth: z.string().min(1),
        }),
      }),
      deviceLabel: z.string().max(120).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ข้อมูล Web Push Subscription ไม่ถูกต้อง' });
      return;
    }
    repo.upsertPushSubscription({
      endpoint: parsed.data.subscription.endpoint,
      p256dh: parsed.data.subscription.keys.p256dh,
      auth: parsed.data.subscription.keys.auth,
      deviceLabel: parsed.data.deviceLabel,
    });
    res.status(201).json({ settings: repo.getPublicSettings() });
  });

  app.post('/api/push/unsubscribe', requireAuth, (req, res) => {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint === 'string' && endpoint.length > 0) {
      repo.removePushSubscription(endpoint);
    }
    res.json({ settings: repo.getPublicSettings() });
  });

  app.post('/api/notifications/test', requireAuth, async (req, res) => {
    const customTitle =
      typeof req.body?.title === 'string' && req.body.title.trim()
        ? req.body.title.trim()
        : 'ทดสอบแจ้งเตือนจาก DayPulse สำเร็จ!';
    const customBody =
      typeof req.body?.body === 'string' && req.body.body.trim()
        ? req.body.body.trim()
        : 'ระบบพร้อมเตือนตารางงานและของที่ต้องส่งทั้งบน PC, iOS และ Android แล้ว';

    const result = await dispatcher.dispatch(
      {
        triggerKey: `test:${Date.now()}`,
        taskId: null,
        title: customTitle,
        body: customBody,
        taskType: 'test',
        url: '/',
      },
      { skipDedupe: true }
    );

    res.json({
      ok: true,
      result,
      notifications: repo.listRecentNotifications(25),
    });
  });

  app.get('/api/notifications', requireAuth, (_req, res) => {
    res.json({ notifications: repo.listRecentNotifications(30) });
  });

  // ==================== STATIC PRODUCTION PWA SERVING ====================

  const distPath = path.resolve(__dirname, '..', 'dist');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('/{*splat}', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return { app, repo, dispatcher, scheduler };
}

// Start server when run directly
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  const port = Number(process.env.PORT) || (process.env.NODE_ENV === 'production' ? 3000 : 3001);
  const { app, scheduler } = createServerContext();
  scheduler.start(15_000);

  app.listen(port, '0.0.0.0', () => {
    console.log(`[DayPulse] Server & Notification Scheduler running on http://localhost:${port}`);
  });
}
