'use client'

import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
}

export default function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition active:translate-y-[1px] disabled:opacity-60 disabled:cursor-not-allowed'

  const styles =
    variant === 'secondary'
      ? 'bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50'
      : variant === 'danger'
        ? 'bg-rose-600 text-white hover:bg-rose-700'
        : 'bg-indigo-600 text-white hover:bg-indigo-700'

  return <button className={`${base} ${styles} ${className}`} {...props} />
}
