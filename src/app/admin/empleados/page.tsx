'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'

const TIPOS: { v: string; l: string; icon: string }[] = [
  { v: 'disfrute', l: 'Vacaciones (disfrute)', icon: '🏖️' },
  { v: 'bono_vacacional', l: 'Bono vacacional', icon: '🎁' },
  { v: 'utilidades', l: 'Utilidades', icon: '📈' },
  { v: 'prestaciones', l: 'Prestaciones sociales', icon: '🛡️' },
]

const tipoLabel = (t: string) => TIPOS.find((x) => x.v === t)?.l || t

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState<any[]>([])
  const [tasas, setTasas] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [fNombre, setFNombre] = useState('')
  const [fCedula, setFCedula] = useState('')
  const [fCargo, setFCargo] = useState('')
  const [fIngreso, setFIngreso] = useState(ymd(new Date()))
  const [fSalario, setFSalario] = useState('')
  const [saving, setSaving] = useState(false)

  const [diasEmp, setDiasEmp] = useState<any>(null)
  const [diasHist, setDiasHist] = useState<any[]>([])
  const [dTipo, setDTipo] = useState('disfrute')
  const [dFecha, setDFecha] = useState(ymd(new Date()))
  const [dDias, setDDias] = useState('')
  const [dNotas, setDNotas] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch('/api/empleados')
      setEmpleados(data.empleados || [])
      setTasas(data.tasas || {})
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_FAILED')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function openNew() {
    setEditing(null)
    setFNombre('')
    setFCedula('')
    setFCargo('')
    setFIngreso(ymd(new Date()))
    setFSalario('')
    setOpenForm(true)
  }

  function openEdit(e: any) {
    setEditing(e)
    setFNombre(e.nombre)
    setFCedula(e.cedula || '')
    setFCargo(e.cargo || '')
    setFIngreso(e.fecha_ingreso)
    setFSalario(String(e.salario_usd || ''))
    setOpenForm(true)
  }

  async function submitForm(e: any) {
    e.preventDefault()
    if (!fNombre.trim() || !fIngreso) return
    setSaving(true)
    setError('')
    try {
      const body = {
        nombre: fNombre.trim(),
        cedula: fCedula.trim(),
        cargo: fCargo.trim(),
        fecha_ingreso: fIngreso,
        salario_usd: Number(fSalario) || 0,
      }
      if (editing) await apiFetch(`/api/empleados/${editing.id}`, { method: 'PUT', body })
      else await apiFetch('/api/empleados', { method: 'POST', body })
      setOpenForm(false)
      load()
    } catch (e2: any) {
      setError(e2?.data?.error || 'SAVE_FAILED')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEmpleado(emp: any) {
    if (!confirm(`¿Eliminar empleado "${emp.nombre}"? Se borrará su historial de días.`)) return
    try {
      await apiFetch(`/api/empleados/${emp.id}`, { method: 'DELETE' })
      load()
    } catch (e2: any) {
      setError(e2?.data?.error || 'DELETE_FAILED')
    }
  }

  async function openDias(emp: any) {
    setDiasEmp(emp)
    setDTipo('disfrute')
    setDFecha(ymd(new Date()))
    setDDias('')
    setDNotas('')
    try {
      const data = await apiFetch(`/api/empleados/${emp.id}/dias`)
      setDiasHist(data.dias || [])
    } catch {
      setDiasHist([])
    }
  }

  async function submitDia(e: any) {
    e.preventDefault()
    const dias = Number(dDias)
    if (!dias || dias <= 0 || !diasEmp) return
    setSaving(true)
    setError('')
    try {
      await apiFetch(`/api/empleados/${diasEmp.id}/dias`, {
        method: 'POST',
        body: { tipo: dTipo, fecha: dFecha, dias, notas: dNotas.trim() },
      })
      setDDias('')
      setDNotas('')
      const data = await apiFetch(`/api/empleados/${diasEmp.id}/dias`)
      setDiasHist(data.dias || [])
      load()
    } catch (e2: any) {
      setError(e2?.data?.error || 'SAVE_FAILED')
    } finally {
      setSaving(false)
    }
  }

  async function deleteDia(d: any) {
    if (!confirm(`¿Eliminar registro de ${fmt(d.dias)} día(s) de ${tipoLabel(d.tipo)}?`)) return
    try {
      await apiFetch(`/api/empleados/dias/${d.id}`, { method: 'DELETE' })
      const data = await apiFetch(`/api/empleados/${diasEmp.id}/dias`)
      setDiasHist(data.dias || [])
      load()
    } catch (e2: any) {
      setError(e2?.data?.error || 'DELETE_FAILED')
    }
  }

  const filtered = q.trim()
    ? empleados.filter(
        (e) =>
          e.nombre.toLowerCase().includes(q.toLowerCase()) ||
          (e.cedula || '').includes(q) ||
          (e.cargo || '').toLowerCase().includes(q.toLowerCase()),
      )
    : empleados

  const [hoyYmd] = useState(() => ymd(new Date()))
  const [limite30d] = useState(() => ymd(new Date(Date.now() + 30 * 86400000)))

  return (
    <>
      <div className="bg-white px-3 md:px-0 py-3 flex flex-col gap-2 border-b border-depo-border-2 md:bg-transparent">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-medium text-depo-dark tracking-tight">Empleados</div>
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase">Vacaciones · prestaciones · utilidades · bonos</div>
          </div>
          <button onClick={openNew}
            className="bg-depo-dark text-white border-none rounded-lg py-2 px-4 text-[12px] font-semibold cursor-pointer transition-colors hover:bg-[#333] tracking-wide active:scale-[0.97]">
            + Nuevo
          </button>
        </div>
        <div className="relative">
          <input
            className="w-full bg-depo-input border border-depo-border-2 rounded-xl py-2.5 px-3 text-[13px] text-depo-dark outline-none transition-colors focus:border-depo-dark focus:bg-white placeholder:text-depo-gray-3"
            placeholder="Buscar empleado por nombre, cédula o cargo..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}

        <div className="mb-3 text-[11px] text-depo-gray-3 tracking-wide">
          Tasas: Prestaciones {tasas.prestaciones ?? 60} días/año · Vacaciones 30 (15 disfrute + 15 bono) · Utilidades {tasas.utilidades ?? 30} días/año · día = salario/30
        </div>

        <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F0EDE6] flex items-center justify-between">
            <span className="text-[13px] font-medium text-depo-dark">Listado de empleados</span>
            <span className="text-xs text-depo-gray-3">{filtered.length} empleado{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[860px]">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Nombre</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Cargo</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Ingreso</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Aniversario</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Salario</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Saldos (días)</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => {
                  const prox = emp.proximo_aniversario
                  const esProx = prox && prox >= hoyYmd && prox <= limite30d
                  return (
                    <tr key={emp.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                      <td className="px-3 md:px-6 py-[14px] text-[13px] font-medium text-depo-dark">
                        {emp.nombre}
                        {emp.cedula && <span className="block text-[11px] font-normal text-depo-gray-3 font-mono">{emp.cedula}</span>}
                      </td>
                      <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2">{emp.cargo || <span className="text-[#CCC]">—</span>}</td>
                      <td className="px-3 md:px-6 py-[14px] text-[13px] font-mono text-depo-gray-2">{emp.fecha_ingreso}</td>
                      <td className="px-3 md:px-6 py-[14px] text-[13px] font-mono">
                        {prox ? (
                          <span className={esProx ? 'text-amber-700 font-semibold' : 'text-depo-gray-2'}>{prox}{esProx ? ' 📅' : ''}</span>
                        ) : '—'}
                      </td>
                      <td className="px-3 md:px-6 py-[14px] text-[13px] font-mono text-right text-depo-dark">${fmt(emp.salario_usd)}</td>
                      <td className="px-3 md:px-6 py-[14px]">
                        <div className="flex flex-wrap gap-1">
                          {TIPOS.map((t) => {
                            const s = emp.saldos?.[t.v]
                            if (!s) return null
                            return (
                              <span key={t.v} title={`${t.l}: acumulado ${s.acumulado} · usado ${s.registrado} · saldo ${s.saldo}`}
                                className={`inline-block px-[7px] py-[2px] rounded text-[10.5px] font-mono font-medium ${
                                  s.saldo > 0 ? 'bg-emerald-50 text-emerald-700' : s.saldo < 0 ? 'bg-rose-50 text-rose-600' : 'bg-depo-bg text-depo-gray-3'
                                }`}>
                                {t.icon} {s.saldo}
                              </span>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-[14px]">
                        <div className="flex gap-[6px] justify-end">
                          <button onClick={() => openDias(emp)}
                            className="bg-depo-dark border-none text-white text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-[#333] font-sans">
                            Días
                          </button>
                          <button onClick={() => openEdit(emp)}
                            className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans">
                            Editar
                          </button>
                          <button onClick={() => deleteEmpleado(emp)}
                            className="bg-depo-bg border border-depo-border-2 text-[#DC2626] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-rose-50 hover:border-rose-300 font-sans">
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!loading && filtered.length === 0 && (
                  <tr><td className="px-4 py-8 text-center text-sm text-depo-gray-3" colSpan={7}>Sin empleados registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal empleado */}
      {openForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpenForm(false)} />
          <div className="relative bg-white rounded-xl w-[420px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-medium text-depo-dark px-7 pt-7 pb-0 shrink-0">{editing ? 'Editar empleado' : 'Nuevo empleado'}</div>
            <form onSubmit={submitForm} className="space-y-[14px] overflow-y-auto px-7 py-5">
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Nombre *</label>
                <input className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={fNombre} onChange={(e) => setFNombre(e.target.value)} placeholder="Ej: María López" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Cédula</label>
                  <input className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                    value={fCedula} onChange={(e) => setFCedula(e.target.value)} placeholder="V-12345678" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Cargo</label>
                  <input className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                    value={fCargo} onChange={(e) => setFCargo(e.target.value)} placeholder="Ej: Cocinero" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Fecha de ingreso *</label>
                  <input type="date" className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                    value={fIngreso} onChange={(e) => setFIngreso(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Salario (USD)</label>
                  <input type="number" step="0.01" min="0" className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                    value={fSalario} onChange={(e) => setFSalario(e.target.value)} placeholder="0.00" />
                  <div className="text-[11px] text-depo-gray-3 mt-1">Se usa para valorizar los días (día = salario/30)</div>
                </div>
              </div>
              <div className="flex gap-2 pt-2 justify-end">
                <button type="button" onClick={() => setOpenForm(false)}
                  className="bg-transparent border border-depo-border-2 text-[#666] px-[18px] py-[9px] rounded-md text-[13px] font-sans cursor-pointer hover:border-[#999]">
                  Cancelar
                </button>
                <button type="submit" disabled={saving || !fNombre.trim() || !fIngreso}
                  className="bg-depo-dark text-white border-none px-[22px] py-[9px] rounded-md text-[13px] font-medium font-sans cursor-pointer hover:bg-[#333] disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal control de días */}
      {diasEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={() => setDiasEmp(null)} />
          <div className="relative bg-white rounded-xl w-[560px] max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-7 pt-7 pb-0 shrink-0">
              <div className="text-base font-medium text-depo-dark">Control de días — {diasEmp.nombre}</div>
              <div className="text-[11px] text-depo-gray-3 mt-0.5">
                Ingreso {diasEmp.fecha_ingreso} · {fmt(diasEmp.anios)} años · día = ${fmt(diasEmp.valor_dia)}
              </div>
            </div>

            <div className="overflow-y-auto px-7 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {TIPOS.map((t) => {
                  const s = diasEmp.saldos?.[t.v]
                  if (!s) return null
                  return (
                    <div key={t.v} className="border border-depo-border rounded-lg p-3 bg-depo-bg">
                      <div className="text-[11px] font-semibold text-depo-dark flex items-center gap-1">{t.icon} {t.l}</div>
                      <div className="text-[11px] text-depo-gray-3 mt-1 font-mono">
                        acum. {s.acumulado} − usado {s.registrado}
                      </div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className={`text-xl font-bold font-mono ${s.saldo >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmt(s.saldo)}</span>
                        <span className="text-[11px] text-depo-gray-3 font-mono">${fmt(s.valor_saldo)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <form onSubmit={submitDia} className="border border-depo-border rounded-lg p-3 flex flex-wrap items-end gap-2.5">
                <div>
                  <label className="text-[10px] font-medium text-depo-gray-3 tracking-wider uppercase block mb-1">Registrar</label>
                  <select value={dTipo} onChange={(e) => setDTipo(e.target.value)}
                    className="bg-depo-bg border border-depo-border-2 rounded-md py-[7px] px-2 text-[12.5px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans">
                    {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-depo-gray-3 tracking-wider uppercase block mb-1">Fecha</label>
                  <input type="date" value={dFecha} onChange={(e) => setDFecha(e.target.value)}
                    className="bg-depo-bg border border-depo-border-2 rounded-md py-[7px] px-2 text-[12.5px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-depo-gray-3 tracking-wider uppercase block mb-1">Días *</label>
                  <input type="number" step="0.5" min="0.5" value={dDias} onChange={(e) => setDDias(e.target.value)} placeholder="0"
                    className="bg-depo-bg border border-depo-border-2 rounded-md py-[7px] px-2 text-[12.5px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans w-[70px]" />
                </div>
                <div className="flex-1 min-w-[110px]">
                  <label className="text-[10px] font-medium text-depo-gray-3 tracking-wider uppercase block mb-1">Notas</label>
                  <input value={dNotas} onChange={(e) => setDNotas(e.target.value)} placeholder="Ej: disfrute anual"
                    className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[7px] px-2 text-[12.5px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans" />
                </div>
                <button type="submit" disabled={saving || !Number(dDias)}
                  className="bg-depo-dark text-white border-none px-4 py-[7px] rounded-md text-[12.5px] font-medium font-sans cursor-pointer hover:bg-[#333] disabled:opacity-60">
                  Registrar
                </button>
              </form>

              <div>
                <div className="text-[12px] font-semibold text-depo-dark mb-1.5">Historial</div>
                {diasHist.length === 0 ? (
                  <div className="text-[13px] text-depo-gray-3 py-2">Sin días registrados</div>
                ) : (
                  <table className="w-full border-collapse text-[12.5px]">
                    <thead>
                      <tr>
                        <th className="text-left text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-2 py-1.5 border-b border-[#F0EDE6]">Fecha</th>
                        <th className="text-left text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-2 py-1.5 border-b border-[#F0EDE6]">Tipo</th>
                        <th className="text-right text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-2 py-1.5 border-b border-[#F0EDE6]">Días</th>
                        <th className="text-left text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-2 py-1.5 border-b border-[#F0EDE6]">Notas</th>
                        <th className="text-right text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-2 py-1.5 border-b border-[#F0EDE6]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {diasHist.map((d) => (
                        <tr key={d.id} className="border-b border-[#F5F3EE]">
                          <td className="px-2 py-1.5 font-mono text-depo-gray-2">{d.fecha}</td>
                          <td className="px-2 py-1.5">{tipoLabel(d.tipo)}</td>
                          <td className="px-2 py-1.5 font-mono text-right font-semibold">{fmt(d.dias)}</td>
                          <td className="px-2 py-1.5 text-depo-gray-3">{d.notas || '—'}</td>
                          <td className="px-2 py-1.5 text-right">
                            <button onClick={() => deleteDia(d)} className="text-[11px] text-rose-600 hover:underline">borrar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="px-7 pb-6 pt-1 shrink-0">
              <button onClick={() => setDiasEmp(null)}
                className="bg-depo-dark text-white border-none px-[22px] py-[9px] rounded-md text-[13px] font-medium font-sans cursor-pointer hover:bg-[#333]">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
