// "Notify me" on this phone (Admin stage C): web push for admins. Android, and iPhone once
// Voyage Fare is on the home screen (iOS 16.4+). The server function "notify" holds the keys.
import { isIos, isStandalone } from './pwa'
import { supabase } from './supabase'

export type PushState = 'on' | 'off' | 'unsupported' | 'needs-home-screen' | 'blocked'

const supported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** Where this phone stands. */
export async function pushState(): Promise<PushState> {
  if (!supported())
    return isIos(navigator.userAgent, navigator.maxTouchPoints) && !isStandalone() ? 'needs-home-screen' : 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const registration = await navigator.serviceWorker.getRegistration()
  const sub = await registration?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

/** The server's public key, as the browser wants it. */
function keyBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

async function call<T>(action: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke('notify', { body: { action } })
  if (error) throw error
  return data as T
}

export async function turnOn(): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications are blocked for Voyage Fare in this phone’s settings.')
  const registration = await navigator.serviceWorker.ready
  const { key } = await call<{ key: string }>('key')
  const sub =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }))
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, { onConflict: 'endpoint' })
  if (error) throw error
  await call('test')
}

export async function turnOff(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration()
  const sub = await registration?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
