import { describe, expect, it } from 'vitest';
import { parseBrainDumpText } from '../src/lib/brainDumpParser.ts';

describe('parseBrainDumpText (Smart Multi-line Thai Task Parser)', () => {
  it('parses mixed Thai timed tasks, submissions, meetings, priorities, recipients, and links', () => {
    const raw = `
      09:30 ประชุมอัปเดตโปรเจกต์เช้า !ด่วน
      13.00 - 14.30 เขียนโค้ดหน้าแดชบอร์ด
      16:00 ส่งไฟล์สไลด์สรุปยอดขายให้คุณพลอย @LINE https://drive.google.com/file/d/123 !สำคัญ
      - โทรตามเอกสารใบกำกับภาษี
    `;

    const items = parseBrainDumpText(raw, '2026-11-08');
    expect(items).toHaveLength(4);

    // 1. Urgent morning meeting
    expect(items[0]).toMatchObject({
      title: 'ประชุมอัปเดตโปรเจกต์เช้า',
      scheduledDate: '2026-11-08',
      scheduledTime: '09:30',
      endTime: null,
      taskType: 'meeting',
      priority: 'urgent',
      categoryId: 'cat-meeting',
      reminderOffsets: [0, 15],
    });

    // 2. Time-range todo with dot notation
    expect(items[1]).toMatchObject({
      title: 'เขียนโค้ดหน้าแดชบอร์ด',
      scheduledTime: '13:00',
      endTime: '14:30',
      taskType: 'todo',
      priority: 'normal',
    });

    // 3. Submission with @recipient, link, and [0, 15, 30] offsets
    expect(items[2]).toMatchObject({
      title: 'ส่งไฟล์สไลด์สรุปยอดขายให้คุณพลอย',
      scheduledTime: '16:00',
      taskType: 'submission',
      submissionRecipient: 'LINE',
      submissionLink: 'https://drive.google.com/file/d/123',
      priority: 'high',
      categoryId: 'cat-submit',
      reminderOffsets: [0, 15, 30],
    });

    // 4. Bullet untimed task
    expect(items[3]).toMatchObject({
      title: 'โทรตามเอกสารใบกำกับภาษี',
      scheduledTime: null,
      taskType: 'todo',
      reminderOffsets: [],
    });
  });

  it('extracts trailing Thai time and natural recipient when @tag is omitted', () => {
    const items = parseBrainDumpText(
      'ส่งรายงานความคืบหน้าให้อาจารย์สมชาย เวลา 15:45 น.',
      '2026-11-08'
    );
    expect(items).toHaveLength(1);
    expect(items[0].taskType).toBe('submission');
    expect(items[0].scheduledTime).toBe('15:45');
    expect(items[0].submissionRecipient).toBe('อาจารย์สมชาย');
  });
});
