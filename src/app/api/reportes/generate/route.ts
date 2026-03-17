import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const REPORTES_DIR = path.join(process.cwd(), 'public', 'reportes')

// POST /api/reportes/generate
// Genera metadata del reporte y guarda en el directorio público
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const days: number = body.days ?? 14
    const tipo: string = body.tipo ?? 'automatico' // 'automatico' | 'manual'

    // Fetch data from Meta and GHL APIs
    const baseUrl = req.nextUrl.origin
    const [metaRes, ghlRes, fxRes] = await Promise.all([
      fetch(`${baseUrl}/api/meta?days=${days}`),
      fetch(`${baseUrl}/api/ghl?days=${days}`),
      fetch(`${baseUrl}/api/exchange-rate`),
    ])

    const [metaData, ghlData, fxData] = await Promise.all([
      metaRes.json(),
      ghlRes.json(),
      fxRes.json(),
    ])

    const rate: number = fxData.rate ?? 17.5
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '-')
    const filename = `reporte-icse-${dateStr}-${timeStr}.json`

    // Save report data as JSON (PDF generation happens client-side)
    if (!fs.existsSync(REPORTES_DIR)) {
      fs.mkdirSync(REPORTES_DIR, { recursive: true })
    }

    const reportData = {
      id: `${dateStr}-${timeStr}`,
      filename,
      fechaGeneracion: now.toISOString(),
      tipo,
      dias: days,
      tasaCambio: rate,
      meta: {
        kpis: metaData.kpis,
        totalCampanas: metaData.campaigns?.length ?? 0,
        campanas: (metaData.campaigns ?? []).slice(0, 10),
      },
      ghl: {
        contactos: ghlData.contacts,
        oportunidades: ghlData.opportunities,
        citas: ghlData.appointments,
      },
    }

    fs.writeFileSync(path.join(REPORTES_DIR, filename), JSON.stringify(reportData, null, 2))

    return NextResponse.json({ success: true, filename, id: reportData.id })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

// GET /api/reportes/generate → lista los reportes guardados
export async function GET() {
  try {
    if (!fs.existsSync(REPORTES_DIR)) {
      return NextResponse.json({ reportes: [] })
    }

    const files = fs.readdirSync(REPORTES_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()

    const reportes = files.map((f) => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(REPORTES_DIR, f), 'utf-8'))
        return {
          id: content.id,
          filename: f,
          fechaGeneracion: content.fechaGeneracion,
          tipo: content.tipo,
          dias: content.dias,
          campanas: content.meta?.totalCampanas ?? 0,
          leads: content.meta?.kpis?.totalLeads ?? 0,
          gasto: content.meta?.kpis?.totalSpend ?? 0,
          tasaCambio: content.tasaCambio ?? 17.5,
        }
      } catch {
        return null
      }
    }).filter(Boolean)

    return NextResponse.json({ reportes })
  } catch (error) {
    return NextResponse.json({ reportes: [], error: String(error) })
  }
}
