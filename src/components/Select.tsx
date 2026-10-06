'use client'

import type { SelectHTMLAttributes, ReactNode } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  children?: ReactNode
}

export default function Select({ label, className = '', children, ...props }: SelectProps) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-sm font-medium text-slate-700">{label}</div> : null}
      <select
        className={
          'w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 ' +
          className
        }
        {...props}
      >
        {children}
      </select>
    </label>
  )
}
