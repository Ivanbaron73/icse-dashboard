'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface Reporte {
  id: string
  filename: string
  fechaGeneracion: string
  tipo: 'automatico' | 'manual'
  dias: number
  campanas: number
  leads: number
  gasto: number
  tasaCambio: number
}

const FULL_NAME = 'Instituto de Cosmetología Spa y Estética ICSE'

// Días en que se genera automáticamente: lunes (1) y jueves (4)
const AUTO_DAYS = [1, 4]
const AUTO_HOUR = 8

function msUntilNextAutoReport(): number {
  const now = new Date()
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(now)
    candidate.setDate(now.getDate() + offset)
    candidate.setHours(AUTO_HOUR, 0, 0, 0)
    if (candidate > now && AUTO_DAYS.includes(candidate.getDay())) {
      return candidate.getTime() - now.getTime()
    }
  }
  return 7 * 24 * 60 * 60 * 1000 // fallback 1 semana
}

function getNextAutoDate(): string {
  const now = new Date()
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(now)
    candidate.setDate(now.getDate() + offset)
    candidate.setHours(AUTO_HOUR, 0, 0, 0)
    if (candidate > now && AUTO_DAYS.includes(candidate.getDay())) {
      return candidate.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }
  return '—'
}

export default function ReportesPage() {
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [nextAutoDate, setNextAutoDate] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchReportes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reportes/generate')
      const data = await res.json()
      setReportes(data.reportes ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  const generateManual = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/reportes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 14, tipo: 'manual' }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchReportes()
      }
    } finally {
      setGenerating(false)
    }
  }

  const generateAuto = useCallback(async () => {
    await fetch('/api/reportes/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 14, tipo: 'automatico' }),
    })
    await fetchReportes()
    // Schedule next
    const delay = msUntilNextAutoReport()
    setNextAutoDate(getNextAutoDate())
    timeoutRef.current = setTimeout(generateAuto, delay)
  }, [fetchReportes])

  useEffect(() => {
    fetchReportes()
    setNextAutoDate(getNextAutoDate())

    // Schedule auto generation on mount
    const delay = msUntilNextAutoReport()
    timeoutRef.current = setTimeout(generateAuto, delay)

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [fetchReportes, generateAuto])

  const downloadReport = async (reporte: Reporte) => {
    // Fetch the JSON data and trigger PDF generation
    try {
      const res = await fetch(`/reportes/${reporte.filename}`)
      const data = await res.json()

      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const rate = data.tasaCambio ?? 17.5
      const kpis = data.meta?.kpis ?? {}
      const campanas = data.meta?.campanas ?? []
      const ghl = data.ghl ?? {}

      const fmt$ = (usd: number) =>
        `$${(usd * rate).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`

      // Build a temporary HTML element for PDF rendering
      const div = document.createElement('div')
      div.style.cssText = `
        position: fixed; left: -9999px; top: 0;
        width: 800px; background: #030712; color: white;
        font-family: system-ui, sans-serif; padding: 40px;
      `
      div.innerHTML = `
        <div style="margin-bottom:32px; border-bottom: 1px solid #1f2937; padding-bottom: 20px;">
          <div style="font-size:24px; font-weight:bold; color:white;">${FULL_NAME}</div>
          <div style="color:#6b7280; font-size:13px; margin-top:4px;">
            Reporte de Marketing · ${new Date(data.fechaGeneracion).toLocaleDateString('es-MX', { dateStyle: 'long' })} · Últimos ${data.dias} días
          </div>
        </div>

        <div style="font-size:13px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:1px; margin-bottom:16px;">KPIs Meta Ads</div>
        <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:32px;">
          ${[
            ['Gasto Total', fmt$(kpis.totalSpend ?? 0)],
            ['Leads', kpis.totalLeads ?? 0],
            ['CPL', fmt$(kpis.avgCpl ?? 0)],
            ['CTR', `${(kpis.avgCtr ?? 0).toFixed(2)}%`],
            ['Frecuencia', (kpis.avgFrequency ?? 0).toFixed(2)],
          ].map(([label, value]) => `
            <div style="background:#111827; border:1px solid #1f2937; border-radius:12px; padding:16px;">
              <div style="color:#6b7280; font-size:11px; margin-bottom:8px;">${label}</div>
              <div style="color:white; font-weight:bold; font-size:18px;">${value}</div>
            </div>
          `).join('')}
        </div>

        <div style="font-size:13px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:1px; margin-bottom:16px;">Campañas Activas</div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:32px; font-size:12px;">
          <thead>
            <tr style="border-bottom:1px solid #1f2937;">
              ${['Campaña','Gasto','Leads','CPL','CTR','Frec.'].map(h => `<th style="padding:8px 12px; text-align:left; color:#6b7280; font-size:11px;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${campanas.map((c: { name: string; spend: number; leads: number; cpl: number; ctr: number; frequency: number }) => `
              <tr style="border-bottom:1px solid #111827;">
                <td style="padding:8px 12px; color:white;">${c.name}</td>
                <td style="padding:8px 12px; color:#60a5fa;">${fmt$(c.spend)}</td>
                <td style="padding:8px 12px; color:#34d399;">${c.leads}</td>
                <td style="padding:8px 12px; color:#fbbf24;">${fmt$(c.cpl)}</td>
                <td style="padding:8px 12px; color:#c084fc;">${c.ctr.toFixed(2)}%</td>
                <td style="padding:8px 12px; color:#9ca3af;">${c.frequency.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="font-size:13px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:1px; margin-bottom:16px;">Funnelead CRM</div>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:32px;">
          ${[
            ['Contactos Nuevos', ghl.contactos?.new ?? 0],
            ['Citas Agendadas', ghl.citas?.scheduled ?? 0],
            ['Oportunidades', ghl.oportunidades?.total ?? 0],
          ].map(([label, value]) => `
            <div style="background:#111827; border:1px solid #1f2937; border-radius:12px; padding:16px;">
              <div style="color:#6b7280; font-size:11px; margin-bottom:8px;">${label}</div>
              <div style="color:white; font-weight:bold; font-size:24px;">${value}</div>
            </div>
          `).join('')}
        </div>

        <div style="border-top:1px solid #1f2937; padding-top:16px; display:flex; justify-content:space-between;">
          <div style="color:#374151; font-size:11px;">${FULL_NAME}</div>
          <div style="color:#374151; font-size:11px;">Tipo de cambio: $${rate.toFixed(2)} MXN/USD</div>
        </div>
      `
      document.body.appendChild(div)

      const canvas = await html2canvas(div, {
        scale: 1.5,
        backgroundColor: '#030712',
        useCORS: true,
        logging: false,
      })
      document.body.removeChild(div)

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

      pdf.save(`icse-reporte-${reporte.id}.pdf`)
    } catch (e) {
      alert(`Error al generar PDF: ${e}`)
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Reportes PDF</h1>
          <p className="text-gray-400 text-sm mt-1">
            Generación automática: <span className="text-blue-300">lunes y jueves a las 8:00 am</span>
          </p>
        </div>
        <button
          onClick={generateManual}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {generating ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : '📄'}
          Generar ahora
        </button>
      </div>

      {/* Next auto-report */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 flex items-center gap-4">
        <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center text-xl">⏰</div>
        <div>
          <p className="text-gray-400 text-xs">Próximo reporte automático</p>
          <p className="text-white font-medium capitalize">{nextAutoDate}</p>
        </div>
      </div>

      {/* Reports list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reportes.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-white font-medium">Sin reportes aún</p>
          <p className="text-gray-500 text-sm mt-1">
            Haz clic en "Generar ahora" para crear tu primer reporte
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reportes.map((r) => {
            const rate = r.tasaCambio ?? 17.5
            const gastoMXN = (r.gasto * rate).toLocaleString('es-MX', {
              style: 'currency',
              currency: 'MXN',
              maximumFractionDigits: 0,
            })
            return (
              <div
                key={r.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                    {r.tipo === 'automatico' ? '⚙' : '📄'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium text-sm">
                        Reporte {new Date(r.fechaGeneracion).toLocaleDateString('es-MX', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        r.tipo === 'automatico'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {r.tipo === 'automatico' ? 'Automático' : 'Manual'}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {r.campanas} campañas · {r.leads} leads · {gastoMXN} · Últimos {r.dias} días
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => downloadReport(r)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-sm rounded-lg transition-colors flex-shrink-0"
                >
                  ⬇ PDF
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
