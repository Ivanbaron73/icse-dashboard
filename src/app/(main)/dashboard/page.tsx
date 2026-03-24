'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Campaign {
  id: string
  name: string
  status: string
  spend: number
  clicks: number
  impressions: number
  reach: number
  frequency: number
  ctr: number
  leads: number
  cpl: number
}

interface MetaData {
  kpis: {
    totalSpend: number
    totalLeads: number
    avgCpl: number
    avgCtr: number
    avgFrequency: number
  }
  campaigns: Campaign[]
  currency?: string
  error?: string
}

interface GhlData {
  contacts: { total: number; new: number } | null
  opportunities: { total: number; byStage: Record<string, number> } | null
  appointments: { total: number; scheduled: number; completed: number } | null
  errors: string[]
  days: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtMXN = (usd: number, rate: number) =>
  `$${(usd * rate).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
const fmtN = (n: number, dec = 2) => n.toFixed(dec)
const fmtPct = (n: number) => `${fmtN(n, 2)}%`

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  icon,
  sub,
  color = 'blue',
}: {
  label: string
  value: string
  icon: string
  sub?: string
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'pink'
}) {
  const accent: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    pink: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  }
  return (
    <div className={`rounded-xl border p-5 ${accent[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs mt-1 text-gray-500">{sub}</p>}
    </div>
  )
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded-lg ${className}`} />
}

function ExportPdfButton({ targetId, filename }: { targetId: string; filename: string }) {
  const [loading, setLoading] = useState(false)

  const exportPdf = async () => {
    setLoading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const element = document.getElementById(targetId)
      if (!element) return

      const canvas = await html2canvas(element, {
        scale: 1.5,
        backgroundColor: '#030712',
        useCORS: true,
        logging: false,
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = pdf.internal.pageSize.getHeight()
      const imgH = (canvas.height * pdfW) / canvas.width
      let remaining = imgH
      let yOffset = 0

      pdf.addImage(imgData, 'PNG', 0, yOffset, pdfW, imgH)
      remaining -= pdfH

      while (remaining > 0) {
        yOffset -= pdfH
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, yOffset, pdfW, imgH)
        remaining -= pdfH
      }

      pdf.save(filename)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={exportPdf}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        '⬇'
      )}
      Descargar PDF
    </button>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [days, setDays] = useState<7 | 14 | 30>(14)
  const [metaData, setMetaData] = useState<MetaData | null>(null)
  const [ghlData, setGhlData] = useState<GhlData | null>(null)
  const [exchangeRate, setExchangeRate] = useState<number>(17.5)
  const [metaLoading, setMetaLoading] = useState(true)
  const [ghlLoading, setGhlLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, setNextRefresh] = useState<string>('')

  // Calcula ms hasta la próxima actualización (8am o 6pm)
  const msUntilNextRefresh = useCallback((): number => {
    const now = new Date()
    const t8am = new Date(now); t8am.setHours(8, 0, 0, 0)
    const t6pm = new Date(now); t6pm.setHours(18, 0, 0, 0)
    if (now < t8am) return t8am.getTime() - now.getTime()
    if (now < t6pm) return t6pm.getTime() - now.getTime()
    const tomorrow8am = new Date(now)
    tomorrow8am.setDate(tomorrow8am.getDate() + 1)
    tomorrow8am.setHours(8, 0, 0, 0)
    return tomorrow8am.getTime() - now.getTime()
  }, [])

  const fetchAll = useCallback(async (d: number) => {
    setMetaLoading(true)
    setGhlLoading(true)

    await Promise.all([
      fetch(`/api/meta?days=${d}`)
        .then((r) => r.json())
        .then((data) => setMetaData(data))
        .catch(() => setMetaData({ kpis: { totalSpend: 0, totalLeads: 0, avgCpl: 0, avgCtr: 0, avgFrequency: 0 }, campaigns: [], error: 'Error al conectar con Meta Ads' }))
        .finally(() => setMetaLoading(false)),

      fetch(`/api/ghl?days=${d}`)
        .then((r) => r.json())
        .then((data) => setGhlData(data))
        .catch(() => setGhlData({ contacts: null, opportunities: null, appointments: null, errors: ['Error al conectar con GHL'], days: d }))
        .finally(() => setGhlLoading(false)),

      fetch('/api/exchange-rate')
        .then((r) => r.json())
        .then((data) => setExchangeRate(data.rate ?? 17.5))
        .catch(() => {}),
    ])

    setLastUpdate(new Date())
  }, [])

  useEffect(() => {
    fetchAll(days)

    // Actualiza a las 8am y 6pm (hora local)
    const scheduleNext = () => {
      const delay = msUntilNextRefresh()
      const nextTime = new Date(Date.now() + delay)
      setNextRefresh(nextTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }))
      timeoutRef.current = setTimeout(() => {
        fetchAll(days)
        scheduleNext()
      }, delay)
    }

    scheduleNext()
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [days, fetchAll, msUntilNextRefresh])

  const kpis = metaData?.kpis
  const campaigns = metaData?.campaigns ?? []
  // Si la cuenta ya está en MXN, no multiplicar por tipo de cambio
  const currency = metaData?.currency ?? 'USD'
  const fmt$ = (amount: number) =>
    currency === 'MXN'
      ? `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
      : fmtMXN(amount, exchangeRate)

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div id="pdf-content">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Panel General</h1>
            <p className="text-gray-400 text-sm mt-1">
              {lastUpdate
                ? `Actualizado: ${lastUpdate.toLocaleTimeString('es-MX')}`
                : 'Cargando datos…'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date range */}
            <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
              {([7, 14, 30] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                    days === d ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchAll(days)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Actualizar"
            >
              ↻
            </button>
            <ExportPdfButton targetId="pdf-content" filename={`icse-reporte-${new Date().toISOString().split('T')[0]}.pdf`} />
          </div>
        </div>

        {/* ── META ADS KPIs ── */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center text-xs font-bold">f</div>
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Meta Ads · Últimos {days} días</h2>
          </div>

          {metaData?.error && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 mb-4 text-red-300 text-sm">
              ⚠ {metaData.error}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {metaLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)
            ) : (
              <>
                <KpiCard label="Gasto Total" value={fmt$(kpis?.totalSpend ?? 0)} icon="💸" color="blue" sub={`${days} días`} />
                <KpiCard label="Leads" value={String(kpis?.totalLeads ?? 0)} icon="🎯" color="green" />
                <KpiCard label="CPL Promedio" value={fmt$(kpis?.avgCpl ?? 0)} icon="💰" color="yellow" sub="Costo por Lead" />
                <KpiCard label="CTR Promedio" value={fmtPct(kpis?.avgCtr ?? 0)} icon="🖱" color="purple" />
                <KpiCard label="Frecuencia" value={fmtN(kpis?.avgFrequency ?? 0)} icon="🔁" color="pink" sub="Promedio" />
              </>
            )}
          </div>
        </section>

        {/* ── Campaigns Table ── */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Campañas Activas
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Campaña', 'Gasto', 'Leads', 'CPL', 'CTR', 'Frecuencia', 'Alcance'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {metaLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        No hay campañas activas en este período
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-white max-w-[200px]">
                          <div className="truncate" title={c.name}>{c.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{c.status}</div>
                        </td>
                        <td className="px-4 py-3 text-blue-300 font-mono">{fmt$(c.spend)}</td>
                        <td className="px-4 py-3">
                          <span className="bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full font-semibold">
                            {c.leads}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-yellow-300 font-mono">{fmt$(c.cpl)}</td>
                        <td className="px-4 py-3 text-purple-300">{fmtPct(c.ctr)}</td>
                        <td className="px-4 py-3 text-gray-300">{fmtN(c.frequency)}</td>
                        <td className="px-4 py-3 text-gray-400">{c.reach.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── GHL Pipeline ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-orange-500 rounded flex items-center justify-center text-xs font-bold">G</div>
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Funnelead · Últimos {days} días
            </h2>
          </div>

          {ghlData?.errors && ghlData.errors.length > 0 && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 mb-4 flex items-start gap-3">
              <span className="text-2xl mt-0.5">🔧</span>
              <div>
                <p className="text-gray-300 font-medium text-sm">CRM en configuración</p>
                <p className="text-gray-500 text-xs mt-1">
                  Los datos de Funnelead aparecerán aquí automáticamente cuando estén disponibles.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {ghlLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)
            ) : (
              <>
                <KpiCard
                  label="Contactos Nuevos"
                  value={String(ghlData?.contacts?.new ?? 0)}
                  icon="👤"
                  color="green"
                  sub={`en ${days} días`}
                />
                <KpiCard
                  label="Citas Agendadas"
                  value={String(ghlData?.appointments?.scheduled ?? 0)}
                  icon="📅"
                  color="blue"
                  sub={`${ghlData?.appointments?.completed ?? 0} completadas`}
                />
                <KpiCard
                  label="Oportunidades"
                  value={String(ghlData?.opportunities?.total ?? 0)}
                  icon="💼"
                  color="purple"
                  sub="En pipeline"
                />
              </>
            )}
          </div>

          {/* Pipeline stages */}
          {!ghlLoading && ghlData?.opportunities?.byStage && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-400 mb-4">Pipeline por Etapa</h3>
              <div className="space-y-3">
                {Object.entries(ghlData.opportunities.byStage).length === 0 ? (
                  <p className="text-gray-500 text-sm">Sin datos de pipeline</p>
                ) : (
                  (() => {
                    const total = ghlData.opportunities?.total ?? 1
                    return Object.entries(ghlData.opportunities!.byStage)
                      .sort(([, a], [, b]) => b - a)
                      .map(([stage, count]) => {
                        const pct = Math.round((count / total) * 100)
                        return (
                          <div key={stage}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-300 truncate">{stage}</span>
                              <span className="text-gray-400 ml-2 flex-shrink-0">{count} ({pct}%)</span>
                            </div>
                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })
                  })()
                )}
              </div>
            </div>
          )}
        </section>

        {/* Footer for PDF */}
        <div className="mt-8 pt-4 border-t border-gray-800 flex items-center justify-between">
          <p className="text-gray-600 text-xs">
            Instituto de Cosmetología Spa y Estética ICSE · Reporte generado el {new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}
          </p>
          <p className="text-gray-600 text-xs">Meta Ads · Funnelead CRM</p>
        </div>
      </div>
    </div>
  )
}
