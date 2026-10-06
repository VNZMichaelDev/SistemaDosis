let swReady: Promise<ServiceWorkerRegistration> | null = null
let perm: NotificationPermission | 'unsupported' = 'unsupported'

export async function initNotifications(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return
  perm = Notification.permission
  if (perm !== 'granted' && perm !== 'denied') {
    perm = await Notification.requestPermission()
  }
  if (perm === 'granted') {
    try {
      swReady = navigator.serviceWorker.ready
    } catch {
      /* ignore */
    }
  }
}

export function sendNotification(title: string, body: string, tag?: string): void {
  if (typeof window === 'undefined') return
  if (!swReady) {
    if (perm === 'granted') new Notification(title, { body, tag, icon: '/logo.png' })
    return
  }
  swReady.then((reg) => {
    reg.active?.postMessage({ type: 'notify', title, body, tag: tag || 'default' })
  })
}
