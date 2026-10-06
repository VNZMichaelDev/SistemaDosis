import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { clearSessionCookie, setSessionCookie, signToken } from '@/lib/auth'
import { get, json, notFound, pub, apiError, VALIDATION } from '../router'

pub.get('/health', () => json({ ok: true }))

pub.post('/auth/login', async ({ body }) => {
  const parsed = z.object({ usuario: z.string().min(1), password: z.string().min(1) }).safeParse(body)
  if (!parsed.success) return VALIDATION()

  const { data: row } = await supabaseAdmin()
    .from('usuarios')
    .select('id, usuario, password, rol, departamentos_precios')
    .eq('usuario', parsed.data.usuario)
    .maybeSingle()

  if (!row) return apiError(401, 'INVALID_CREDENTIALS')
  const ok = await bcrypt.compare(parsed.data.password, row.password)
  if (!ok) return apiError(401, 'INVALID_CREDENTIALS')

  const token = await signToken({ userId: Number(row.id), usuario: row.usuario, rol: row.rol })
  await setSessionCookie(token)

  return json({
    token,
    user: {
      id: row.id,
      usuario: row.usuario,
      rol: row.rol,
      departamentos_precios: row.departamentos_precios || [],
    },
  })
})

pub.post('/auth/logout', async () => {
  await clearSessionCookie()
  return json({ ok: true })
})

get('/auth/me', async ({ session }) => {
  const { data: row } = await supabaseAdmin()
    .from('usuarios')
    .select('id, usuario, rol, departamentos_precios')
    .eq('id', session.userId)
    .maybeSingle()
  if (!row) return notFound()
  return json({
    user: {
      id: row.id,
      usuario: row.usuario,
      rol: row.rol,
      departamentos_precios: row.departamentos_precios || [],
    },
  })
})
