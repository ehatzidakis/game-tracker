import { inject, Injectable, signal } from '@angular/core';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { db } from './db';

export type PushState =
  | 'unsupported' // Not a browser that can do push (on iPhone: open the home-screen app).
  | 'denied' // You blocked notifications for the app.
  | 'off'
  | 'on';

/**
 * Release alerts on this device. On iPhone, push only works in the home-screen app
 * (iOS 16.4+), and only after you allow notifications from a tap in the app.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly auth = inject(AuthService);
  readonly state = signal<PushState>('off');
  readonly busy = signal(false);

  constructor() {
    void this.refresh();
  }

  enabledHere(): boolean {
    return this.state() === 'on';
  }

  /** Asks for permission, subscribes this device and saves the subscription. */
  async enable(): Promise<void> {
    if (!isSupported()) return;
    this.busy.set(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.state.set(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const registration = await registerWorker();
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(environment.vapidPublicKey),
        }));
      await this.save(subscription);
      this.state.set('on');
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    if (!isSupported()) return;
    this.busy.set(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await deleteDoc(await this.subscriptionDoc(subscription)).catch(() => undefined);
        await subscription.unsubscribe();
      }
      this.state.set('off');
    } finally {
      this.busy.set(false);
    }
  }

  /** Sends a test notification to this account's devices. */
  async sendTest(): Promise<void> {
    const res = await fetch('/api/push-test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.auth.idToken()}` },
    });
    if (!res.ok) throw new Error(`Test failed (${res.status})`);
  }

  private async refresh(): Promise<void> {
    if (!isSupported()) {
      this.state.set('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      this.state.set('denied');
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    this.state.set(subscription && Notification.permission === 'granted' ? 'on' : 'off');
    // Re-save in case the browser rotated the subscription.
    if (subscription && this.state() === 'on') {
      await this.auth.idToken().catch(() => undefined);
      if (this.auth.user()) await this.save(subscription).catch(() => undefined);
    }
  }

  private async save(subscription: PushSubscription): Promise<void> {
    const json = subscription.toJSON();
    await setDoc(await this.subscriptionDoc(subscription), {
      endpoint: json.endpoint,
      keys: json.keys,
      device: deviceLabel(),
      updatedAt: Date.now(),
    });
  }

  private async subscriptionDoc(subscription: PushSubscription) {
    const user = this.auth.user();
    if (!user) throw new Error('Not signed in');
    // One document per device, named after a hash of its push address.
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(subscription.endpoint));
    const id = [...new Uint8Array(hash).slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return doc(db, 'users', user.uid, 'pushSubscriptions', id);
  }
}

function isSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function registerWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac/.test(ua)) return 'Mac';
  return 'Browser';
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
