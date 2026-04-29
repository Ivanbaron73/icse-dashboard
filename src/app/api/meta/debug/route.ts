import { NextResponse } from 'next/server'

const BASE = 'https://graph.facebook.com/v19.0'

export async function GET() {
  const token = process.env.META_ACCESS_TOKEN
  const accountId = process.env.META_AD_ACCOUNT_ID
  if (!token || !accountId) return NextResponse.json({ error: 'missing env' }, { status: 400 })

  const presets = ['last_7d', 'last_14d', 'last_30d', 'this_month', 'last_month']
  const results: Record<string, unknown> = {}

  for (const preset of presets) {
    try {
      const res = await fetch(
        `${BASE}/${accountId}/insights?level=campaign&fields=campaign_id,campaign_name,spend&date_preset=${preset}&limit=10&access_token=${token}`,
        { cache: 'no-store' }
      )
      const data = await res.json()
      results[preset] = { count: data.data?.length ?? 0, data: data.data ?? [], error: data.error }
    } catch (e) {
      results[preset] = { error: String(e) }
    }
  }

  return NextResponse.json(results)
}
