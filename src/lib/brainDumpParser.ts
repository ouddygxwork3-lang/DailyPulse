import type { CreateTaskInput, PriorityLevel, TaskType } from '../shared/schema.ts';

/**
 * Parses multi-line Thai/English quick notes ("Brain Dump") into structured task inputs.
 *
 * Examples supported:
 * - "09:30 ประชุมทีมอัปเดตงาน !ด่วน"
 * - "13.00 - 14.30 เขียนโค้ดระบบแจ้งเตือน"
 * - "16:00 ส่งรายงานยอดขายให้พี่เอก @LINE https://drive.google.com/file/1 !สำคัญ"
 * - "- โทรตามเอกสารฝ่ายบัญชี"
 */
export function parseBrainDumpText(
  rawText: string,
  targetDate: string,
  defaultCategoryId = 'cat-work'
): CreateTaskInput[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: CreateTaskInput[] = [];

  for (const rawLine of lines) {
    // 1. Strip leading bullets / numbering like "- ", "* ", "• ", "1. ", "1) ", "[ ] "
    let line = rawLine
      .replace(/^(?:[-*•▪▸]|\[\s*\]|\d+[.)])\s+/, '')
      .trim();

    if (!line) continue;

    // 2. Extract URL if present (for submissionLink)
    let submissionLink = '';
    const urlMatch = line.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      submissionLink = urlMatch[0];
      line = line.replace(urlMatch[0], '').trim();
    }

    // 3. Extract Priority markers (!ด่วนมาก, !ด่วน, !urgent, !!!, !สำคัญ, !high, !!, !ชิลล์, !low)
    let priority: PriorityLevel = 'normal';
    const priorityRules: Array<{ regex: RegExp; level: PriorityLevel }> = [
      { regex: /(?:^|\s)(?:!ด่วนมาก|!ด่วน|!urgent|!!!)(?=\s|$)/gi, level: 'urgent' },
      { regex: /(?:^|\s)(?:!สำคัญ|!high|!!)(?=\s|$)/gi, level: 'high' },
      { regex: /(?:^|\s)(?:!ชิลล์|!ทั่วไป|!low)(?=\s|$)/gi, level: 'low' },
    ];
    for (const rule of priorityRules) {
      if (rule.regex.test(line)) {
        priority = rule.level;
        line = line.replace(rule.regex, ' ').trim();
        break;
      }
    }

    // 4. Extract @Recipient / @Channel (e.g., "@LINE", "@พี่เอก", "@Email")
    let submissionRecipient = '';
    const recipientMatch = line.match(/(?:^|\s)@([^\s!]+)(?=\s|$)/);
    if (recipientMatch) {
      submissionRecipient = recipientMatch[1].trim();
      line = line.replace(recipientMatch[0], ' ').trim();
    }

    // 5. Extract leading or trailing time / time-range
    // Supports "9:30", "09:30", "09.30", "09:30-10:30", "09.30 - 11.00 น."
    let scheduledTime: string | null = null;
    let endTime: string | null = null;

    const leadingTimeRegex =
      /^(\d{1,2})[:.](\d{2})(?:\s*(?:-|ถึง|~|to)\s*(\d{1,2})[:.](\d{2}))?\s*(?:น\.?)?\s+/i;
    const trailingTimeRegex =
      /\s+(?:เวลา\s*)?(\d{1,2})[:.](\d{2})(?:\s*(?:-|ถึง|~|to)\s*(\d{1,2})[:.](\d{2}))?\s*(?:น\.?)?$/i;

    const normalizeTime = (hStr: string, mStr: string): string | null => {
      const h = Number(hStr);
      const m = Number(mStr);
      if (h < 0 || h > 23 || m < 0 || m > 59) return null;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const leadMatch = line.match(leadingTimeRegex);
    if (leadMatch) {
      scheduledTime = normalizeTime(leadMatch[1], leadMatch[2]);
      if (leadMatch[3] && leadMatch[4]) {
        endTime = normalizeTime(leadMatch[3], leadMatch[4]);
      }
      if (scheduledTime) {
        line = line.slice(leadMatch[0].length).trim();
      }
    } else {
      const trailMatch = line.match(trailingTimeRegex);
      if (trailMatch) {
        scheduledTime = normalizeTime(trailMatch[1], trailMatch[2]);
        if (trailMatch[3] && trailMatch[4]) {
          endTime = normalizeTime(trailMatch[3], trailMatch[4]);
        }
        if (scheduledTime) {
          line = line.slice(0, line.length - trailMatch[0].length).trim();
        }
      }
    }

    // Clean up extra spaces
    const title = line.replace(/\s{2,}/g, ' ').trim();
    if (!title) continue;

    // 6. Detect TaskType (submission vs meeting vs todo)
    let taskType: TaskType = 'todo';
    const submissionRegex =
      /(?:^ส่ง|ส่งงาน|ส่งไฟล์|ส่งรายงาน|ส่งดราฟ|ส่งเอกสาร|ส่งการบ้าน|ส่งสไลด์|ส่งลูกค้า|ส่งอาจารย์|ส่งมอบ|เดดไลน์|ครบกำหนดส่ง|deadline|submit|deliver)/i;
    const meetingRegex =
      /(?:ประชุม|มีตติ้ง|นัดหมาย|นัดคุย|สัมภาษณ์|meeting|call\b|zoom|google meet)/i;

    if (submissionRegex.test(title) || submissionLink.length > 0) {
      taskType = 'submission';
    } else if (meetingRegex.test(title)) {
      taskType = 'meeting';
    }

    // Extract natural Thai recipient hint if taskType is submission and no @recipient was explicitly set
    if (taskType === 'submission' && !submissionRecipient) {
      const thaiGiveTo = title.match(/ให้\s*([^\s@!]{2,30})/);
      if (thaiGiveTo) {
        submissionRecipient = thaiGiveTo[1];
      }
    }

    // Assign sensible category & reminder offsets based on taskType
    let categoryId = defaultCategoryId;
    if (taskType === 'submission') {
      categoryId = 'cat-submit';
    } else if (taskType === 'meeting') {
      categoryId = 'cat-meeting';
    } else if (priority === 'urgent') {
      categoryId = 'cat-urgent';
    }

    const reminderOffsets = scheduledTime
      ? taskType === 'submission'
        ? [0, 15, 30]
        : [0, 15]
      : [];

    results.push({
      title,
      description: '',
      taskType,
      submissionRecipient,
      submissionLink,
      scheduledDate: targetDate,
      scheduledTime,
      endTime,
      priority,
      categoryId,
      recurrence: 'none',
      reminderOffsets,
      subtasks: [],
    });
  }

  return results;
}
