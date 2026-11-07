export interface PlatformPushInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isStandalonePWA: boolean;
  pushSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  deviceLabel: string;
}

export function detectPlatformPushInfo(): PlatformPushInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isStandalonePWA: false,
      pushSupported: false,
      permission: 'unsupported',
      deviceLabel: 'Unknown',
    };
  }

  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);

  const isStandalonePWA =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    Boolean((navigator as unknown as { standalone?: boolean }).standalone);

  const pushSupported =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const permission: NotificationPermission | 'unsupported' =
    'Notification' in window ? Notification.permission : 'unsupported';

  let deviceLabel = 'PC Browser';
  if (isIOS) {
    deviceLabel = isStandalonePWA ? 'iPhone / iPad (PWA)' : 'iPhone / iPad (Safari)';
  } else if (isAndroid) {
    deviceLabel = isStandalonePWA ? 'Android (PWA)' : 'Android Browser';
  }

  return {
    isIOS,
    isAndroid,
    isStandalonePWA,
    pushSupported,
    permission,
    deviceLabel,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch {
    return null;
  }
}

export async function getActivePushSubscription(): Promise<PushSubscription | null> {
  const reg = await registerServiceWorker();
  if (!reg || !('pushManager' in reg)) return null;
  try {
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeBrowserToWebPush(
  vapidPublicKey: string
): Promise<{
  endpoint: string;
  keys: { p256dh: string; auth: string };
}> {
  if (!('Notification' in window)) {
    throw new Error('เบราว์เซอร์นี้ยังไม่รองรับระบบแจ้งเตือน (บน iPhone กรุณากด "เพิ่มไปยังหน้าจอโฮม" ก่อน)');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('ไม่ได้รับสิทธิ์แจ้งเตือน กรุณากดอนุญาต (Allow) ในตั้งค่าเบราว์เซอร์');
  }

  const reg = await registerServiceWorker();
  if (!reg || !('pushManager' in reg)) {
    throw new Error('ไม่สามารถลงทะเบียน Service Worker สำหรับ Web Push ได้');
  }

  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const keyBytes = urlBase64ToUint8Array(vapidPublicKey);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes.buffer as ArrayBuffer,
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('ข้อมูลกุญแจเข้ารหัส Web Push ไม่สมบูรณ์');
  }

  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}
