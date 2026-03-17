import { NextRequest, NextResponse } from 'next/server'

const BASE = 'https://graph.facebook.com/v19.0'

// Leer token dinámicamente en cada request (permite rotación sin restart)
function getToken(): string {
  const t = process.env.META_ACCESS_TOKEN
  if (!t) throw new Error('META_ACCESS_TOKEN no configurado')
  return t
}

function getAccountId(): string {
  const id = process.env.META_AD_ACCOUNT_ID
  if (!id) throw new Error('META_AD_ACCOUNT_ID no configurado')
  return id
}

function isTokenError(status: number, body: string): boolean {
  // Códigos Meta: 190 = token inválido/expirado, 104 = no autenticado
  return status === 400 && (body.includes('"code":190') || body.includes('"code":104'))
}

function extractLeads(actions: Array<{ action_type: string; value: string }> = []): number {
  const leadTypes = [
    'lead',
    'offsite_conversion.fb_pixel_lead',
    'onsite_conversion.messaging_conversation_started_7d',
    'contact_total',
  ]
  return actions
    .filter((a) => leadTypes.includes(a.action_type))
    .reduce((sum, a) => sum + Number(a.value), 0)
}

async function fetchWithToken(url: string) {
  const token = getToken()
  const separator = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${separator}access_token=${token}`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.text()
    if (isTokenError(res.status, err)) {
      const e = new Error('TOKEN_EXPIRED')
      ;(e as Error & { tokenExpired: boolean }).tokenExpired = true
      throw e
    }
    throw new Error(`Meta API error: ${res.status} – ${err}`)
  }
  return res.json()
}

// GET /api/meta?days=14               → campaigns overview
// GET /api/meta?days=14&campaign_id=X → adsets + ads breakdown
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const days = searchParams.get('days') ?? '14'
  const campaignId = searchParams.get('campaign_id')

  const datePreset =
    days === '7' ? 'last_7d' : days === '30' ? 'last_30d' : 'last_14d'
  const ACCOUNT_ID = getAccountId()

  try {
    if (campaignId) {
      // ── Drill-down: adsets + ads for a single campaign ──
      const insightFields =
        'adset_id,adset_name,ad_id,ad_name,spend,clicks,impressions,reach,frequency,ctr,cpc,actions'

      const [adsetData, adData] = await Promise.all([
        fetchWithToken(
          `${BASE}/${campaignId}/insights?level=adset&fields=adset_id,adset_name,spend,clicks,impressions,reach,frequency,ctr,cpc,actions&date_preset=${datePreset}&limit=500`
        ),
        fetchWithToken(
          `${BASE}/${campaignId}/insights?level=ad&fields=${insightFields}&date_preset=${datePreset}&limit=500`
        ),
      ])

      const adsets = (adsetData.data ?? []).map(
        (row: {
          adset_id: string
          adset_name: string
          spend: string
          clicks: string
          impressions: string
          reach: string
          frequency: string
          ctr: string
          cpc: string
          actions?: Array<{ action_type: string; value: string }>
        }) => {
          const leads = extractLeads(row.actions)
          const spend = Number(row.spend ?? 0)
          return {
            id: row.adset_id,
            name: row.adset_name,
            spend,
            clicks: Number(row.clicks ?? 0),
            impressions: Number(row.impressions ?? 0),
            reach: Number(row.reach ?? 0),
            frequency: Number(row.frequency ?? 0),
            ctr: Number(row.ctr ?? 0),
            cpc: Number(row.cpc ?? 0),
            leads,
            cpl: leads > 0 ? spend / leads : 0,
          }
        }
      )

      const ads = (adData.data ?? []).map(
        (row: {
          ad_id: string
          ad_name: string
          adset_id?: string
          adset_name?: string
          spend: string
          clicks: string
          impressions: string
          reach: string
          frequency: string
          ctr: string
          cpc: string
          actions?: Array<{ action_type: string; value: string }>
        }) => {
          const leads = extractLeads(row.actions)
          const spend = Number(row.spend ?? 0)
          return {
            id: row.ad_id,
            name: row.ad_name,
            adset_id: row.adset_id,
            adset_name: row.adset_name,
            spend,
            clicks: Number(row.clicks ?? 0),
            impressions: Number(row.impressions ?? 0),
            reach: Number(row.reach ?? 0),
            frequency: Number(row.frequency ?? 0),
            ctr: Number(row.ctr ?? 0),
            cpc: Number(row.cpc ?? 0),
            leads,
            cpl: leads > 0 ? spend / leads : 0,
          }
        }
      )

      // Identify best and worst creatives
      const adsWithLeads = ads.filter((a: { leads: number }) => a.leads > 0)
      const bestCreative =
        adsWithLeads.length > 0
          ? adsWithLeads.reduce(
              (best: { cpl: number }, ad: { cpl: number }) =>
                ad.cpl < best.cpl ? ad : best,
              adsWithLeads[0]
            )
          : null
      const worstCreative =
        adsWithLeads.length > 1
          ? adsWithLeads.reduce(
              (worst: { cpl: number }, ad: { cpl: number }) =>
                ad.cpl > worst.cpl ? ad : worst,
              adsWithLeads[0]
            )
          : null

      return NextResponse.json({ adsets, ads, bestCreative, worstCreative })
    }

    // ── Overview: all campaigns with insights ──
    const [campaignsRaw, insightsRaw] = await Promise.all([
      fetchWithToken(
        `${BASE}/${ACCOUNT_ID}/campaigns?fields=id,name,status,objective&effective_status=["ACTIVE"]&limit=500`
      ),
      fetchWithToken(
        `${BASE}/${ACCOUNT_ID}/insights?level=campaign&fields=campaign_id,campaign_name,spend,clicks,impressions,reach,frequency,ctr,cpc,actions&date_preset=${datePreset}&limit=500`
      ),
    ])

    const insightsMap = new Map<string, (typeof insightsRaw.data)[0]>()
    for (const row of insightsRaw.data ?? []) {
      insightsMap.set(row.campaign_id, row)
    }

    const campaigns = (campaignsRaw.data ?? []).map(
      (c: { id: string; name: string; status: string; objective: string }) => {
        const ins = insightsMap.get(c.id)
        const leads = extractLeads(ins?.actions)
        const spend = Number(ins?.spend ?? 0)
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          objective: c.objective,
          spend,
          clicks: Number(ins?.clicks ?? 0),
          impressions: Number(ins?.impressions ?? 0),
          reach: Number(ins?.reach ?? 0),
          frequency: Number(ins?.frequency ?? 0),
          ctr: Number(ins?.ctr ?? 0),
          cpc: Number(ins?.cpc ?? 0),
          leads,
          cpl: leads > 0 ? spend / leads : 0,
        }
      }
    )

    // Global KPIs
    const totalSpend = campaigns.reduce(
      (s: number, c: { spend: number }) => s + c.spend,
      0
    )
    const totalLeads = campaigns.reduce(
      (s: number, c: { leads: number }) => s + c.leads,
      0
    )
    const totalClicks = campaigns.reduce(
      (s: number, c: { clicks: number }) => s + c.clicks,
      0
    )
    const totalImpressions = campaigns.reduce(
      (s: number, c: { impressions: number }) => s + c.impressions,
      0
    )
    const avgCtr =
      totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0
    const avgFrequency =
      campaigns.length > 0
        ? campaigns.reduce(
            (s: number, c: { frequency: number }) => s + c.frequency,
            0
          ) / campaigns.length
        : 0

    return NextResponse.json({
      kpis: { totalSpend, totalLeads, avgCpl, avgCtr, avgFrequency },
      campaigns,
    })
  } catch (error) {
    if (error instanceof Error && (error as Error & { tokenExpired?: boolean }).tokenExpired) {
      return NextResponse.json(
        { error: 'TOKEN_EXPIRED', tokenExpired: true },
        { status: 401 }
      )
    }
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
