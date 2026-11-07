import type {
  CategoryColorKey,
  PriorityLevel,
  TaskType,
} from '../shared/schema.ts';

export interface ColorPaletteClasses {
  badgeBg: string;
  badgeText: string;
  cardAccentBorder: string;
  cardSoftBg: string;
  solidBg: string;
  dotBg: string;
  ringColor: string;
}

export const CATEGORY_COLOR_TOKENS: Record<
  CategoryColorKey,
  ColorPaletteClasses
> = {
  coral: {
    badgeBg: 'bg-orange-100 dark:bg-orange-500/20',
    badgeText: 'text-orange-800 dark:text-orange-200',
    cardAccentBorder: 'border-l-orange-500 border-orange-200/80 dark:border-orange-500/30',
    cardSoftBg: 'bg-gradient-to-br from-white via-orange-50/50 to-amber-50/40 dark:from-slate-900 dark:via-orange-950/25 dark:to-slate-900',
    solidBg: 'bg-gradient-to-r from-orange-500 to-rose-500',
    dotBg: 'bg-orange-500',
    ringColor: 'focus-visible:ring-orange-500',
  },
  sky: {
    badgeBg: 'bg-sky-100 dark:bg-sky-500/20',
    badgeText: 'text-sky-800 dark:text-sky-200',
    cardAccentBorder: 'border-l-sky-500 border-sky-200/80 dark:border-sky-500/30',
    cardSoftBg: 'bg-gradient-to-br from-white via-sky-50/45 to-indigo-50/30 dark:from-slate-900 dark:via-sky-950/25 dark:to-slate-900',
    solidBg: 'bg-gradient-to-r from-sky-500 to-blue-600',
    dotBg: 'bg-sky-500',
    ringColor: 'focus-visible:ring-sky-500',
  },
  violet: {
    badgeBg: 'bg-violet-100 dark:bg-violet-500/20',
    badgeText: 'text-violet-800 dark:text-violet-200',
    cardAccentBorder: 'border-l-violet-500 border-violet-200/80 dark:border-violet-500/30',
    cardSoftBg: 'bg-gradient-to-br from-white via-violet-50/45 to-fuchsia-50/30 dark:from-slate-900 dark:via-violet-950/25 dark:to-slate-900',
    solidBg: 'bg-gradient-to-r from-violet-600 to-purple-600',
    dotBg: 'bg-violet-500',
    ringColor: 'focus-visible:ring-violet-500',
  },
  emerald: {
    badgeBg: 'bg-emerald-100 dark:bg-emerald-500/20',
    badgeText: 'text-emerald-800 dark:text-emerald-200',
    cardAccentBorder: 'border-l-emerald-500 border-emerald-200/80 dark:border-emerald-500/30',
    cardSoftBg: 'bg-gradient-to-br from-white via-emerald-50/45 to-teal-50/30 dark:from-slate-900 dark:via-emerald-950/25 dark:to-slate-900',
    solidBg: 'bg-gradient-to-r from-emerald-500 to-teal-600',
    dotBg: 'bg-emerald-500',
    ringColor: 'focus-visible:ring-emerald-500',
  },
  amber: {
    badgeBg: 'bg-amber-100 dark:bg-amber-500/20',
    badgeText: 'text-amber-900 dark:text-amber-200',
    cardAccentBorder: 'border-l-amber-500 border-amber-200/80 dark:border-amber-500/30',
    cardSoftBg: 'bg-gradient-to-br from-white via-amber-50/50 to-yellow-50/30 dark:from-slate-900 dark:via-amber-950/25 dark:to-slate-900',
    solidBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
    dotBg: 'bg-amber-500',
    ringColor: 'focus-visible:ring-amber-500',
  },
  rose: {
    badgeBg: 'bg-rose-100 dark:bg-rose-500/20',
    badgeText: 'text-rose-800 dark:text-rose-200',
    cardAccentBorder: 'border-l-rose-500 border-rose-200/80 dark:border-rose-500/30',
    cardSoftBg: 'bg-gradient-to-br from-white via-rose-50/50 to-pink-50/30 dark:from-slate-900 dark:via-rose-950/25 dark:to-slate-900',
    solidBg: 'bg-gradient-to-r from-rose-500 to-pink-600',
    dotBg: 'bg-rose-500',
    ringColor: 'focus-visible:ring-rose-500',
  },
};

export const TASK_TYPE_META: Record<
  TaskType,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
    defaultColor: CategoryColorKey;
  }
> = {
  todo: {
    label: 'งานที่ต้องทำ',
    shortLabel: 'ต้องทำ',
    badgeClass:
      'bg-sky-600 text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs',
    defaultColor: 'sky',
  },
  submission: {
    label: 'งานที่ต้องส่ง / Deadline',
    shortLabel: 'ต้องส่ง!',
    badgeClass:
      'bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow-xs',
    defaultColor: 'coral',
  },
  meeting: {
    label: 'นัดหมาย / ประชุม',
    shortLabel: 'นัดหมาย',
    badgeClass:
      'bg-violet-600 text-white dark:bg-violet-500 dark:text-white shadow-xs',
    defaultColor: 'violet',
  },
};

export const PRIORITY_META: Record<
  PriorityLevel,
  {
    label: string;
    chipClass: string;
  }
> = {
  urgent: {
    label: 'ด่วนมาก',
    chipClass:
      'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-500/40',
  },
  high: {
    label: 'สำคัญ',
    chipClass:
      'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/40',
  },
  normal: {
    label: 'ปกติ',
    chipClass:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  low: {
    label: 'ชิลล์',
    chipClass:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  },
};
