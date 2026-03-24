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

interface Adset {
  id: string
  name: string
  spend: number
  clicks: number
  impressions: number
  reach: number
  frequency: number
  ctr: number
  leads: number
  cpl: number
}

interface Ad {
  id: string
  name: string
  adset_name?: string
  spend: number
  clicks: number
  impressions: number
  reach: number
  frequency: number
  ctr: number
  leads: number
  cpl: number
}

interface DrillDownData {
  adsets: Adset[]
  ads: Ad[]
  bestCreative: Ad | null
  worstCreative: Ad | null
  error?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// fmt$ is defined inside the component after fetching the exchange rate
const fmtMXN = (usd: number, rate: number) =>
  `$${(usd * rate).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
const fmtN = (n: number, dec = 2) => n.toFixed(dec)
const fmtPct = (n: number) => `${fmtN(n, 2)}%`

function getRecommendation(ad: Ad, avgCpl: number): { label: string; color: string; emoji: string } {
  if (ad.leads === 0) return { label: 'Sin datos suficientes', color: 'text-gray-400', emoji: '⏸' }
  if (ad.cpl <= avgCpl * 0.7) return { label: 'ESCALAR', color: 'text-green-400', emoji: '🚀' }
  if (ad.cpl >= avgCpl * 1.5) return { label: 'PAUSAR', color: 'text-red-400', emoji: '🛑' }
  return { label: 'MANTENER', color: 'text-yellow-400', emoji: '✅' }
}

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
export default function CampanaPage() {
  const [days, setDays] = useState<7 | 14 | 30>(14)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [drillData, setDrillData] = useState<DrillDownData | null>(null)
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [drillLoading, setDrillLoading] = useState(false)
  const [exchangeRate, setExchangeRate] = useState<number>(17.5)
  const [currency, setCurrency] = useState<string>('USD')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const fetchCampaigns = useCallback(async (d: number) => {
    setCampaignsLoading(true)
    try {
      const [metaRes, fxRes] = await Promise.all([
        fetch(`/api/meta?days=${d}`),
        fetch('/api/exchange-rate'),
      ])
      const [data, fxData] = await Promise.all([metaRes.json(), fxRes.json()])
      const list: Campaign[] = data.campaigns ?? []
      setCampaigns(list)
      setCurrency(data.currency ?? 'USD')
      setExchangeRate(fxData.rate ?? 17.5)
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id)
      }
      setLastUpdate(new Date())
    } catch {
      setCampaigns([])
    } finally {
      setCampaignsLoading(false)
    }
  }, [selectedId])

  const fetchDrillDown = useCallback(async (campaignId: string, d: number) => {
    if (!campaignId) return
    setDrillLoading(true)
    setDrillData(null)
    try {
      const res = await fetch(`/api/meta?days=${d}&campaign_id=${campaignId}`)
      const data = await res.json()
      setDrillData(data)
    } catch {
      setDrillData({ adsets: [], ads: [], bestCreative: null, worstCreative: null, error: 'Error al cargar datos' })
    } finally {
      setDrillLoading(false)
    }
  }, [])

  // Initial load + scheduler 8am/6pm
  useEffect(() => {
    fetchCampaigns(days)

    const scheduleNext = () => {
      const delay = msUntilNextRefresh()
      timeoutRef.current = setTimeout(() => {
        fetchCampaigns(days)
        scheduleNext()
      }, delay)
    }

    scheduleNext()
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [days, fetchCampaigns, msUntilNextRefresh])

  // Fetch drill-down when campaign or days change
  useEffect(() => {
    if (selectedId) fetchDrillDown(selectedId, days)
  }, [selectedId, days, fetchDrillDown])

  const selectedCampaign = campaigns.find((c) => c.id === selectedId)
  const ads = drillData?.ads ?? []
  const avgCpl = selectedCampaign?.cpl ?? 0
  const fmt$ = (amount: number) =>
    currency === 'MXN'
      ? `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
      : fmtMXN(amount, exchangeRate)
  const fmtN = (n: number, dec = 2) => n.toFixed(dec)
  const fmtPct = (n: number) => `${n.toFixed(2)}%`

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div id="pdf-campana-content">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Análisis por Campaña</h1>
            <p className="text-gray-400 text-sm mt-1">
              {lastUpdate
                ? `Actualizado: ${lastUpdate.toLocaleTimeString('es-MX')}`
                : 'Cargando datos…'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
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
            <ExportPdfButton
              targetId="pdf-campana-content"
              filename={`gravity-campana-${selectedCampaign?.name?.replace(/\s+/g, '-') ?? 'reporte'}-${new Date().toISOString().split('T')[0]}.pdf`}
            />
          </div>
        </div>

        {/* Campaign Selector */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Seleccionar Campaña
          </label>
          {campaignsLoading ? (
            <Skeleton className="h-10 w-full max-w-md" />
          ) : (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full max-w-md bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {campaigns.length === 0 ? (
                <option value="">Sin campañas activas</option>
              ) : (
                campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          )}
        </div>

        {drillData?.error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 mb-4 text-red-300 text-sm">
            ⚠ {drillData.error}
          </div>
        )}

        {/* Campaign KPIs */}
        {selectedCampaign && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              KPIs · {selectedCampaign.name}
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard label="Gasto" value={fmt$(selectedCampaign.spend)} icon="💸" color="blue" />
              <KpiCard label="Leads" value={String(selectedCampaign.leads)} icon="🎯" color="green" />
              <KpiCard label="CPL" value={fmt$(selectedCampaign.cpl)} icon="💰" color="yellow" sub="Costo por Lead" />
              <KpiCard label="CTR" value={fmtPct(selectedCampaign.ctr)} icon="🖱" color="purple" />
              <KpiCard label="Frecuencia" value={fmtN(selectedCampaign.frequency)} icon="🔁" color="pink" />
            </div>
          </section>
        )}

        {/* Adsets Table */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Conjuntos de Anuncios (Adsets)
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Adset', 'Gasto', 'Leads', 'CPL', 'CTR', 'Frecuencia', 'Alcance'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {drillLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (drillData?.adsets ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        Sin datos de adsets para este período
                      </td>
                    </tr>
                  ) : (
                    (drillData?.adsets ?? []).map((a) => (
                      <tr key={a.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-white max-w-[180px]">
                          <div className="truncate" title={a.name}>{a.name}</div>
                        </td>
                        <td className="px-4 py-3 text-blue-300 font-mono">{fmt$(a.spend)}</td>
                        <td className="px-4 py-3">
                          <span className="bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full font-semibold">
                            {a.leads}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-yellow-300 font-mono">{fmt$(a.cpl)}</td>
                        <td className="px-4 py-3 text-purple-300">{fmtPct(a.ctr)}</td>
                        <td className="px-4 py-3 text-gray-300">{fmtN(a.frequency)}</td>
                        <td className="px-4 py-3 text-gray-400">{a.reach.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Creativos Table */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Creativos / Anuncios
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Creativo', 'Adset', 'Gasto', 'Leads', 'CPL', 'CTR', 'Recomendación'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {drillLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : ads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        Sin creativos para este período
                      </td>
                    </tr>
                  ) : (
                    ads
                      .sort((a, b) => a.cpl - b.cpl)
                      .map((ad) => {
                        const rec = getRecommendation(ad, avgCpl)
                        const isBest = drillData?.bestCreative?.id === ad.id
                        const isWorst = drillData?.worstCreative?.id === ad.id
                        return (
                          <tr
                            key={ad.id}
                            className={`hover:bg-gray-800/50 transition-colors ${
                              isBest ? 'bg-green-900/10' : isWorst ? 'bg-red-900/10' : ''
                            }`}
                          >
                            <td className="px-4 py-3 max-w-[180px]">
                              <div className="flex items-center gap-2">
                                {isBest && <span title="Mejor creativo">🏆</span>}
                                {isWorst && !isBest && <span title="Peor creativo">📉</span>}
                                <span className="font-medium text-white truncate" title={ad.name}>
                                  {ad.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-400 max-w-[140px]">
                              <div className="truncate text-xs" title={ad.adset_name}>{ad.adset_name ?? '–'}</div>
                            </td>
                            <td className="px-4 py-3 text-blue-300 font-mono">{fmt$(ad.spend)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full font-semibold text-xs ${
                                ad.leads > 0 ? 'bg-green-500/20 text-green-300' : 'bg-gray-800 text-gray-500'
                              }`}>
                                {ad.leads}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-yellow-300 font-mono">{ad.leads > 0 ? fmt$(ad.cpl) : '–'}</td>
                            <td className="px-4 py-3 text-purple-300">{fmtPct(ad.ctr)}</td>
                            <td className="px-4 py-3">
                              <span className={`font-semibold text-sm ${rec.color}`}>
                                {rec.emoji} {rec.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Highlights + Recommendations */}
        {!drillLoading && drillData && (drillData.bestCreative || drillData.worstCreative) && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Resumen & Recomendaciones
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {drillData.bestCreative && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🏆</span>
                    <h3 className="font-semibold text-green-300">Mejor Creativo</h3>
                  </div>
                  <p className="text-white font-medium mb-2 text-sm">{drillData.bestCreative.name}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Gasto</p>
                      <p className="text-white font-mono">{fmt$(drillData.bestCreative.spend)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Leads</p>
                      <p className="text-green-300 font-semibold">{drillData.bestCreative.leads}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">CPL</p>
                      <p className="text-yellow-300 font-mono">{fmt$(drillData.bestCreative.cpl)}</p>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-green-900/30 rounded-lg">
                    <p className="text-green-300 text-xs font-semibold">🚀 RECOMENDACIÓN: ESCALAR</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Este creativo tiene el CPL más bajo. Considera incrementar el presupuesto del adset o duplicar la campaña.
                    </p>
                  </div>
                </div>
              )}

              {drillData.worstCreative && drillData.worstCreative.id !== drillData.bestCreative?.id && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">📉</span>
                    <h3 className="font-semibold text-red-300">Peor Creativo</h3>
                  </div>
                  <p className="text-white font-medium mb-2 text-sm">{drillData.worstCreative.name}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Gasto</p>
                      <p className="text-white font-mono">{fmt$(drillData.worstCreative.spend)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Leads</p>
                      <p className="text-red-300 font-semibold">{drillData.worstCreative.leads}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">CPL</p>
                      <p className="text-yellow-300 font-mono">{fmt$(drillData.worstCreative.cpl)}</p>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-red-900/30 rounded-lg">
                    <p className="text-red-300 text-xs font-semibold">🛑 RECOMENDACIÓN: PAUSAR</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Este creativo tiene el CPL más alto. Considera pausarlo y redirigir el presupuesto al mejor creativo.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Footer for PDF */}
        <div className="mt-8 pt-4 border-t border-gray-800 flex items-center justify-between">
          <p className="text-gray-600 text-xs">
            Instituto de Cosmetología Spa y Estética ICSE · Reporte generado el {new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}
          </p>
          <p className="text-gray-600 text-xs">Meta Ads · {selectedCampaign?.name ?? ''}</p>
        </div>
      </div>
    </div>
  )
}
