import type {
  AppSettingsPublic,
  Category,
  CreateRoutineTemplateInput,
  CreateTaskInput,
  NotificationLogItem,
  RoutineTemplate,
  Task,
  UpdateSettingsInput,
  UpdateTaskInput,
} from '../shared/schema.ts';

const TOKEN_KEY = 'daypulse_session_token';
const CACHE_KEY = 'daypulse_offline_bootstrap';

export interface BootstrapPayload {
  settings: AppSettingsPublic;
  categories: Category[];
  templates: RoutineTemplate[];
  notifications: NotificationLogItem[];
  tasks: Task[];
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function loadCachedBootstrap(): BootstrapPayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as BootstrapPayload) : null;
  } catch {
    return null;
  }
}

export function saveCachedBootstrap(data: BootstrapPayload): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota errors
  }
}

async function requestJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody.error) msg = errBody.error;
    } catch {
      // ignore
    }
    const error = new Error(msg) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }

  return (await res.json()) as T;
}

export const api = {
  getAuthStatus: () =>
    requestJson<{ pinConfigured: boolean; authenticated: boolean }>(
      '/api/auth/status'
    ),

  setupPin: async (pin: string, deviceName: string) => {
    const res = await requestJson<{ token: string }>('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ pin, deviceName }),
    });
    setStoredToken(res.token);
    return res;
  },

  loginPin: async (pin: string, deviceName: string) => {
    const res = await requestJson<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ pin, deviceName }),
    });
    setStoredToken(res.token);
    return res;
  },

  logout: async () => {
    try {
      await requestJson('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },

  getBootstrap: async (): Promise<BootstrapPayload> => {
    const data = await requestJson<BootstrapPayload>('/api/bootstrap');
    saveCachedBootstrap(data);
    return data;
  },

  createTask: (input: CreateTaskInput) =>
    requestJson<{ task: Task }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  createBulkTasks: (tasks: CreateTaskInput[]) =>
    requestJson<{ tasks: Task[] }>('/api/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify({ tasks }),
    }),

  updateTask: (id: string, patch: UpdateTaskInput) =>
    requestJson<{ task: Task }>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  snoozeTask: (id: string, minutes = 10) =>
    requestJson<{ task: Task }>(`/api/tasks/${id}/snooze`, {
      method: 'POST',
      body: JSON.stringify({ minutes }),
    }),

  rolloverOverdue: (targetDate?: string) =>
    requestJson<{ movedCount: number; targetDate: string }>(
      '/api/tasks/rollover',
      {
        method: 'POST',
        body: JSON.stringify({ targetDate }),
      }
    ),

  deleteTask: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/tasks/${id}`, {
      method: 'DELETE',
    }),

  createTemplate: (input: CreateRoutineTemplateInput) =>
    requestJson<{ template: RoutineTemplate }>('/api/templates', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  applyTemplate: (id: string, targetDate: string) =>
    requestJson<{ tasks: Task[] }>(`/api/templates/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify({ targetDate }),
    }),

  deleteTemplate: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/templates/${id}`, {
      method: 'DELETE',
    }),

  updateSettings: (patch: UpdateSettingsInput) =>
    requestJson<{ settings: AppSettingsPublic }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  subscribePush: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    deviceLabel: string
  ) =>
    requestJson<{ settings: AppSettingsPublic }>('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription, deviceLabel }),
    }),

  unsubscribePush: (endpoint: string) =>
    requestJson<{ settings: AppSettingsPublic }>('/api/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    }),

  sendTestNotification: () =>
    requestJson<{
      ok: boolean;
      result: { logged: boolean; webPushSent: number; telegramSent: boolean };
      notifications: NotificationLogItem[];
    }>('/api/notifications/test', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};
