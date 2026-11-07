import { z } from 'zod';

export const TaskTypeSchema = z.enum(['todo', 'submission', 'meeting']);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const PriorityLevelSchema = z.enum(['urgent', 'high', 'normal', 'low']);
export type PriorityLevel = z.infer<typeof PriorityLevelSchema>;

export const RecurrenceTypeSchema = z.enum(['none', 'daily', 'weekdays', 'weekly']);
export type RecurrenceType = z.infer<typeof RecurrenceTypeSchema>;

export const CategoryColorKeySchema = z.enum([
  'coral',
  'sky',
  'violet',
  'emerald',
  'amber',
  'rose',
]);
export type CategoryColorKey = z.infer<typeof CategoryColorKeySchema>;

export const SubtaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300),
  completed: z.boolean(),
});
export type Subtask = z.infer<typeof SubtaskSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(300),
  description: z.string().default(''),
  taskType: TaskTypeSchema.default('todo'),
  submissionRecipient: z.string().default(''),
  submissionLink: z.string().default(''),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .default(null),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .default(null),
  priority: PriorityLevelSchema.default('normal'),
  categoryId: z.string().default('cat-work'),
  status: z.enum(['pending', 'completed']).default('pending'),
  completedAt: z.string().nullable().default(null),
  recurrence: RecurrenceTypeSchema.default('none'),
  reminderOffsets: z.array(z.number().int().min(0).max(1440)).default([0, 15]),
  snoozedUntil: z.string().nullable().default(null),
  subtasks: z.array(SubtaskSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskInputSchema = z.object({
  title: z.string().trim().min(1, 'กรุณาระบุชื่องาน').max(300),
  description: z.string().max(2000).optional().default(''),
  taskType: TaskTypeSchema.optional().default('todo'),
  submissionRecipient: z.string().max(200).optional().default(''),
  submissionLink: z.string().max(1000).optional().default(''),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional()
    .default(null),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional()
    .default(null),
  priority: PriorityLevelSchema.optional().default('normal'),
  categoryId: z.string().optional().default('cat-work'),
  recurrence: RecurrenceTypeSchema.optional().default('none'),
  reminderOffsets: z
    .array(z.number().int().min(0).max(1440))
    .optional()
    .default([0, 15]),
  subtasks: z.array(SubtaskSchema).optional().default([]),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

export const UpdateTaskInputSchema = CreateTaskInputSchema.partial().extend({
  status: z.enum(['pending', 'completed']).optional(),
  snoozedUntil: z.string().nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  colorKey: CategoryColorKeySchema,
  iconName: z.string().default('FolderNotch'),
  sortOrder: z.number().int().default(0),
});
export type Category = z.infer<typeof CategorySchema>;

export const RoutineTemplateItemSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().optional().default(''),
  taskType: TaskTypeSchema.default('todo'),
  submissionRecipient: z.string().optional().default(''),
  submissionLink: z.string().optional().default(''),
  scheduledTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .default(null),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .default(null),
  priority: PriorityLevelSchema.default('normal'),
  categoryId: z.string().default('cat-work'),
  reminderOffsets: z.array(z.number().int().min(0).max(1440)).default([0, 15]),
  subtasks: z
    .array(z.object({ title: z.string().min(1) }))
    .optional()
    .default([]),
});
export type RoutineTemplateItem = z.infer<typeof RoutineTemplateItemSchema>;

export const RoutineTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().default(''),
  colorKey: CategoryColorKeySchema.default('sky'),
  iconName: z.string().default('Lightning'),
  items: z.array(RoutineTemplateItemSchema).min(1),
  createdAt: z.string(),
});
export type RoutineTemplate = z.infer<typeof RoutineTemplateSchema>;

export const CreateRoutineTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(300).optional().default(''),
  colorKey: CategoryColorKeySchema.optional().default('sky'),
  iconName: z.string().optional().default('Lightning'),
  items: z.array(RoutineTemplateItemSchema).min(1),
});
export type CreateRoutineTemplateInput = z.infer<
  typeof CreateRoutineTemplateInputSchema
>;

export interface AppSettingsPublic {
  pinConfigured: boolean;
  vapidPublicKey: string;
  telegramEnabled: boolean;
  telegramConfigured: boolean;
  telegramChatId: string;
  telegramBotTokenMasked: string;
  morningBriefingEnabled: boolean;
  morningBriefingTime: string;
  soundEnabled: boolean;
  timezone: string;
  pushSubscriptionCount: number;
}

export const UpdateSettingsInputSchema = z.object({
  telegramEnabled: z.boolean().optional(),
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),
  morningBriefingEnabled: z.boolean().optional(),
  morningBriefingTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  soundEnabled: z.boolean().optional(),
  timezone: z.string().min(1).optional(),
  newPin: z
    .string()
    .regex(/^\d{4,6}$/, 'รหัส PIN ต้องเป็นตัวเลข 4-6 หลัก')
    .optional(),
});
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;

export interface NotificationLogItem {
  id: string;
  taskId: string | null;
  title: string;
  body: string;
  taskType: TaskType | 'briefing' | 'test';
  channel: string;
  sentAt: string;
}

export interface LiveNotificationPayload {
  id: string;
  taskId: string | null;
  title: string;
  body: string;
  taskType: TaskType | 'briefing' | 'test';
  submissionLink?: string;
  submissionRecipient?: string;
  sentAt: string;
}
