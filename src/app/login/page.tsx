'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/auth-client'

export default function LoginPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(usuario, password)
      router.push(
        user.rol === 'admin' || user.rol === 'encargado'
          ? '/admin/inventario'
          : user.rol === 'cocina'
            ? '/cocina'
            : '/pos',
      )
    } catch (err: any) {
      setError(err?.data?.error || 'LOGIN_FAILED')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen font-sans bg-depo-yellow">
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="DEPos" className="h-20 md:h-24" />
          </div>
          <div className="bg-white border border-[#E8E6DF] rounded-[14px] p-6 md:p-8">
            <div className="mb-6">
              <div className="text-[18px] font-medium text-[#1A1A1A] tracking-tight">Acceder</div>
              <div className="text-xs text-[#888] mt-1">Ingresa tus credenciales</div>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="text-[11px] font-medium text-[#888] tracking-wider uppercase mb-[5px] block">
                  Usuario
                </label>
                <input
                  className="w-full bg-[#F5F4F0] border border-[#E0DED8] rounded-lg py-3 px-3 text-[13px] text-[#1A1A1A] outline-none transition-colors focus:border-[#1A1A1A] focus:bg-white font-sans"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  autoFocus
                  placeholder="admin"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-[#888] tracking-wider uppercase mb-[5px] block">
                  Contraseña
                </label>
                <input
                  type="password"
                  className="w-full bg-[#F5F4F0] border border-[#E0DED8] rounded-lg py-3 px-3 text-[13px] text-[#1A1A1A] outline-none transition-colors focus:border-[#1A1A1A] focus:bg-white font-sans"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error ? (
                <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-depo-dark text-white border-none rounded-xl py-3.5 text-[14px] font-bold cursor-pointer transition-all hover:bg-depo-dark-2 font-sans tracking-wide disabled:opacity-60 shadow-lg shadow-yellow-900/20 active:scale-[0.98]"
              >
                {loading ? 'Ingresando...' : 'Entrar al sistema'}
              </button>

              <div className="pt-2 border-t border-[#F0EDE6]">
                <div className="text-[11px] text-[#888]">
                  <span className="font-medium text-[#666]">Usuario inicial:</span> admin / admin123
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
