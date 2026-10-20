/** Browser side of web push: subscribe this device with the server's public key, or unsubscribe it. */
import { notificationsApi } from "@/lib/api";

export type PushState = "unsupported" | "unavailable" | "denied" | "off" | "on";

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function supported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function pushState(): Promise<{ state: PushState; publicKey: string }> {
  if (!supported()) return { state: "unsupported", publicKey: "" };
  const config = await notificationsApi.getPushConfig();
  if (!config.enabled) return { state: "unavailable", publicKey: "" };
  if (Notification.permission === "denied") return { state: "denied", publicKey: config.public_key };
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  return { state: subscription ? "on" : "off", publicKey: config.public_key };
}

export async function enablePush(publicKey: string): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const subscription = (await registration.pushManager.getSubscription())
    ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  await notificationsApi.savePushSubscription(subscription.toJSON());
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await notificationsApi.deletePushSubscription(subscription.endpoint).catch(() => undefined);
    await subscription.unsubscribe();
  }
  return "off";
}
