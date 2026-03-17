import { NextRequest, NextResponse } from 'next/server'

const GHL_BASE = 'https://services.leadconnectorhq.com'
const TOKEN = process.env.GHL_API_TOKEN!
const LOCATION_ID = process.env.GHL_LOCATION_ID!

const GHL_HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Version: '2021-07-28',
  'Content-Type': 'application/json',
}

async function ghlGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${GHL_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: GHL_HEADERS,
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GHL API error ${res.status}: ${err}`)
  }
  return res.json()
}

// GET /api/ghl?days=14
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const days = Number(searchParams.get('days') ?? '14')

  const now = Date.now()
  const startMs = now - days * 24 * 60 * 60 * 1000

  const results: {
    contacts: { total: number; new: number } | null
    opportunities: { total: number; byStage: Record<string, number> } | null
    appointments: { total: number; completed: number; scheduled: number } | null
    errors: string[]
  } = {
    contacts: null,
    opportunities: null,
    appointments: null,
    errors: [],
  }

  // ── Contacts ──
  try {
    const data = await ghlGet('/contacts/', {
      locationId: LOCATION_ID,
    })
    const contacts: Array<{ dateAdded?: string; createdAt?: string }> =
      data.contacts ?? data.data ?? []

    const newInPeriod = contacts.filter((c) => {
      const created = c.dateAdded ?? c.createdAt
      if (!created) return false
      return new Date(created).getTime() >= startMs
    }).length

    results.contacts = {
      total: data.total ?? contacts.length,
      new: newInPeriod,
    }
  } catch (e) {
    results.errors.push(`contacts:${e instanceof Error ? e.message : e}`)
    results.contacts = { total: 0, new: 0 }
  }

  // ── Opportunities ──
  try {
    const data = await ghlGet('/opportunities/search', {
      location_id: LOCATION_ID,
    })
    const opps: Array<{
      stage?: { name?: string }
      pipelineStageId?: string
      status?: string
      createdAt?: string
    }> = data.opportunities ?? data.data ?? []

    // Try to fetch pipeline stage names
    let stageNames: Record<string, string> = {}
    try {
      const pipelinesData = await ghlGet('/opportunities/pipelines', {
        locationId: LOCATION_ID,
      })
      const pipelines: Array<{
        stages?: Array<{ id: string; name: string }>
      }> = pipelinesData.pipelines ?? pipelinesData.data ?? []
      for (const pipeline of pipelines) {
        for (const stage of pipeline.stages ?? []) {
          stageNames[stage.id] = stage.name
        }
      }
    } catch {
      // Stage names optional — IDs as fallback
    }

    const byStage: Record<string, number> = {}
    for (const opp of opps) {
      const stageId = opp.stage?.name ?? opp.pipelineStageId ?? 'Sin etapa'
      const stageName = stageNames[stageId] ?? stageId
      byStage[stageName] = (byStage[stageName] ?? 0) + 1
    }

    results.opportunities = {
      total: opps.length,
      byStage,
    }
  } catch (e) {
    results.errors.push(`opportunities:${e instanceof Error ? e.message : e}`)
    results.opportunities = { total: 0, byStage: {} }
  }

  // ── Appointments via Calendars ──
  try {
    const calendarsData = await ghlGet('/calendars/', {
      locationId: LOCATION_ID,
    })
    const calendars: Array<{ id: string; name: string }> =
      calendarsData.calendars ?? calendarsData.data ?? []

    if (calendars.length === 0) {
      results.appointments = { total: 0, scheduled: 0, completed: 0 }
    } else {
      const calendarId = calendars[0].id
      const eventsData = await ghlGet('/calendars/events', {
        locationId: LOCATION_ID,
        calendarId,
        startTime: startMs.toString(),
        endTime: now.toString(),
      })

      const events: Array<{ status?: string; appointmentStatus?: string }> =
        eventsData.events ?? eventsData.data ?? []

      const scheduled = events.filter(
        (e) =>
          e.status === 'confirmed' ||
          e.appointmentStatus === 'confirmed' ||
          e.status === 'new' ||
          e.status === 'booked'
      ).length
      const completed = events.filter(
        (e) =>
          e.status === 'showed' ||
          e.appointmentStatus === 'showed' ||
          e.status === 'completed'
      ).length

      results.appointments = {
        total: events.length,
        scheduled,
        completed,
      }
    }
  } catch (e) {
    results.errors.push(`appointments:${e instanceof Error ? e.message : e}`)
    results.appointments = { total: 0, scheduled: 0, completed: 0 }
  }

  return NextResponse.json({ ...results, periodStart: new Date(startMs).toISOString(), days })
}
