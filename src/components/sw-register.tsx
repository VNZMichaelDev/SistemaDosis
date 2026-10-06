'use client'

import { useEffect } from 'react'
import { initNotifications } from '@/lib/notify'

export default function SWRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
      initNotifications()
    }
  }, [])
  return null
}
