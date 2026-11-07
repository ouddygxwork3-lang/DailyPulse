import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { DayPulseRepository } from '../server/db.ts';
import { createServerContext } from '../server/index.ts';
import { createPushActionToken } from '../server/notifications.ts';

describe('DayPulse Full-Stack API & Reminder Scheduler Integration', () => {
  let repo: DayPulseRepository;
  let ctx: ReturnType<typeof createServerContext>;
  let authHeader: string;

  beforeEach(async () => {
    repo = new DayPulseRepository(':memory:');
    ctx = createServerContext(repo);

    // Initial PIN setup
    const setupRes = await request(ctx.app)
      .post('/api/auth/setup')
      .send({ pin: '2580', deviceName: 'Vitest PC' });
    expect(setupRes.status).toBe(201);
    expect(setupRes.body.token).toBeTruthy();
    authHeader = `Bearer ${setupRes.body.token}`;
  });

  afterEach(() => {
    ctx.scheduler.stop();
    repo.close();
  });

  it('enforces PIN authentication and allows multi-device login with correct PIN', async () => {
    const unauth = await request(ctx.app).get('/api/bootstrap');
    expect(unauth.status).toBe(401);

    const wrongPin = await request(ctx.app)
      .post('/api/auth/login')
      .send({ pin: '9999', deviceName: 'iPhone Safari' });
    expect(wrongPin.status).toBe(401);

    const validLogin = await request(ctx.app)
      .post('/api/auth/login')
      .send({ pin: '2580', deviceName: 'iPhone PWA' });
    expect(validLogin.status).toBe(200);
    expect(validLogin.body.token).toBeTruthy();
  });

  it('supports task creation, bulk creation, overdue rollover, and recurring task spawning', async () => {
    // 1. Create an overdue task on 2026-11-06
    const overdueRes = await request(ctx.app)
      .post('/api/tasks')
      .set('Authorization', authHeader)
      .send({
        title: 'ส่งใบเสนอราคาที่ค้างจากเมื่อวาน',
        taskType: 'submission',
        submissionRecipient: 'ลูกค้าบริษัท A',
        scheduledDate: '2026-11-06',
        scheduledTime: '16:00',
        priority: 'urgent',
      });
    expect(overdueRes.status).toBe(201);

    // 2. Rollover overdue tasks to 2026-11-07
    const rollRes = await request(ctx.app)
      .post('/api/tasks/rollover')
      .set('Authorization', authHeader)
      .send({ targetDate: '2026-11-07' });
    expect(rollRes.status).toBe(200);
    expect(rollRes.body.movedCount).toBe(1);

    const rolledTask = repo.getTask(overdueRes.body.task.id);
    expect(rolledTask?.scheduledDate).toBe('2026-11-07');

    // 3. Create a daily recurring task and complete it -> should spawn next day automatically
    const recRes = await request(ctx.app)
      .post('/api/tasks')
      .set('Authorization', authHeader)
      .send({
        title: 'อัปเดตสถานะงานประจำวัน',
        taskType: 'todo',
        scheduledDate: '2026-11-07',
        scheduledTime: '09:00',
        recurrence: 'daily',
        subtasks: [{ id: 's1', title: 'เช็กเมล', completed: true }],
      });
    expect(recRes.status).toBe(201);

    const completeRes = await request(ctx.app)
      .patch(`/api/tasks/${recRes.body.task.id}`)
      .set('Authorization', authHeader)
      .send({ status: 'completed' });
    expect(completeRes.status).toBe(200);

    const tomorrowTasks = repo.listTasks({
      date: '2026-11-08',
      status: 'pending',
    });
    expect(tomorrowTasks).toHaveLength(1);
    expect(tomorrowTasks[0].title).toBe('อัปเดตสถานะงานประจำวัน');
    expect(tomorrowTasks[0].subtasks[0].completed).toBe(false);
  });

  it('applies routine templates and handles signed Service Worker background actions', async () => {
    const templatesRes = await request(ctx.app)
      .get('/api/templates')
      .set('Authorization', authHeader);
    expect(templatesRes.status).toBe(200);
    const workdayTpl = templatesRes.body.templates[0];
    expect(workdayTpl).toBeTruthy();

    const applyRes = await request(ctx.app)
      .post(`/api/templates/${workdayTpl.id}/apply`)
      .set('Authorization', authHeader)
      .send({ targetDate: '2026-11-07' });
    expect(applyRes.status).toBe(201);
    expect(applyRes.body.tasks.length).toBeGreaterThanOrEqual(3);

    const targetTask = applyRes.body.tasks[0];
    const secret = repo.getRawSettings().vapidPrivateKey;
    const validActionToken = createPushActionToken(targetTask.id, secret);

    const swCompleteRes = await request(ctx.app)
      .post('/api/push/action')
      .send({
        taskId: targetTask.id,
        action: 'complete',
        actionToken: validActionToken,
      });
    expect(swCompleteRes.status).toBe(200);
    expect(repo.getTask(targetTask.id)?.status).toBe('completed');
  });

  it('fires Morning Briefing, advance offset alerts, exact deadline alerts, and snooze without duplicates', async () => {
    const taskRes = await request(ctx.app)
      .post('/api/tasks')
      .set('Authorization', authHeader)
      .send({
        title: 'ส่งไฟล์ดีไซน์ฉบับไฟนอล',
        taskType: 'submission',
        submissionRecipient: 'ทีมพัฒนา (@Slack)',
        submissionLink: 'https://figma.com/file/xyz',
        scheduledDate: '2026-11-07',
        scheduledTime: '14:00',
        reminderOffsets: [0, 15],
      });
    const taskId = taskRes.body.task.id as string;

    // 1. Tick at 08:00 Asia/Bangkok (+07:00 => 01:00 UTC) -> Morning Daily Briefing fires
    const morningFired = await ctx.scheduler.tick(
      new Date('2026-11-07T08:00:10+07:00')
    );
    expect(morningFired).toBe(1);

    // Calling again at 08:01 should deduplicate (0 fired)
    const morningDup = await ctx.scheduler.tick(
      new Date('2026-11-07T08:01:10+07:00')
    );
    expect(morningDup).toBe(0);

    // 2. Tick at 13:45 Asia/Bangkok -> 15-min advance submission warning fires
    const advanceFired = await ctx.scheduler.tick(
      new Date('2026-11-07T13:45:05+07:00')
    );
    expect(advanceFired).toBe(1);

    // Duplicate check at 13:46 -> 0 fired
    const advanceDup = await ctx.scheduler.tick(
      new Date('2026-11-07T13:46:05+07:00')
    );
    expect(advanceDup).toBe(0);

    // 3. Tick at 14:00 Asia/Bangkok -> Exact deadline alert fires
    const exactFired = await ctx.scheduler.tick(
      new Date('2026-11-07T14:00:05+07:00')
    );
    expect(exactFired).toBe(1);

    // 4. Snooze task for 10 minutes, then tick after 11 minutes -> Snooze alert fires
    await request(ctx.app)
      .post(`/api/tasks/${taskId}/snooze`)
      .set('Authorization', authHeader)
      .send({ minutes: 10 });

    const snoozedTask = repo.getTask(taskId)!;
    expect(snoozedTask.snoozedUntil).toBeTruthy();
    const afterSnooze = new Date(
      new Date(snoozedTask.snoozedUntil!).getTime() + 5_000
    );

    const snoozeFired = await ctx.scheduler.tick(afterSnooze);
    expect(snoozeFired).toBe(1);
    expect(repo.getTask(taskId)?.snoozedUntil).toBeNull();

    const logs = repo.listRecentNotifications(10);
    expect(logs.length).toBe(4);
  });
});
