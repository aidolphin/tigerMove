type PushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type SubscriptionResponse = {
  subscription: PushSubscriptionPayload | null;
  permission: NotificationPermission;
};

const STORAGE_KEY = "tigermove-push-subscription";
const LAST_NOTIFICATION_KEY = "tigermove-last-notification";

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") {
    return "granted";
  }
  return await Notification.requestPermission();
}

export async function subscribeToPush(guestId: string): Promise<PushSubscriptionPayload | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    const payload = serializeSubscription(existing);
    await storeSubscription(payload);
    await sendSubscriptionToServer(guestId, payload);
    return payload;
  }

  let subscription: PushSubscription | null = null;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_VAPID_PUBLIC_KEY || "").buffer as unknown as ArrayBuffer,
    });
  } catch {
    return null;
  }

  if (!subscription) {
    return null;
  }

  const payload = serializeSubscription(subscription);
  await storeSubscription(payload);
  await sendSubscriptionToServer(guestId, payload);
  return payload;
}

export async function unsubscribeFromPush(guestId: string): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }

  await removeSubscriptionFromServer(guestId);
  localStorage.removeItem(STORAGE_KEY);
}

export async function getStoredSubscription(): Promise<PushSubscriptionPayload | null> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as PushSubscriptionPayload;
  } catch {
    return null;
  }
}

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getPermissionState(): NotificationPermission {
  if (!("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

export function showForegroundNotification(title: string, body: string, tag?: string): void {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const now = Date.now();
  const last = getLastNotificationTime(tag);
  if (now - last < 30000) {
    return;
  }

  const notification = new Notification(title, {
    body,
    tag: tag || "tigermove-default",
    requireInteraction: false,
  });

  storeLastNotificationTime(tag, now);

  notification.addEventListener("click", () => {
    window.focus();
    notification.close();
  });

  setTimeout(() => notification.close(), 6000);
}

export function isDocumentHidden(): boolean {
  return typeof document !== "undefined" ? document.hidden : true;
}

async function sendSubscriptionToServer(guestId: string, payload: PushSubscriptionPayload): Promise<void> {
  try {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId, subscription: payload }),
    });
  } catch {
    // ignore network errors
  }
}

async function removeSubscriptionFromServer(guestId: string): Promise<void> {
  try {
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId }),
    });
  } catch {
    // ignore network errors
  }
}

async function storeSubscription(payload: PushSubscriptionPayload): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function serializeSubscription(subscription: PushSubscription): PushSubscriptionPayload {
  const rawKey = subscription.toJSON();
  return {
    endpoint: rawKey.endpoint as string,
    keys: {
      p256dh: (rawKey.keys?.p256dh as string) || "",
      auth: (rawKey.keys?.auth as string) || "",
    },
  };
}

function getLastNotificationTime(tag?: string): number {
  const raw = localStorage.getItem(LAST_NOTIFICATION_KEY);
  if (!raw) {
    return 0;
  }
  try {
    const map = JSON.parse(raw) as Record<string, number>;
    return tag ? map[tag] || 0 : map["__default__"] || 0;
  } catch {
    return 0;
  }
}

function storeLastNotificationTime(tag: string | undefined, timestamp: number): void {
  const raw = localStorage.getItem(LAST_NOTIFICATION_KEY);
  let map: Record<string, number> = {};
  if (raw) {
    try {
      map = JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  map[tag || "__default__"] = timestamp;
  localStorage.setItem(LAST_NOTIFICATION_KEY, JSON.stringify(map));
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
